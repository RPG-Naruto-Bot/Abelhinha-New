/*
 * ARQUIVO: src/Utils/database.js
 * * Responsabilidade: Isolar toda a interação com o banco de dados SQLite (DAL).
 *
 * v2.2 - Migração para SQLite finalizada
 * - Adicionada função saveMissaoBruta para o módulo DIJ.
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment-timezone');
const fs = require('fs'); // Necessário para initDatabase

// --- Configuração do Caminho do DB ---
// Sobe um nível de 'Utils/' para chegar na raiz 'Abelinha-v2/'
const projectRootDir = path.join(__dirname, '..');
const dataDir = path.join(projectRootDir, 'data');

// Define o arquivo do banco de dados SQLite
const dbPath = path.join(dataDir, 'rpg_data.db'); // Nome correto do arquivo

/**
 * Garante que o diretório 'data' exista. 
 * A criação da tabela é feita externamente via scripts/init-db.js.
 */
function initDatabaseDir() {
    try {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    } catch (e) {
        console.error("ERRO CRÍTICO ao inicializar o diretório 'data':", e);
    }
}
initDatabaseDir(); // Executa a inicialização do diretório

// --- Funções de Leitura ---

/**
 * Lê todas as fichas do banco de dados SQLite.
 * @returns {Promise<object>} Promise resolvida com objeto { jid: fichaData }
 */
function getAllFichas() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('[DB][getAllFichas] Erro ao conectar:', err.message);
                return resolve({});
            }
        });
        const sql = `SELECT * FROM fichas`;
        db.all(sql, [], (err, rows) => {
            db.close((closeErr) => { /* ... */ });
            if (err) {
                console.error('[DB][getAllFichas] Erro ao executar SELECT:', err.message);
                return resolve({});
            }
            const fichasObj = {};
            if (rows) {
                rows.forEach(row => { if (row.jid) { fichasObj[row.jid] = row; } });
            }
            resolve(fichasObj);
        });
    });
}

/**
 * Busca fichas dentro de um intervalo de datas (timestamp).
 * @returns {Promise<Array<object>>} Retorna array de objetos.
 */
function getFichasByTimestamp(startTimestamp, endTimestamp) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('[DB][getByTimestamp] Erro ao conectar:', err.message);
                return resolve([]);
            }
        });

        const sql = `
            SELECT * FROM fichas
            WHERE timestamp >= ? AND timestamp <= ?
            ORDER BY timestamp ASC;
        `;
        const params = [startTimestamp, endTimestamp];
        db.all(sql, params, (err, rows) => {
            db.close((closeErr) => { /* ... */ });
            if (err) {
                console.error('[DB][getByTimestamp] Erro ao executar SELECT:', err.message);
                return resolve([]);
            }
            resolve(rows || []);
        });
    });
}

// --- Funções de Escrita ---

/**
 * Salva (ou atualiza) uma ficha na tabela 'fichas'.
 * @returns {Promise<void>}
 */
function saveFicha(targetJid, dadosFicha) {
    return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const dataFormatada = dadosFicha.data || moment(timestamp).tz('America/Sao_Paulo').format('DD/MM/YYYY');
        const emojiDisplay = dadosFicha.emojiCla ? `${dadosFicha.emojiCla} ` : '';
        const displayName = `📚 ${emojiDisplay}${dadosFicha.nome} ${dadosFicha.cla} ${dataFormatada}`.trim().replace(/\s+/g, ' ');
        const waid = targetJid.split('@')[0];
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nN:;${displayName};;;\nFN:${displayName}\nitem1.TEL;waid=${waid}:${waid}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`;

        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                console.error('[DB][saveFicha] Erro ao conectar ao SQLite:', err.message);
                return reject(new Error(`Erro ao conectar ao DB: ${err.message}`));
            }
        });

        const sql = `
            INSERT OR REPLACE INTO fichas (
                jid, nome, cla, emojiCla, recrutadoPorTexto,
                registradoPorJid, data, timestamp, vcard, displayName
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;

        const params = [
            targetJid, dadosFicha.nome, dadosFicha.cla, dadosFicha.emojiCla || null,
            dadosFicha.recrutadoPorTexto || 'Não informado', dadosFicha.registradoPorJid || null,
            dataFormatada, timestamp, vcard, displayName
        ];

        db.run(sql, params, function (err) {
            db.close((closeErr) => { /* ... */ });
            if (err) {
                console.error('[DB][saveFicha] Erro ao executar INSERT OR REPLACE:', err.message);
                return reject(new Error(`Erro ao salvar no DB: ${err.message}`));
            }
            console.log(`[DB][saveFicha] Ficha salva/atualizada com sucesso para JID: ${targetJid}. Linhas afetadas: ${this.changes}`);
            resolve();
        });
    });
}

/**
 * Busca os últimos N resultados brutos de missões salvos.
 * @returns {Promise<Array<object>>} Uma Promise que resolve com um ARRAY de missões.
 */
function getMissoesConcluidas(limit = 50) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('[DB][getMissoesConcluidas] Erro ao conectar:', err.message);
                return resolve([]);
            }
        });

        // Seleciona as últimas 50 missões salvas
        const sql = `
            SELECT * FROM missoes_concluidas 
            ORDER BY timestamp DESC
            LIMIT ?;
        `;
        const params = [limit];

        db.all(sql, params, (err, rows) => {
            db.close();
            if (err) {
                console.error('[DB][getMissoesConcluidas] Erro ao executar SELECT:', err.message);
                return resolve([]);
            }
            resolve(rows || []);
        });
    });
}
// --- FIM DA FUNÇÃO RENOMEADA ---

/**
 * Salva o texto bruto de uma missão na tabela missoes_concluidas.
 * @returns {Promise<void>}
 */
function saveMissaoConcluida(textoBruto, adminJid) {
    return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const dataRegistro = moment(timestamp).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm:ss');

        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
            if (err) { 
                console.error('[DB][saveMissaoConcluida] Erro ao conectar ao SQLite:', err.message);
                return reject(new Error(`Erro ao conectar ao DB: ${err.message}`));
            }
        });

        const sql = `
            INSERT INTO missoes_concluidas (
                texto_bruto, admin_jid, data_registro, timestamp
            ) VALUES (?, ?, ?, ?);
        `;
        const params = [ textoBruto, adminJid || null, dataRegistro, timestamp ];

        db.run(sql, params, function (err) {
            db.close();
            if (err) { 
                console.error('[DB][saveMissaoConcluida] Erro ao executar INSERT:', err.message);
                return reject(new Error(`Erro ao salvar missão concluída no DB: ${err.message}`));
            }
            console.log(`[DB][saveMissaoConcluida] Missão salva com sucesso. ID: ${this.lastID}`);
            resolve();
        });
    });
}

module.exports = {
    getAllFichas,
    getFichasByTimestamp,
    saveFicha,
    saveMissaoConcluida, // <-- Exporta a função com nome novo
    getMissoesConcluidas // <-- Exporta a função com nome novo
};