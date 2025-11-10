/*
 * ARQUIVO: src/Handlers/dijHandler.js
 * ...
 * v2.6 - Refatorado para usar o wrapper 'withAdminPermission' (lógica "lambda")
 * e a validação por âncoras 🔻/🔺.
 */

const db = require('../../utils/database.js'); 
// --- MUDANÇA: Importa o novo wrapper ---
const { withAdminPermission } = require('../../utils/common.js'); 
const parser = require('../../utils/parser.js');

// --- 1. Armazenamento de Estado (Modo de Lote) ---
const batchSaveMode = new Map();
const BATCH_TIMEOUT_MS = 5 * 60 * 1000;

// --- VALIDAÇÃO POR ÂNCORA (v2.6 - Ideia do Ky) ---
const MISSION_ANCHOR_1 = "🔻";
const MISSION_ANCHOR_2 = "🔺";
// --- FIM ---


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

/**
 * Verifica se um usuário específico está no modo de salvamento em lote.
 */
function isUserInBatchMode(userJid) {
    return batchSaveMode.has(userJid);
}


/**
 * O Handler Principal da DIJ
 */
async function handlerDIJ(sock, msg, text) {
    const from = msg.key.remoteJid;
    const userJid = msg.key.participant || msg.key.remoteJid; 
    const commandName = text.split(' ')[0].toLowerCase();
    const args = text.split(' ').slice(1);
    
    // --- 1. Modo de Lote (Batch Mode) ---
    if (batchSaveMode.has(userJid)) {
        
        if (commandName === '!encerrarsalvamento') {
            stopBatchSave(sock, from, userJid, "Salvamento em cascata encerrado manualmente.");
            return;
        }

        // --- VALIDAÇÃO ATUALIZADA (v2.6) ---
        // Limpa formatação E caracteres invisíveis (incluindo \uFE0F)
        const cleanText = text.replace(/\*|_|~|`|\0|\u200B|\uFE0F/g, ''); 
        const isMissionResult = cleanText.includes(MISSION_ANCHOR_1) && 
                                cleanText.includes(MISSION_ANCHOR_2);
        // --- FIM DA VALIDAÇÃO ---

        if (isMissionResult) {
            try {
                await db.saveMissaoConcluida(text, userJid); 
                await sock.sendMessage(from, { react: { text: '💾', key: msg.key } }); 
            } catch (e) {
                if (e.message === 'DUPLICATE') {
                    console.warn(`[Handler DIJ] Missão duplicada ignorada (enviada por ${userJid}).`);
                    await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } }); 
                } else {
                    console.error("[ERRO saveMissaoConcluida]", e);
                    await sock.sendMessage(from, { text: `❌ Erro ao salvar esta missão em cascata. @${userJid.split('@')[0]} ainda está no modo de salvamento.`, mentions: [userJid] }, { quoted: msg });
                }
            }
        } else {
            console.log(`[Handler DIJ] Mensagem aleatória ignorada (sem âncora 🔺🔻): ${text.substring(0, 20)}...`);
            await sock.sendMessage(from, { react: { text: '❓', key: msg.key } }); 
        }
        return; 
    }

    // --- 2. Comandos Únicos (Agora usam o Wrapper) ---
    
    switch (commandName) {
        
        // --- COMANDO !iniciarsalvamento REFATORADO ---
        case '!iniciarsalvamento': {
            // Chama o wrapper e passa a lógica do comando como uma "lambda" (arrow function)
            await withAdminPermission(sock, msg, async () => {
                
                // O código aqui dentro SÓ roda se o usuário FOR admin
                if (batchSaveMode.has(userJid)) {
                    await sock.sendMessage(from, { text: '⚠ Você já está no modo de salvamento em cascata.' }, { quoted: msg });
                    return;
                }
                const timerId = setTimeout(() => {
                    stopBatchSave(sock, from, userJid, "Timeout de 5 min atingido.");
                }, BATCH_TIMEOUT_MS);
                batchSaveMode.set(userJid, timerId);
                console.log(`[Handler DIJ] Modo de salvamento iniciado para ${userJid}.`);
                await sock.sendMessage(from, { 
                    text: `✅ Modo de salvamento em cascata ATIVADO para @${userJid.split('@')[0]} por 5 minutos.\n\nEnvie as mensagens de resultado das missões. O bot salvará (💾) as válidas e ignorará (❓) as outras.\n\nDigite *!encerrarsalvamento* quando terminar.`,
                    mentions: [userJid]
                });
            }); // Fim do wrapper 'withAdminPermission'
            return;
        }

        // --- COMANDO !salvarmissao REFATORADO ---
        case '!salvarmissao': {
            await withAdminPermission(sock, msg, async () => {
                console.log("[Handler DIJ] Detectado comando !salvarmissao (Modo Único).");
                
                const ctx = msg.message?.extendedTextMessage?.contextInfo;
                const quoted = ctx?.quotedMessage;
                const adminJid = msg.key.participant || msg.key.remoteJid;
                let textoBruto = '';
                
                // Lógica Dual-Mode
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
                
                // --- VALIDAÇÃO ATUALIZADA (v2.6) ---
                const cleanText = textoBruto.replace(/\*|_|~|`|\0|\u200B|\uFE0F/g, '');
                const isMissionResult = cleanText.includes(MISSION_ANCHOR_1) && 
                                        cleanText.includes(MISSION_ANCHOR_2);
                // --- FIM DA VALIDAÇÃO ---

                if (!isMissionResult) {
                    await sock.sendMessage(from, { text: '❌ Texto inválido. A mensagem não parece ser um resultado de missão (falta o cabeçalho 🔺...🔻).' }, { quoted: msg });
                    return;
                }

                // Salva no Banco de Dados
                try {
                    await db.saveMissaoConcluida(textoBruto, adminJid);
                    await sock.sendMessage(from, { react: { text: '💾', key: msg.key } }); 
                    await sock.sendMessage(from, { text: `✅ 1 Resultado de missão (Modo Único) salvo no depósito.` }, { quoted: msg });
                } catch (e) {
                    if (e.message === 'DUPLICATE') {
                        await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } }); 
                        await sock.sendMessage(from, { text: `⚠️ Este resultado de missão já foi salvo anteriormente.` }, { quoted: msg });
                    } else {
                        // Lança o erro para o wrapper 'withAdminPermission' tratar
                        throw e; 
                    }
                }
            }); // Fim do wrapper 'withAdminPermission'
            return;
        }

        // --- COMANDO !vermissoes REFATORADO ---
        case '!vermissoes':
        case '!vermissao':
        case '!verm':
        {
            await withAdminPermission(sock, msg, async () => {
                // A lógica do 'executarVerMissoes' vai aqui
                
                // 1. Define o limite (quantos mostrar)
                let limit = 5; // Padrão
                if (args.length > 0 && !isNaN(parseInt(args[0]))) {
                    limit = parseInt(args[0]);
                }
                if (limit > 20) limit = 20;
                if (limit <= 0) limit = 1;

                // 2. Busca no Banco de Dados
                const missoesArray = await db.getMissoesConcluidas(limit);

                if (!missoesArray || missoesArray.length === 0) {
                    await sock.sendMessage(from, { text: 'ℹ️ O depósito de missões está vazio.' }, { quoted: msg });
                    return;
                }

                // 3. Formata a Resposta
                let resposta = `📦 *Últimos ${missoesArray.length} Resultados Salvos no Depósito:*\n\n`;
                const mencoes = [];
                for (const missao of missoesArray) {
                    const previewTexto = missao.texto_bruto.substring(0, 50).replace(/\n/g, ' ');
                    resposta += `*ID:* ${missao.id}\n`;
                    resposta += `*Data:* ${missao.data_registro}\n`;
                    if (missao.admin_jid) {
                        const adminNum = missao.admin_jid.split('@')[0];
                        resposta += `*Admin:* @${adminNum}\n`;
                        mencoes.push(missao.admin_jid);
                    }
                    resposta += `*Preview:* ${previewTexto}...\n`;
                    resposta += `--------------------------------\n`;
                }
                
                await sock.sendMessage(from, { text: resposta, mentions: [...new Set(mencoes)] }, { quoted: msg });

            }); // Fim do wrapper 'withAdminPermission'
            return;
        }
    }
}

module.exports = { 
    handlerDIJ,
    isUserInBatchMode 
};