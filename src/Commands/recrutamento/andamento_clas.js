/*
 * ARQUIVO: commands/recrutamento/andamento_clas.js
 * * Implementa a História 2.3: /andamento clas
 */
const db = require('../../utils/database');

module.exports = {
    name: 'andamento',
    description: 'Mostra o andamento do recrutamento.',
    aliases: ['andamentoclas', 'andamento-clas'],
    scope: 'recruitment',
    
    execute: async (sock, msg, args) => {
        const info = msg;
        const from = info.key.remoteJid;

        // Verifica se o sub-comando é 'clas'
        if (args[0]?.toLowerCase() !== 'clas') return;

        // TODO: Adicionar verificação de Admin (isAdm)

        const fichas = db.getAllFichas();
        const fichasArray = Object.values(fichas);
        
        if (fichasArray.length === 0) {
            await sock.sendMessage(from, { text: 'ℹ️ Nenhuma ficha foi processada ainda.' }, { quoted: info });
            return;
        }

        const contagem = {};
        for (const ficha of fichasArray) {
            const cla = ficha.cla || 'Sem Clã';
            contagem[cla] = (contagem[cla] || 0) + 1;
        }

        let resposta = '📊 *Andamento do Recrutamento por Clã*\n\n';
        
        // Ordena por contagem (do maior para o menor)
        const clasOrdenados = Object.entries(contagem)
            .sort(([, a], [, b]) => b - a);

        for (const [cla, total] of clasOrdenados) {
            const emoji = fichasArray.find(f => f.cla === cla)?.emojiCla || '❓';
            resposta += `${emoji} *${cla}:* ${total} recrutas\n`;
        }
        
        resposta += `\n*Total:* ${fichasArray.length} fichas processadas.`;

        await sock.sendMessage(from, { text: resposta }, { quoted: info });
    }
};