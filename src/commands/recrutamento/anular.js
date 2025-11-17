// src/commands/recrutamento/anular.js

// 1. Importe seu arquivo de DB (confirme se este é o caminho certo)
// Vendo seus outros arquivos, o caminho para o DB deve ser algo assim:
const db = require('../../../utils/database.js');  

/**
 * Worker para o comando !anular <numero>
 * (O handler já verificou se o usuário é admin)
 */
async function executarAnularFicha(sock, msg, args) {
    const from = msg.key.remoteJid;
    const senderJid = msg.key.participant;

    // 1. OBTER O NÚMERO
    // 'args' é um array (ex: ["+55", "35", "9724-7537"])
    // 'args.join(" ")' junta eles de volta (ex: "+55 35 9724-7537")
    const numeroSujo = args.join(' ');

    if (!numeroSujo) {
        // Joga um erro que o handler.js vai pegar
        throw new Error('Formato incorreto. Use: `!anular <numero>`\n\nEx: `!anular +55 35 9724-7537`');
    }

    // 2. LIMPAR O NÚMERO
    // '.replace(/\D/g, '')' remove TUDO que não for dígito
    // (remove o '+', os espaços ' ' e o hífen '-')
    const numeroLimpo = numeroSujo.replace(/\D/g, ''); // Resultado: "553597247537"

    if (numeroLimpo.length < 10) {
        throw new Error('Número inválido. Forneça o número completo com DDI e DDD (ex: `+55 35...`)');
    }

    // 3. FORMATAR PARA JID
    const targetJid = `${numeroLimpo}@s.whatsapp.net`;

    // 4. EXECUTAR A LÓGICA DE ANULAÇÃO
    // O 'db.deleteFicha' vai dar 'reject' se não encontrar,
    // e o handler.js vai pegar esse erro.
    await db.deleteFicha(targetJid);
    
    // 5. FEEDBACK DE SUCESSO
    await sock.sendMessage(from, { 
        text: `✅ Ficha do usuário *${targetJid}* foi anulada e removida do banco de dados com sucesso.`,
        mentions: [senderJid] // Menciona o admin que executou
    });
}

module.exports = { executarAnularFicha };