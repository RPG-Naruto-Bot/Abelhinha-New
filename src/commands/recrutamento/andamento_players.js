/*
 * ARQUIVO: commands/recrutamento/andamento_players.js
 * * Implementa a História 2.4: /andamento players
 */
const db = require('../../utils/database');

module.exports = {
    name: 'andamento',
    description: 'Mostra o andamento do recrutamento por organizador.',
    aliases: ['andamentoplayers', 'andamento-players'],
    scope: 'recruitment',
    
    execute: async (sock, msg, args) => {
        const info = msg;
        const from = info.key.remoteJid;

        // Verifica se o sub-comando é 'players'
        if (args[0]?.toLowerCase() !== 'players') return;

        // TODO: Adicionar verificação de Admin (isAdm)

        const fichas = db.getAllFichas();
        const fichasArray = Object.values(fichas);
        
        if (fichasArray.length === 0) {
            await sock.sendMessage(from, { text: 'ℹ️ Nenhuma ficha foi processada ainda.' }, { quoted: info });
            return;
        }

        const contagem = {};
        for (const ficha of fichasArray) {
            const adminJid = ficha.registradoPorJid || 'Desconhecido';
            contagem[adminJid] = (contagem[adminJid] || 0) + 1;
        }

        let resposta = '📈 *Produtividade - Organizadores*\n\n';
        
        const adminsOrdenados = Object.entries(contagem)
            .sort(([, a], [, b]) => b - a);
            
        let mencoes = [];
        for (const [jid, total] of adminsOrdenados) {
            if (jid === 'Desconhecido') {
                resposta += `❓ *Desconhecido:* ${total} recrutas\n`;
            } else {
                const numero = jid.split('@')[0];
                resposta += `👤 @${numero}: *${total}* recrutas\n`;
                mencoes.push(jid);
            }
        }
        
        resposta += `\n*Total:* ${fichasArray.length} fichas processadas.`;

        await sock.sendMessage(from, { text: resposta, mentions: mencoes }, { quoted: info });
    }
};