// src/commands/recrutamento/processar.js
// Esta é a ferramenta manual para casos difíceis (novato saiu, ficha errada).
const parser = require('../../../utils/parser');
const db = require('../../../utils/database');
const moment = require('moment-timezone');
const clasAceitos = require('../../configs/clas.json');

/**
 * Gera o conteúdo de um arquivo .vcf (VCard) simples.
 * @param {string} nome O nome do contato.
 * @param {string} numero O número de telefone (pode conter +, -(, etc.).
 * @returns {string} O texto formatado do VCard.
 */
function gerarVCardFallback(nome, numero) {
    const tel = (numero || '').replace(/[^0-9]/g, '');
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${nome || ''}`];
    if (tel) lines.push(`TEL;TYPE=CELL:${tel}`);
    lines.push('END:VCARD');
    return lines.join('\n');
}

/**
 * Lógica do comando !processar (Manual com Overrides)
 */
async function executarProcessarManual(sock, msg, args, text) {
    const from = msg.key.remoteJid;
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedKey = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const adminJid = msg.key.participant || msg.key.remoteJid;

    // --- 1. EXTRAIR NÚMERO E OVERRIDES (DO COMANDO DO ADMIN) ---
    const content = text.substring(text.indexOf(' ') + 1).trim();

    // Extrai o número (parte antes de nome= ou cla=)
    const numberMatch = content.match(/^([\d\s().+-]+)/);
    const numeroLimpo = (numberMatch ? numberMatch[1] : '').replace(/[^0-9]/g, '');

    if (numeroLimpo.length < 8) {
        throw new Error('❌ Você precisa informar um número válido. Exemplo: `!processar 5544... cla=Uchiha`');
    }

    const targetJid = `${numeroLimpo}@s.whatsapp.net`;

    // --- 2. EXTRAIR OVERRIDES (nome=..., cla=..., etc.) ---
    const overrides = {};
    let paramsPart = content.replace(numberMatch[0], '').trim();

    // 🔹 Tratamento especial para múltiplas palavras sem aspas
    const tokens = [];
    let currentKey = null;
    let currentValue = [];
    for (const word of paramsPart.split(/\s+/)) {
        if (/^\w+=/.test(word)) {
            if (currentKey) tokens.push([currentKey, currentValue.join(' ').trim()]);
            const [key, value] = word.split('=');
            currentKey = key.toLowerCase();
            currentValue = value ? [value] : [];
        } else if (currentKey) {
            currentValue.push(word);
        }
    }
    if (currentKey) tokens.push([currentKey, currentValue.join(' ').trim()]);

    // Normaliza e aplica os valores detectados
    for (const [key, rawValue] of tokens) {
        if (!rawValue) continue;
        const value = rawValue.replace(/^['"]|['"]$/g, '').trim();
        switch (key) {
            case 'nome':
            case 'nick':
            case 'n':
                overrides.nome = value;
                break;
            case 'cla':
            case 'clan':
            case 'c':
                overrides.cla = value;
                break;
            case 'recrutador':
            case 'recrutadopor':
            case 'r':
                overrides.recrutadoPorTexto = value;
                break;
            default:
                console.warn(`[Processar Manual] Parâmetro desconhecido ignorado: ${key}=${value}`);
        }
    }

    console.log('[Processar Manual] Overrides detectados:', overrides);

    // --- 3. PARSEAR A FICHA ORIGINAL ---
    try {
        await sock.sendMessage(from, { react: { text: '🛠️', key: msg.key } });
    } catch (e) {
        console.warn('Reação não suportada:', e.message);
    }

    const textoFicha = parser.extractText(quoted);
    const dadosParseados = parser.parseFicha(textoFicha);

    // --- 4. MESCLAR DADOS (base + overrides) ---
    let dadosFinais = { ...dadosParseados, ...overrides };

    // Re-normaliza o clã (deixa o nome padronizado e com emoji)
    const { claEncontrado, emojiCla } = parser.normalizeCla(dadosFinais.cla);
    dadosFinais.cla = claEncontrado;
    dadosFinais.emojiCla = emojiCla;

    // --- 5. VERIFICAÇÕES DE SEGURANÇA E ERROS ESPECÍFICOS ---
    if (!dadosFinais.nome || dadosFinais.nome.trim() === '') {
        throw new Error('❌ Não foi possível identificar o *Nome*. Corrija usando `nome="Nome do Novato"` no comando.');
    }

    if (!dadosFinais.cla || dadosFinais.cla === 'sem clã') {
        throw new Error('❌ Não foi possível identificar o *Clã*. Corrija usando `cla=NomeDoCla` no comando.');
    }

    const claKey = dadosFinais.cla.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(clasAceitos, claKey)) {
        throw new Error(`❌ O clã "${dadosFinais.cla}" não é reconhecido como válido.`);
    }

    // --- 6. SALVAR NO DB ---
    const dadosParaSalvar = {
        nome: dadosFinais.nome,
        cla: claEncontrado,
        emojiCla: emojiCla,
        recrutadoPorTexto: dadosFinais.recrutadoPorTexto || 'Não informado',
        registradoPorJid: adminJid,
        data: moment().tz('America/Sao_Paulo').format('DD/MM/YYYY'),
        timestamp: Date.now(),
        vcard: gerarVCardFallback(dadosFinais.nome, numeroLimpo)
    };

    await db.saveFicha(targetJid, dadosParaSalvar);

    // --- 7. REAÇÃO DE SUCESSO NA FICHA E MENSAGEM DE CONFIRMAÇÃO ---
    try {
        // ✅ Reage na ficha citada
        if (quotedKey && quotedParticipant) {
            await sock.sendMessage(from, {
                react: {
                    text: '✅',
                    key: {
                        remoteJid: from,
                        id: quotedKey,
                        participant: quotedParticipant
                    }
                }
            });
        }

        // 💬 Mensagem de sucesso para o admin
        await sock.sendMessage(from, {
            text: `✅ Ficha de *${dadosFinais.nome}* processada com sucesso!\n📜 Clã: ${emojiCla} ${claEncontrado}`
        });
    } catch (e) {
        console.warn('Falha ao enviar confirmação:', e.message);
    }
}

module.exports = { executarProcessarManual };
