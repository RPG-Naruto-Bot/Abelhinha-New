/*
 * ARQUIVO: scripts/init-db.js
 * * Responsabilidade: Criar o arquivo de banco de dados SQLite (se não existir)
 * e garantir que a tabela 'fichas' exista com o schema correto.
 * Deve ser rodado manualmente pelos desenvolvedores ao configurar o ambiente.
 */

const sqlite3 = require('sqlite3').verbose(); // verbose() dá mais detalhes em erros
const path = require('path');

// Caminho para o diretório 'data' (assumindo que 'scripts' está na raiz)
const dataDir = path.join(__dirname, '..', 'data');
// Caminho para o arquivo do banco de dados
const dbPath = path.join(dataDir, 'rpg_data.db'); // <<< Arquivo .db agora

// Garante que a pasta 'data' exista
try {
    if (!require('fs').existsSync(dataDir)) {
        require('fs').mkdirSync(dataDir, { recursive: true });
        console.log(`[InitDB] Pasta criada em: ${dataDir}`);
    }
} catch (e) {
    console.error("[InitDB] ERRO CRÍTICO ao criar a pasta 'data':", e);
    process.exit(1); // Aborta se não conseguir criar a pasta
}

// Conecta ao banco de dados (cria o arquivo .db se não existir)
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("[InitDB] Erro ao conectar/criar o banco de dados:", err.message);
        process.exit(1); // Aborta em caso de erro
    } else {
        console.log(`[InitDB] Conectado ao banco de dados SQLite em: ${dbPath}`);
    }
});

// Comando SQL para criar a tabela
const createTableSql = `
CREATE TABLE IF NOT EXISTS fichas (
    jid TEXT PRIMARY KEY NOT NULL,
    nome TEXT NOT NULL,
    cla TEXT NOT NULL,
    emojiCla TEXT,
    recrutadoPorTexto TEXT,
    registradoPorJid TEXT,
    data TEXT,
    timestamp INTEGER NOT NULL,
    vcard TEXT,
    displayName TEXT
);
`;

// Executa o comando SQL e fecha a conexão
db.serialize(() => { // Garante que os comandos rodem em ordem
    db.run(createTableSql, (err) => {
        if (err) {
            console.error("[InitDB] Erro ao criar a tabela 'fichas':", err.message);
        } else {
            console.log("[InitDB] Tabela 'fichas' verificada/criada com sucesso.");
            // Poderíamos adicionar criação de ÍNDICES aqui para otimizar consultas futuras
            // Ex: db.run("CREATE INDEX IF NOT EXISTS idx_cla ON fichas (cla);");
            // Ex: db.run("CREATE INDEX IF NOT EXISTS idx_timestamp ON fichas (timestamp);");
        }

        // Fecha a conexão com o banco de dados
        db.close((err) => {
            if (err) {
                console.error("[InitDB] Erro ao fechar a conexão com o banco:", err.message);
            } else {
                console.log("[InitDB] Conexão com o banco fechada.");
            }
        });
    });
});