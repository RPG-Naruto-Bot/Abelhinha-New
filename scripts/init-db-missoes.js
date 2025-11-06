/*
 * ARQUIVO: scripts/init-db-missoes.js
 * * Responsabilidade: (RE)CRIAR a tabela 'missoes_concluidas'
 * com o schema final (incluindo anti-duplicata 'hash_texto').
 *
 * v2.0 - Adicionado DROP TABLE para limpar dados de teste
 * e garantir o schema UNIQUE.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Caminho do DB (assumindo que Utils/ está na raiz)
const projectRootDir = path.join(__dirname, '..'); 
const dataDir = path.join(projectRootDir, 'data');
const dbPath = path.join(dataDir, 'rpg_data.db'); // <<< Nome correto

// Garante que a pasta 'data' exista
try {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
} catch (e) {
    console.error("[InitMissoesDB] ERRO CRÍTICO ao criar a pasta 'data':", e);
    process.exit(1);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("[InitMissoesDB] Erro ao conectar/criar o banco de dados:", err.message);
        process.exit(1);
    } else {
        console.log(`[InitMissoesDB] Conectado ao banco de dados SQLite: ${dbPath}`);
    }
});

// SQL para APAGAR a tabela antiga (se existir)
const dropTableSql = `DROP TABLE IF EXISTS missoes_concluidas;`;
// SQL para CRIAR a tabela nova (com schema final)
const createTableSql = `
CREATE TABLE missoes_concluidas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    texto_bruto TEXT NOT NULL,
    admin_jid TEXT,
    data_registro TEXT,
    timestamp INTEGER NOT NULL,
    hash_texto TEXT UNIQUE
);
`;

// Executa os comandos em ordem
db.serialize(() => {
    // 1. Limpa a tabela antiga
    db.run(dropTableSql, (err) => {
        if (err) {
            console.error("[InitMissoesDB] Erro ao 'DROP TABLE missoes_concluidas':", err.message);
        } else {
            console.log("[InitMissoesDB] Tabela 'missoes_concluidas' antiga removida (limpeza).");
        }
    });

    // 2. Cria a tabela nova com o schema correto
    db.run(createTableSql, (err) => {
        if (err) {
            console.error("[InitMissoesDB] Erro ao 'CREATE TABLE missoes_concluidas':", err.message);
        } else {
            console.log("[InitMissoesDB] Tabela 'missoes_concluidas' recriada com schema final (com hash_texto UNIQUE).");
        }
    });

    // 3. Fecha a conexão
    db.close((closeErr) => {
        if (closeErr) {
            console.error("[InitMissoesDB] Erro ao fechar a conexão com o banco:", closeErr.message);
        } else {
            console.log("[InitMissoesDB] Conexão com o banco fechada.");
        }
    });
});