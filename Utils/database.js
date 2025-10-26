/*
 * ARQUIVO: Utils/database.js
 * * Responsabilidade: Isolar toda a interação com o banco de dados SQLite.
 *
 * v2.1 - Migração para SQLite concluída
 * - Refatorada a função saveFicha() para usar INSERT OR REPLACE.
 * - Refatorada a função getAllFichas() para usar SQLite.
 */
const fs = require('fs')
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment-timezone'); // Precisamos dele de volta

// Caminho para o banco de dados SQLite
const dataDir = '/app/data'; // Caminho que mapeamos no 'docker run -v'
const dbPath = path.join(dataDir, 'recrutas.db');

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
            db.close((closeErr) => {
                if (closeErr) { console.error('[DB][getAllFichas] Erro ao fechar conexão:', closeErr.message); }
            });
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
 * @param {number} startTimestamp Timestamp inicial (milissegundos UNIX).
 * @param {number} endTimestamp Timestamp final (milissegundos UNIX).
 * @returns {Promise<Array<object>>} Uma Promise que resolve com um ARRAY
 * contendo os objetos das fichas encontradas no período. Retorna array vazio em caso de erro.
 */
function getFichasByTimestamp(startTimestamp, endTimestamp) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('[DB][getByTimestamp] Erro ao conectar:', err.message);
                return resolve([]); // Retorna array vazio
            }
        });

        const sql = `
            SELECT * FROM fichas
            WHERE timestamp >= ? AND timestamp <= ?
            ORDER BY timestamp ASC; -- Opcional: ordenar por data
        `;
        const params = [startTimestamp, endTimestamp];

        // db.all retorna um array de resultados
        db.all(sql, params, (err, rows) => {
            db.close((closeErr) => { /* ... (log erro close) ... */ });
            if (err) {
                console.error('[DB][getByTimestamp] Erro ao executar SELECT:', err.message);
                return resolve([]); // Retorna array vazio
            }
            // Resolve diretamente com o ARRAY retornado pelo SQLite
            resolve(rows || []);
        });
    });
}

// --- FUNÇÃO REESCRITA: saveFicha() ---
/**
 * Salva (ou atualiza se já existir) uma ficha no banco de dados SQLite.
 * @param {string} targetJid O JID do recruta (ex: 5544...@s.whatsapp.net)
 * @param {object} dadosFicha Objeto contendo { nome, cla, emojiCla, recrutadoPorTexto, registradoPorJid, data }
 * @returns {Promise<void>} Uma Promise que resolve quando a operação termina ou rejeita em caso de erro.
 */
function saveFicha(targetJid, dadosFicha) {
    // Retorna uma Promise para lidar com a operação assíncrona
    return new Promise((resolve, reject) => {
        // 1. Gera os campos calculados (timestamp, displayName, vCard)
        const timestamp = Date.now(); // Timestamp atual em milissegundos
        // Usa a data fornecida OU a data atual formatada
        const dataFormatada = dadosFicha.data || moment(timestamp).tz('America/Sao_Paulo').format('DD/MM/YYYY');
        const emojiDisplay = dadosFicha.emojiCla ? `${dadosFicha.emojiCla} ` : '';
        const displayName = `📚 ${emojiDisplay}${dadosFicha.nome} ${dadosFicha.cla} ${dataFormatada}`.trim().replace(/\s+/g, ' ');
        const waid = targetJid.split('@')[0];
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nN:;${displayName};;;\nFN:${displayName}\nitem1.TEL;waid=${waid}:${waid}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`;

        // 2. Conecta ao banco de dados (modo leitura/escrita)
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                console.error('[DB][saveFicha] Erro ao conectar ao SQLite:', err.message);
                return reject(new Error(`Erro ao conectar ao DB: ${err.message}`)); // Rejeita a Promise
            }
        });

        // 3. Define o SQL com INSERT OR REPLACE e placeholders (?)
        // 'INSERT OR REPLACE' garante que se o JID (PRIMARY KEY) já existir, a linha inteira será atualizada.
        const sql = `
            INSERT OR REPLACE INTO fichas (
                jid, nome, cla, emojiCla, recrutadoPorTexto,
                registradoPorJid, data, timestamp, vcard, displayName
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;

        // 4. Array com os parâmetros na ordem correta das colunas e placeholders
        const params = [
            targetJid, // jid
            dadosFicha.nome, // nome
            dadosFicha.cla, // cla
            dadosFicha.emojiCla || null, // emojiCla (usa null se vazio)
            dadosFicha.recrutadoPorTexto || 'Não informado', // recrutadoPorTexto
            dadosFicha.registradoPorJid || null, // registradoPorJid (usa null se vazio)
            dataFormatada, // data
            timestamp, // timestamp (INTEGER)
            vcard, // vcard
            displayName // displayName
        ];

        // 5. Executa o comando
        db.run(sql, params, function (err) { // Usamos 'function' para ter acesso ao 'this'
            // Fecha a conexão independentemente do resultado
            db.close((closeErr) => {
                if (closeErr) {
                    console.error('[DB][saveFicha] Erro ao fechar conexão SQLite:', closeErr.message);
                    // Não rejeita a promise principal por erro no close, mas loga
                }
            });

            if (err) {
                console.error('[DB][saveFicha] Erro ao executar INSERT OR REPLACE:', err.message);
                return reject(new Error(`Erro ao salvar no DB: ${err.message}`)); // Rejeita a Promise
            }

            // Sucesso!
            // this.changes indica quantas linhas foram afetadas (1 para INSERT ou REPLACE)
            console.log(`[DB][saveFicha] Ficha salva/atualizada com sucesso para JID: ${targetJid}. Linhas afetadas: ${this.changes}`);
            resolve(); // Resolve a Promise indicando sucesso
        });
    });
}

module.exports = {
    getAllFichas, // Retorna Promise<Objeto>
    getFichasByTimestamp,
    saveFicha,   // Retorna Promise<void>
};