/*
 * ARQUIVO: src/handlers/api_server.js
 * * Responsabilidade: Servidor Express (API Gateway) para a DIJ.
 *
 * v2.5 - Removido o endpoint POST /api/missao/salvar.
 * A inserção de dados agora é feita EXCLUSIVAMENTE pelo bot via !salvarmissao.
 */

const express = require('express');
const db = require('../../utils/database.js'); 

// Imports do Swagger
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

const app = express();
const PORT = process.env.PORT || 3000; 

// Middleware para parsear JSON (ainda útil para futuras APIs POST, se necessário)
app.use(express.json());

// Configuração do Swagger
const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'API do Bot Abelhinha (DIJ)',
        version: '1.0.0',
        description: 'API Gateway para a Divisão de Inteligência de Jogo (DIJ). Permite consultar dados do RPG.',
    },
    servers: [
        {
            url: `http://localhost:${PORT}`,
            description: 'Servidor de Desenvolvimento Local',
        },
        // TODO: Adicionar o URL da VM OCI quando estiver em produção
    ],
};

const swaggerOptions = {
    swaggerDefinition,
    // Aponta para os arquivos que contêm os comentários da API
    apis: ['./src/handlers/*.js'], 
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Endpoint para a documentação interativa (o seu /docs)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// --- 1. ENDPOINT DE SAÚDE (HEALTHCHECK) ---
/**
 * @swagger
 * /api/health:
 * get:
 * summary: Verifica a saúde do servidor da API
 * tags: [Status]
 * description: Retorna o status 'UP' e o uptime do servidor se a API estiver funcionando.
 * responses:
 * '200':
 * description: Servidor está online e funcionando.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status:
 * type: string
 * example: UP
 * service:
 * type: string
 * example: DIJ API Gateway
 * uptime:
 * type: number
 * example: 120.5
 */
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: "UP",
        service: "DIJ API Gateway",
        uptime: process.uptime()
    });
});

// --- 2. ENDPOINT DE ESCRITA (REMOVIDO) ---
/* * O endpoint POST /api/missao/salvar foi removido.
 * A inserção de dados brutos de missão é feita exclusivamente
 * pelo comando '!salvarmissao' do bot para garantir 
 * segurança e uma única fonte de entrada.
 */


// --- 3. ENDPOINT DE LEITURA SEGURA (Dados de Recrutamento) ---
/**
 * @swagger
 * /api/dados/recrutamento:
 * get:
 * summary: Retorna dados de recrutamento seguros (sem JIDs) para análise
 * tags: [Fichas (DIJ)]
 * description: Endpoint para o script Python/Power BI puxar os dados da tabela 'fichas', já filtrados para remover JIDs (números de telefone).
 * responses:
 * '200':
 * description: Uma lista de fichas processadas.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * total:
 * type: integer
 * example: 93
 * data:
 * type: array
 * items:
 * type: object
 * properties:
 * nome:
 * type: string
 * cla:
 * type: string
 * emojiCla:
 * type: string
 * recrutadoPorTexto:
 * type: string
 * data:
 * type: string
 * timestamp:
 * type: integer
 * '500':
 * description: Erro interno no servidor.
 */
app.get('/api/dados/recrutamento', async (req, res) => {
    try {
        const fichasObj = await db.getAllFichas();
        const fichasArray = Object.values(fichasObj);

        // Filtro de Segurança: Remove dados sensíveis
        const dadosSeguros = fichasArray.map(ficha => ({
            nome: ficha.nome,
            cla: ficha.cla,
            emojiCla: ficha.emojiCla,
            recrutadoPorTexto: ficha.recrutadoPorTexto,
            data: ficha.data,
            timestamp: ficha.timestamp,
        }));
        
        res.status(200).json({ 
            total: dadosSeguros.length,
            data: dadosSeguros 
        });

    } catch (e) {
        console.error("[API ERROR] Falha ao buscar dados de recrutamento:", e);
        res.status(500).json({ error: "Erro interno ao buscar dados para análise." });
    }
});

// --- 4. ENDPOINT DE LEITURA (Dados Brutos de Missões) ---
/**
 * @swagger
 * /api/dados/missoes-concluidas:
 * get:
 * summary: Retorna os últimos 50 resultados brutos de missões salvos
 * tags: [Missoes (DIJ)]
 * description: Endpoint de leitura para o Sunny (Python) puxar o texto bruto das missões salvas para análise.
 * responses:
 * '200':
 * description: Uma lista dos últimos 50 registros de missões brutas.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * total:
 * type: integer
 * example: 1
 * data:
 * type: array
 * items:
 * type: object
 * properties:
 * id:
 * type: integer
 * texto_bruto:
 * type: string
 * admin_jid:
 * type: string
 * data_registro:
 * type: string
 * timestamp:
 * type: integer
 * '500':
 * description: Erro interno no servidor.
 */
app.get('/api/dados/missoes-concluidas', async (req, res) => {
    try {
        const missoesArray = await db.getMissoesConcluidas(50); // Puxa as últimas 50
        
        res.status(200).json({ 
            total: missoesArray.length,
            data: missoesArray 
        });
    } catch (e) {
        console.error("[API ERROR] Falha ao buscar dados de missões brutas:", e);
        res.status(500).json({ error: "Erro interno ao buscar dados para análise." });
    }
});
// --- FIM DO NOVO ENDPOINT ---


// Função para iniciar o servidor
function startAPIServer() {
    try {
        app.listen(PORT, () => {
            console.log(`[API Server] Servidor de API iniciado na porta ${PORT}`);
            console.log(`[API Server] Documentação interativa disponível em: http://localhost:${PORT}/api/docs`);
        }).on('error', (err) => {
            console.error(`[API Server] ERRO: Falha ao iniciar na porta ${PORT}. A porta está em uso?`, err.message);
        });
    } catch (e) {
         console.error(`[API Server] Erro catastrófico ao iniciar:`, e);
    }
}

module.exports = { startAPIServer };