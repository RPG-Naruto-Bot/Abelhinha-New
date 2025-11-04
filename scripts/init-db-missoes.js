/*
 * ARQUIVO: scripts/init-db-missoes.js
 * * Responsabilidade: Criar a tabela 'missoes_concluidas' para o novo módulo DIJ.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'rpg_data.db');
const dataDir = path.join(__dirname, '..', 'data');

// Garante que a pasta 'data' exista antes de tentar criar/conectar o DB
try {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
} catch (e) {
    console.error("[InitMissoesDB] ERRO CRÍTICO ao criar a pasta 'data':", e);
    process.exit(1);
}

// Conecta ao banco
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("[InitMissoesDB] Erro ao conectar/criar o banco de dados:", err.message);
        process.exit(1);
    } else {
        console.log(`[InitMissoesDB] Conectado ao banco de dados SQLite.`);
    }
});

// Comando SQL para criar a tabela 'missoes_concluidas'
const createTableSql = `
CREATE TABLE IF NOT EXISTS missoes_concluidas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    texto_bruto TEXT NOT NULL,
    admin_jid TEXT,
    data_registro TEXT,
    timestamp INTEGER NOT NULL
);
`;

// Executa o comando SQL e fecha a conexão
db.serialize(() => {
    db.run(createTableSql, (err) => {
        if (err) {
            console.error("[InitMissoesDB] Erro ao criar a tabela 'missoes_concluidas':", err.message);
        } else {
            console.log("[InitMissoesDB] Tabela 'missoes_concluidas' criada com sucesso.");
        }

        db.close((closeErr) => {
            if (closeErr) {
                console.error("[InitMissoesDB] Erro ao fechar a conexão com o banco:", closeErr.message);
            } else {
                console.log("[InitMissoesDB] Conexão com o banco fechada.");
            }
        });
    });
});