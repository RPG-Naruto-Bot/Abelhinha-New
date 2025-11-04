/*
 * ARQUIVO: src/commands/dij/salva_rmissao.js
 * * Responsabilidade: Lógica de execução do comando !salvarmissao.
 * Salva o texto bruto da mensagem de resultado da missão (via resposta) no DB.
 * Este é o ponto de entrada para a coleta de dados da DIJ.
 */

const db = require('../../../utils/database.js'); 
const parser = require('../../../utils/parser.js'); 
const { checkAdmin } = require('../../../utils/common.js'); // Importa a função centralizada


module.exports = {
    name: 'salvarmissao',
    description: 'Salva o texto bruto da missão para análise da DIJ.',
    
    execute: async (sock, info, args) => { 
        const from = info.key.remoteJid;
        
        try {
            // 1. Verificação de Admin (Usando a função centralizada)
            const isAdmin = await checkAdmin(sock, info);
            if (!isAdmin) {
                await sock.sendMessage(from, { text: '⚠ Apenas administradores podem usar este comando.' }, { quoted: info });
                return;
            }

            // 2. Extrair o texto (Deve ser uma resposta)
            const ctx = info.message?.extendedTextMessage?.contextInfo;
            const quoted = ctx?.quotedMessage;
            
            if (!quoted) {
                await sock.sendMessage(from, { text: '⚠ Por favor, use este comando respondendo à mensagem de resultado da missão (o texto bruto).' }, { quoted: info });
                return;
            }
            
            // Usa o parser para extrair o texto de forma robusta
            const textoBrutoMissao = parser.extractText(quoted).trim();

            if (textoBrutoMissao.length < 50) {
                await sock.sendMessage(from, { text: '⚠ O texto da missão parece muito curto. Certifique-se de responder ao resultado completo (mínimo 50 caracteres).' }, { quoted: info });
                return;
            }

            // O JID de quem usou o comando (o admin que está salvando)
            const adminJid = info.key.participant || info.key.remoteJid; 
            
            // 3. Salvar no Banco de Dados (Chamando a função 'depósito')
            await sock.sendMessage(from, { react: { text: '🛠️', key: info.key } });

            await db.saveMissaoConcluida(textoBrutoMissao, adminJid); 

            // 4. Feedback
            await sock.sendMessage(from, { react: { text: '✅', key: info.key } });
            await sock.sendMessage(from, { text: '✅ Resultado bruto da missão salvo com sucesso para análise da DIJ.' }, { quoted: info });

        } catch (err) {
            console.error("Erro em executarSalvarMissao:", err);
            await sock.sendMessage(from, { text: `❌ Ocorreu um erro interno ao salvar o resultado da missão.` }, { quoted: info });
        }
    }
};
