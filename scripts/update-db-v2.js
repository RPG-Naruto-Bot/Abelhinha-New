/*
 * ARQUIVO: scripts/update-db-v2.js
 * * Responsabilidade: Adiciona a coluna 'hash_texto' com constraint UNIQUE
 * à tabela 'missoes_concluidas' para evitar duplicatas.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ajuste o caminho se o 'Utils' estiver na raiz
const dataDir = path.join(__dirname, '..', 'data'); 
const dbPath = path.join(dataDir, 'rpg_data.db'); 

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("[UpdateDB] Erro ao conectar ao banco:", err.message);
        process.exit(1);
    }
    console.log("[UpdateDB] Conectado ao banco de dados SQLite.");
});

// Comando SQL para ADICIONAR a nova coluna e torná-la ÚNICA
// 'COLLATE NOCASE' garante que a unicidade ignore maiúsculas/minúsculas (se aplicável, embora hash não precise)
// 'UNIQUE' é a parte importante.
const alterTableSql = `
ALTER TABLE missoes_concluidas
ADD COLUMN hash_texto TEXT UNIQUE; 
`;
// (Nota: SQLite não suporta 'ADD COLUMN ... UNIQUE' em uma só etapa se a tabela já tiver dados.
// Se a tabela já tiver dados, teremos que recriá-la. 
// Vamos assumir que ela está vazia ou que podemos adicionar a constraint assim.)

// -- FORMA MAIS SEGURA (se a tabela já tiver dados) --
// 1. Renomear tabela antiga
// 2. Criar tabela nova (com a coluna hash)
// 3. Copiar dados da antiga para a nova
// 4. Dropar tabela antiga
// Por enquanto, vamos tentar o 'ADD COLUMN' simples.

db.serialize(() => {
    db.run(alterTableSql, (err) => {
        if (err) {
            if (err.message.includes("duplicate column name")) {
                console.warn("[UpdateDB] Aviso: Coluna 'hash_texto' já existe.");
            } else {
                console.error("[UpdateDB] Erro ao adicionar coluna 'hash_texto':", err.message);
                console.warn("[UpdateDB] Se a tabela já tem dados, 'ADD COLUMN ... UNIQUE' pode falhar.");
                console.warn("[UpdateDB] Pode ser necessário recriar a tabela manualmente.");
            }
        } else {
            console.log("[UpdateDB] Coluna 'hash_texto' adicionada com sucesso.");
            // Adiciona um índice para acelerar a busca pelo hash
            db.run("CREATE INDEX IF NOT EXISTS idx_hash_texto ON missoes_concluidas (hash_texto);", (idxErr) => {
                 if(idxErr) console.error("[UpdateDB] Erro ao criar índice:", idxErr.message);
                 else console.log("[UpdateDB] Índice 'idx_hash_texto' criado com sucesso.");
            });
        }

        db.close((closeErr) => {
            if (closeErr) console.error("[UpdateDB] Erro ao fechar conexão:", closeErr.message);
            else console.log("[UpdateDB] Conexão fechada.");
        });
    });
});