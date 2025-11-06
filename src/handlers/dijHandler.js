/*
 * ARQUIVO: src/Handlers/dijHandler.js
 * ...
 * v2.4 - Adicionada a lógica do '!salvarmissao' (Modo Único) de volta
 * ao handler, coexistindo com o Modo de Lote (!iniciarsalvamento).
 */

const db = require('../../utils/database.js'); 
const { checkAdmin } = require('../../utils/common.js'); 
const parser = require('../../utils/parser.js'); // Necessário para o !salvarmissao

// --- 1. Armazenamento de Estado (Modo de Lote) ---
const batchSaveMode = new Map();
const BATCH_TIMEOUT_MS = 5 * 60 * 1000; 
const MISSION_START_STRING = "千 • Parabéns Para Os Que Concluíram Valendo Jutsu❕"; // Palavra-chave forte para validação

/**
 * Para o modo de salvamento em lote para um usuário específico.
 */
function stopBatchSave(sock, from, userJid, reason = "Modo de salvamento encerrado.") {
    // ... (lógica do stopBatchSave - sem alteração) ...
    const timer = batchSaveMode.get(userJid);
    if (timer) {
        clearTimeout(timer);
        batchSaveMode.delete(userJid);
        console.log(`[Handler DIJ] Modo de salvamento encerrado para ${userJid}. Razão: ${reason}`);
        if (reason.includes("manualmente")) {
            sock.sendMessage(from, { text: `✅ ${reason}` });
        }
    }
}

// --- NOVA FUNÇÃO DE VERIFICAÇÃO DE ESTADO ---
/**
 * Verifica se um usuário específico está no modo de salvamento em lote.
 * @param {string} userJid O JID do usuário (ex: 55...@s.whatsapp.net)
 * @returns {boolean}
 */
function isUserInBatchMode(userJid) {
    return batchSaveMode.has(userJid);
}

/**
 * O Handler Principal da DIJ (Divisão de Inteligência de Jogo)
 * Processa o modo de lote (batch mode) OU comandos únicos.
 */
