// src/commands/recrutamento/anular.js

// 1. Importe seu arquivo de DB (confirme se este é o caminho certo)
// Vendo seus outros arquivos, o caminho para o DB deve ser algo assim:
const db = require('../../../utils/database.js');  

/**
 * Worker para o comando !anular
 * (O handler já verificou se o usuário é admin)
 */
async function executarAnularFicha(sock, msg, args) {
    const from = msg.key.remoteJid;
    const senderJid = msg.key.participant;

    // 1. OBTER O ALVO (via menção)
    const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentionedJid) {
        // Joga um erro que o handler.js vai pegar, formatar e enviar
        throw new Error('Formato incorreto. Você precisa *mencionar* o usuário cuja ficha será anulada.\n\nEx: `!anular @usuario`');
    }

    // 2. EXECUTAR A LÓGICA DE ANULAÇÃO
    // A função 'deleteFicha' vai jogar um erro se não encontrar o usuário,
    // e o handler.js vai pegar esse erro também.
    await db.deleteFicha(mentionedJid);
    
    // 3. FEEDBACK DE SUCESSO
    // O handler só envia feedback de erro, então
    // o feedback de sucesso é responsabilidade do comando.
    await sock.sendMessage(from, { 
        text: `✅ Ficha do usuário @${mentionedJid.split('@')[0]} foi anulada e removida do banco de dados com sucesso.`,
        mentions: [mentionedJid, senderJid] // Menciona o alvo e o admin
    });
}

module.exports = { executarAnularFicha };