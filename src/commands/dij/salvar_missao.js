/*
 * ARQUIVO: src/commands/dij/salvarmissao.js
 * * Responsabilidade: Coletar dados brutos de missão (DIJ).
 *
 * v2.1 - ATUALIZADO COM VALIDAÇÃO (ANTI-LIXO)
 * - Agora verifica se o texto contém palavras-chave de missão
 * antes de salvar no banco de dados.
 */

const db = require('../../utils/database.js');
const parser = require('../../utils/parser.js');
const { checkAdmin } = require('../../utils/common.js');

// --- Palavras-chave de Validação ---
const MISSION_KEYWORDS = [
    "parabéns para os que concluíram",
    "total de ninjas",
    "recompensas"
];
// --- FIM ---

module.exports = {
    name: 'salvarmissao',
    description: 'Salva o resultado bruto (e validado) de uma missão no DB.',
    
    async execute(sock, info, args, text) {
        const from = info.key.remoteJid;

        // 1. Verifica se é Admin
        const isAdmin = await checkAdmin(sock, info);
        if (!isAdmin) {
            await sock.sendMessage(from, { text: '⚠ Apenas administradores podem usar este comando.' }, { quoted: info });
            return;
        }

        const ctx = info.message?.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage;
        const adminJid = info.key.participant || info.key.remoteJid;

        let textoBruto = '';
        let isReply = false;

        // --- LÓGICA DUAL-MODE ---
        if (quoted) {
            // Modo 1: Resposta
            isReply = true;
            textoBruto = parser.extractText(quoted);
        } else {
            // Modo 2: Manual (na mesma mensagem)
            isReply = false;
            const lines = text.split('\n');
            if (lines.length <= 1) {
                await sock.sendMessage(from, { 
                    text: '⚠ Formato inválido.\n\nUse este comando:\n1. *Respondendo* a UMA mensagem de resultado.\n2. *Colando* os resultados ABAIXO do comando `!salvarmissao`.' 
                }, { quoted: info });
                return;
            }
            textoBruto = lines.slice(1).join('\n');
        }
        // --- FIM DA LÓGICA ---

        // --- NOVA VALIDAÇÃO (ANTI-LIXO) ---
        if (!textoBruto || textoBruto.trim().length < 10) {
             await sock.sendMessage(from, { text: '❌ Não encontrei texto válido para salvar (mínimo 10 caracteres).' }, { quoted: info });
             return;
        }

        const lowerText = textoBruto.toLowerCase();
        const isMissionResult = MISSION_KEYWORDS.some(keyword => lowerText.includes(keyword));

        if (!isMissionResult) {
            await sock.sendMessage(from, { text: '❌ Texto inválido. A mensagem não parece ser um resultado de missão (faltam palavras-chave como "recompensas", "total de ninjas", etc.).' }, { quoted: info });
            return;
        }
        // --- FIM DA VALIDAÇÃO ---


        // 3. Salva no Banco de Dados
        try {
            await db.saveMissaoConcluida(textoBruto, adminJid);
            
            await sock.sendMessage(from, { react: { text: '💾', key: info.key } }); // Emoji de "Salvo"
            
            if (isReply) {
                 await sock.sendMessage(from, { text: `✅ 1 Resultado de missão (Respondido) salvo no depósito.` }, { quoted: info });
            } else {
                 await sock.sendMessage(from, { text: `✅ Resultados de missão (Modo Manual) salvos no depósito.` }, { quoted: info });
            }

        } catch (e) {
            console.error("[ERRO saveMissaoConcluida]", e);
            await sock.sendMessage(from, { text: '❌ Erro interno ao salvar a missão no DB. Verifique os logs.' }, { quoted: info });
        }
    }
};