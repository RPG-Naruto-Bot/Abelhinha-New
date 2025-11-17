/*
 * ARQUIVO: commands/recrutamento/andamento_clas.js
 * * Implementa a História 2.3: /andamento clas
 */
const db = require('../../../utils/database');
const { parseAndamentoArgs } = require('./parsers.js');
const clasConfig = require('../../../src/configs/clas.json');

module.exports = {
    name: 'andamento',
    description: 'Mostra o andamento do recrutamento.',
    aliases: ['andamentoclas', 'andamento-clas'],
    scope: 'recruitment',
    execute: async (sock, msg, args) => {
        const info = msg;
        const from = info.key.remoteJid;
        // 1. Delega a análise de data para o parser
        const { startTimestamp, endTimestamp, periodTitle } = parseAndamentoArgs(args);

        // 2. Busca no DB com o filtro de data
        const fichasArray = await db.getFichasByTimestamp(startTimestamp, endTimestamp);
        
        if (fichasArray.length === 0) {
            await sock.sendMessage(from, { text: `ℹ️ Nenhuma ficha encontrada no período: ${periodTitle}` }, { quoted: info });
            return;
        }
        // 3. Sua lógica de contagem (já estava ótima)
        const contagem = {};
        for (const ficha of fichasArray) {
            const cla = ficha.cla || 'Sem Clã';
            contagem[cla] = (contagem[cla] || 0) + 1;
        }
        // 4. Sua lógica de formatação (ótima!)
        let resposta = `📊 *Andamento por Clã (${periodTitle})*\n\n`;
        const clasOrdenados = Object.entries(contagem).sort(([, a], [, b]) => b - a);
        for (const [cla, total] of clasOrdenados) {
            // Usa o clasConfig que você já tinha, mas com fallback
            const emoji = clasConfig[cla.toLowerCase()] || '❓';
            resposta += `${emoji} *${cla}:* ${total} recrutas\n`;
        }
        resposta += `\n*Total:* ${fichasArray.length} fichas processadas no período.`;
        await sock.sendMessage(from, { text: resposta }, { quoted: info });
    }
};