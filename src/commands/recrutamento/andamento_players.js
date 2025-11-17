/*
 * ARQUIVO: commands/recrutamento/andamento_players.js
 * * Implementa a História 2.4: /andamento players
 */
const db = require('../../../utils/database');
const { parseAndamentoArgs } = require('./parsers.js');

module.exports = {
    name: 'andamento',
    description: 'Mostra o andamento do recrutamento por organizador.',
    aliases: ['andamentoplayers', 'andamento-players'],
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
            // Alterado para 'recrutadoPorTexto', como no seu 'registrar.js' original
            const recrutadorNome = ficha.recrutadoPorTexto || 'Não Informado';
            contagem[recrutadorNome] = (contagem[recrutadorNome] || 0) + 1;
        }

        // 4. Sua lógica de formatação (ótima!)
        let resposta = `📈 *Produtividade - Recrutadores (${periodTitle})*\n_(Quem indicou o recruta)_\n\n`;
        const adminsOrdenados = Object.entries(contagem).sort(([, a], [, b]) => b - a);
            
        for (const [nome, total] of adminsOrdenados) {
            resposta += `👥 *${nome}:* ${total} recrutas\n`;
        }
        
        resposta += `\n*Total:* ${fichasArray.length} fichas processadas no período.`;
        await sock.sendMessage(from, { text: resposta }, { quoted: info });
    }
};