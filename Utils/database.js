/*
 * ARQUIVO: src/Utils/database.js
 * * Responsabilidade: Isolar toda a interação com o sistema de arquivos (fs).
 * Garante que o JSON seja lido e escrito de forma segura.
 *
 * ATUALIZADO:
 * 1. Aponta para /data/recrutas.json (conforme sua estrutura)
 * 2. Formata o 'displayName' e 'vCard' para o novo padrão 📚 [Emoji] [Nome] [Clã] [Data]
 * 
 */
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

// Caminho para a pasta 'data' na RAIZ do projeto
const dataDir = path.join(__dirname, '..', 'data'); 
// Caminho para o arquivo 'recrutas.json' dentro da pasta 'data'
const arquivoFichas = path.join(dataDir, 'recrutas.json'); 

/**
 * Garante que o diretório e o arquivo de banco de dados existam.
 */
function initDatabase() {
    try {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(arquivoFichas)) {
            fs.writeFileSync(arquivoFichas, JSON.stringify({}, null, 2));
        }
    } catch (e) {
        console.error("ERRO CRÍTICO ao inicializar o banco de dados:", e);
    }
}

/**
 * Lê o banco de dados de fichas de forma segura.
 * @returns {object} O objeto JSON com todas as fichas.
 */
function getAllFichas() {
    try {
        const data = fs.readFileSync(arquivoFichas, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Erro ao ler recrutas.json:', e);
        return {}; // Retorna um objeto vazio em caso de falha
    }
}

/**
 * Salva (ou atualiza) uma ficha no banco de dados.
 * @param {string} targetJid O JID do recruta (ex: 5544...@s.whatsapp.net)
 * @param {object} dadosFicha Os dados parseados da ficha
 */
function saveFicha(targetJid, dadosFicha) {
    const db = getAllFichas();

    // --- MUDANÇA REQUERIDA COMEÇA AQUI ---

    // 1. Prepara o emoji. Se não houver emoji (clã não listado), não adiciona espaço extra.
    const emojiDisplay = dadosFicha.emojiCla ? `${dadosFicha.emojiCla} ` : '';

    // 2. Cria o novo 'displayName' no formato solicitado
    const displayFull = `📚 ${emojiDisplay}${dadosFicha.nome} ${dadosFicha.cla} ${dadosFicha.data}`.trim().replace(/\s+/g, ' ');

    // 3. Cria o vCard com o novo 'displayFull'
    const waid = targetJid.split('@')[0];
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nN:;${displayFull};;;\nFN:${displayFull}\nitem1.TEL;waid=${waid}:${waid}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`;
    
    // --- MUDANÇA REQUERIDA TERMINA AQUI ---


    // Salva o novo objeto de ficha
    db[targetJid] = {
        ...dadosFicha,
        jid: targetJid,
        vcard: vcard, // Salva o novo vCard
        displayName: displayFull, // Salva o novo displayName
        timestamp: Date.now()
    };

    try {
        fs.writeFileSync(arquivoFichas, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error('ERRO CRÍTICO ao salvar ficha:', e);
    }
}

// Inicializa o DB na primeira vez que o módulo é carregado
initDatabase();

module.exports = {
    getAllFichas,
    saveFicha,
};