async function handlerDIJ(sock, msg, text) {
    const from = msg.key.remoteJid;
    const userJid = msg.key.participant || msg.key.remoteJid; 
    const commandName = text.split(' ')[0].toLowerCase();
    
    // --- 1. Verifica se o USUÁRIO está em Modo de Salvamento em Lote ---
    if (batchSaveMode.has(userJid)) {
        
        // Verifica se é o comando de encerrar
        if (commandName === '!encerrarsalvamento') {
            stopBatchSave(sock, from, userJid, "Salvamento em cascata encerrado manualmente.");
            return;
        }

        // --- Lógica de Salvamento em Lote (como estava) ---
        const cleanText = text.replace(/\*/g, ''); 
        const isMissionResult = cleanText.includes(MISSION_START_STRING);

        if (isMissionResult) {
            console.log(`[Handler DIJ] Salvando mensagem (validada) em cascata de ${userJid}...`);
            try {
                await db.saveMissaoConcluida(text, userJid); 
                await sock.sendMessage(from, { react: { text: '💾', key: msg.key } }); // Salvo
            } catch (e) {
                if (e.message === 'DUPLICATE') {
                    console.warn(`[Handler DIJ] Missão duplicada ignorada (enviada por ${userJid}).`);
                    await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } }); // Duplicado
                } else {
                    console.error("[ERRO saveMissaoConcluida]", e);
                    await sock.sendMessage(from, { text: `❌ Erro ao salvar esta missão em cascata. @${userJid.split('@')[0]} ainda está no modo de salvamento.`, mentions: [userJid] }, { quoted: msg });
                }
            }
        } else {
            console.log(`[Handler DIJ] Mensagem aleatória ignorada (sem keywords): ${text.substring(0, 20)}...`);
            await sock.sendMessage(from, { react: { text: '❓', key: msg.key } }); // Ignorado
        }
        return; // Continua no modo de lote
    }

    // --- 2. Se não estiver em modo de lote, verifica os comandos da DIJ ---
    
    // Roteador de Comandos da DIJ
    switch (commandName) {
        case '!iniciarsalvamento': {
            const isAdmin = await checkAdmin(sock, msg);
            if (!isAdmin) {
                await sock.sendMessage(from, { text: '⚠ Apenas administradores podem iniciar o salvamento em cascata.' }, { quoted: msg });
                return;
            }
            if (batchSaveMode.has(userJid)) {
                await sock.sendMessage(from, { text: '⚠ Você já está no modo de salvamento em cascata.' }, { quoted: msg });
                return;
            }
            const timerId = setTimeout(() => {
                stopBatchSave(sock, from, userJid, "Timeout de 5 min atingido.");
                sock.sendMessage(from, { 
                text: `✅ Modo de salvamento em cascata DESATIVADO para @${userJid.split('@')[0]} por 5 minutos.\n\nEnvie as mensagens de resultado das missões. O bot salvará (💾) as válidas e ignorará (❓) as outras.\n\nDigite *!encerrarsalvamento* quando terminar.`,
                mentions: [userJid]
            });
            }, BATCH_TIMEOUT_MS);
            batchSaveMode.set(userJid, timerId);
            console.log(`[Handler DIJ] Modo de salvamento iniciado para ${userJid}.`);
            await sock.sendMessage(from, { 
                text: `✅ Modo de salvamento em cascata ATIVADO para @${userJid.split('@')[0]} por 5 minutos.\n\nEnvie as mensagens de resultado das missões. O bot salvará (💾) as válidas e ignorará (❓) as outras.\n\nDigite *!encerrarsalvamento* quando terminar.`,
                mentions: [userJid]
            });
            return;
        }

        // --- NOVA LÓGICA: !salvarmissao (Modo Único) ---
        case '!salvarmissao': {
            console.log("[Handler DIJ] Detectado comando !salvarmissao (Modo Único).");
            const isAdmin = await checkAdmin(sock, msg);
            if (!isAdmin) {
                await sock.sendMessage(from, { text: '⚠ Apenas administradores podem usar este comando.' }, { quoted: msg });
                return;
            }

            const ctx = msg.message?.extendedTextMessage?.contextInfo;
            const quoted = ctx?.quotedMessage;
            const adminJid = msg.key.participant || msg.key.remoteJid;
            let textoBruto = '';
            const args = text.split(' ').slice(1);

            // Lógica Dual-Mode (baseada no arquivo salvarmissao.js v2.1)
            if (quoted) {
                textoBruto = parser.extractText(quoted);
            } else {
                const lines = text.split('\n');
                if (lines.length <= 1) {
                    await sock.sendMessage(from, { text: '⚠ Formato inválido.\n\nUse este comando:\n1. *Respondendo* a UMA mensagem de resultado.\n2. *Colando* os resultados ABAIXO do comando `!salvarmissao`.' }, { quoted: msg });
                    return;
                }
                textoBruto = lines.slice(1).join('\n');
            }

            // Validação (Anti-Lixo)
            if (!textoBruto || textoBruto.trim().length < 10) {
                 await sock.sendMessage(from, { text: '❌ Não encontrei texto válido para salvar (mínimo 10 caracteres).' }, { quoted: msg });
                 return;
            }
            const lowerText = textoBruto.toLowerCase().replace(/\*/g, '');
            const isMissionResult = lowerText.includes(MISSION_START_STRING.toLowerCase()); // Usa a mesma keyword forte
            if (!isMissionResult) {
                await sock.sendMessage(from, { text: '❌ Texto inválido. A mensagem não parece ser um resultado de missão (falta o cabeçalho "Parabéns Para Os Que Concluíram...").' }, { quoted: msg });
                return;
            }

            // Salva no Banco de Dados
            try {
                await db.saveMissaoConcluida(textoBruto, adminJid);
                await sock.sendMessage(from, { react: { text: '💾', key: msg.key } }); // Salvo
                await sock.sendMessage(from, { text: `✅ 1 Resultado de missão (Modo Único) salvo no depósito.` }, { quoted: msg });

            } catch (e) {
                if (e.message === 'DUPLICATE') {
                    console.warn(`[Handler DIJ] Missão duplicada ignorada (Modo Único por ${adminJid}).`);
                    await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } }); // Duplicado
                    await sock.sendMessage(from, { text: `⚠️ Este resultado de missão já foi salvo anteriormente.` }, { quoted: msg });
                } else {
                    console.error("[ERRO saveMissaoConcluida]", e);
                    await sock.sendMessage(from, { text: '❌ Erro interno ao salvar a missão no DB. Verifique os logs.' }, { quoted: msg });
                }
            }
            return;
        }
        // --- FIM DA NOVA LÓGICA ---

        // case '!vermissoes': {
        //     // TODO: Adicionar a lógica do vermissoes.js aqui
        //     return;
        // }
    }
}

module.exports = { handlerDIJ, isUserInBatchMode };