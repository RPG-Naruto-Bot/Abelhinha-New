/*
 * ARQUIVO: Utils/database.js
 * * Responsabilidade: Isolar toda a interação com o banco de dados SQLite (DAL).
 * v2.5 - CORRIGIDO: 'saveFicha' e 'saveMissaoConcluida' agora incluem
 * todas as colunas corretas (timestamp, hash_texto) no INSERT.
 * Adição das mensagens de falha na conexão com o sqlite
 */

const fs = require('fs'); // Importado no topo
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment-timezone');
const crypto = require('crypto');

// Caminho para o banco de dados SQLite
const projectRootDir = path.join(__dirname, '..');
const dataDir = path.join(projectRootDir, 'data');
const dbPath = path.join(dataDir, 'rpg_data.db');

/**
 * Garante que o diretório 'data' exista.
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
    return new Promise((resolve) => {
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
 * @returns {Promise<Array<object>>} Retorna array de objetos.
 */
function getFichasByTimestamp(startTimestamp, endTimestamp) {
    return new Promise((resolve) => {
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
            db.close((closeErr) => {
                if (closeErr) { console.error('[DB][saveMissaoConcluida] Erro ao fechar conexão:', closeErr.message); }
            });
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
        // --- CORREÇÃO: Timestamp movido para ser gerado aqui ---
        const timestamp = Date.now(); 
        const dataFormatada = dadosFicha.data || moment(timestamp).tz('America/Sao_Paulo').format('DD/MM/YYYY');
        // --- FIM CORREÇÃO ---

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
            dataFormatada, 
            timestamp, // <-- CORREÇÃO: Timestamp adicionado
            vcard, 
            displayName
        ];

        db.run(sql, params, function (err) {
            db.close((closeErr) => {
                if (closeErr) { console.error('[DB][saveMissaoConcluida] Erro ao fechar conexão:', closeErr.message); }
            });
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
 * Remove uma ficha do banco de dados usando o JID.
 * @param {string} targetJid O JID do usuário (ex: '5543...@s.whatsapp.net')
 * @returns {Promise<void>}
 */
function deleteFicha(targetJid) {
    return new Promise((resolve, reject) => {
        // Conecta ao mesmo banco de dados
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                console.error('[DB][deleteFicha] Erro ao conectar ao SQLite:', err.message);
                return reject(new Error(`Erro ao conectar ao DB: ${err.message}`));
            }
        });

        const sql = `DELETE FROM fichas WHERE jid = ?;`;

        db.run(sql, [targetJid], function (err) {
            // Fecha a conexão, não importa o que aconteça
            db.close((closeErr) => {
                if (closeErr) { console.error('[DB][deleteFicha] Erro ao fechar conexão:', closeErr.message); }
            });

            if (err) {
                console.error('[DB][deleteFicha] Erro ao executar DELETE:', err.message);
                return reject(new Error(`Erro ao deletar do DB: ${err.message}`));
            }

            // 'this.changes' nos diz quantas linhas foram afetadas.
            // Se for 0, é porque o JID não foi encontrado.
            if (this.changes === 0) {
                console.warn(`[DB][deleteFicha] Tentativa de anular JID não encontrado: ${targetJid}`);
                return reject(new Error("Esse usuário não possui uma ficha no banco de dados."));
            }

            console.log(`[DB][deleteFicha] Ficha removida com sucesso para JID: ${targetJid}. Linhas afetadas: ${this.changes}`);
            resolve(); // Sucesso!
        });
    });
}

/**
 * Busca os últimos N resultados brutos de missões salvos.
 * @returns {Promise<Array<object>>} Uma Promise que resolve com um ARRAY de missões.
 */
function getMissoesConcluidas(limit = 50) {
    return new Promise((resolve) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('[DB][getMissoesConcluidas] Erro ao conectar:', err.message);
                return resolve([]);
            }
        });

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

/**
 * Salva o texto bruto de uma missão na tabela missoes_concluidas.
 * @returns {Promise<void>}
 */
function saveMissaoConcluida(textoBruto, adminJid) {
    return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const dataRegistro = moment(timestamp).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm:ss');
        
        // --- GERAÇÃO DO HASH ---
        const hash = crypto.createHash('md5').update(textoBruto).digest('hex');
        // --- FIM DA GERAÇÃO ---

        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
            if (err) { 
                console.error('[DB][saveMissaoConcluida] Erro ao conectar ao SQLite:', err.message);
                return reject(new Error(`Erro ao conectar ao DB: ${err.message}`));
            }
        });

        // --- CORREÇÃO: Adicionada coluna 'hash_texto' ---
        const sql = `
            INSERT INTO missoes_concluidas (
                texto_bruto, admin_jid, data_registro, timestamp, hash_texto
            ) VALUES (?, ?, ?, ?, ?);
        `;
        const params = [ 
            textoBruto, 
            adminJid || null, 
            dataRegistro, 
            timestamp, 
            hash // <-- HASH ADICIONADO
        ];
        // --- FIM DA CORREÇÃO ---

        db.run(sql, params, function (err) {
            db.close();
            if (err) { 
                 // --- DETECÇÃO DE DUPLICATA ---
                if (err.message.includes('SQLITE_CONSTRAINT: UNIQUE constraint failed: missoes_concluidas.hash_texto')) {
                    console.warn(`[DB][saveMissaoConcluida] Tentativa de inserir missão duplicada (hash: ${hash}).`);
                    return reject(new Error('DUPLICATE')); // Retorna o erro específico
                }
                // --- FIM DA DETECÇÃO ---
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
    deleteFicha,
    saveMissaoConcluida,
    getMissoesConcluidas
};