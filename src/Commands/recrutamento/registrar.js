/*
 * ARQUIVO: commands/recrutamento/registrar.js
 * * Implementa a História 2.2: /registrar <número> (respondendo à ficha)
 */
const parser = require('../../utils/parser');
const db = require('../../utils/database');
const moment = require('moment-timezone');

module.exports = {
    name: 'registrar',
    description: 'Processa a ficha de um recruta respondendo a ela e informando o número.',
    aliases: ['processarficha', 'processar-ficha'],
    
    // O commandHandler usará isso para bloquear o comando
    // nos grupos errados (História 2.1)
    scope: 'recruitment', 
    
    execute: async (sock, msg, args) => {
        const info = msg;
        const from = info.key.remoteJid;

        // --- 1. Verificações Iniciais ---
        
        // TODO: Implementar a verificação de Admin (isAdm)
        // O ideal é o commandHandler injetar essa info na 'msg'
        // if (!info.isAdm) {
        //     await sock.sendMessage(from, { text: '⚠ Apenas administradores podem usar este comando.' }, { quoted: info });
        //     return;
        // }

        const ctx = info.message?.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage;
        
        if (!quoted) {
            await sock.sendMessage(from, { text: '⚠ Por favor, use este comando respondendo à mensagem da ficha do recruta.' }, { quoted: info });
            return;
        }

        // --- 2. Validar Argumentos (Número do Recruta) ---
        const numeroLimpo = (args[0] || '').replace(/[^0-9]/g, '');
        if (numeroLimpo.length < 8) { // Validação simples
            await sock.sendMessage(from, { text: '⚠ Você precisa informar um número de celular válido.\nEx: /registrar 5544912345678' }, { quoted: info });
            return;
        }
        const targetJid = `${numeroLimpo}@s.whatsapp.net`;
        const autorDaFichaJid = ctx.participant; // JID de quem enviou a ficha

        if (!autorDaFichaJid) {
             await sock.sendMessage(from, { text: '⚠ Não consegui identificar o autor da ficha. Tente novamente.' }, { quoted: info });
            return;
        }

        // --- 3. Processar a Ficha (Usando o Parser) ---
        await sock.sendMessage(from, { react: { text: '🛠️', key: info.key } });
        
        const textoFicha = parser.extractText(quoted);
        const dadosParseados = parser.parseFicha(textoFicha);

        if (dadosParseados.error) {
            await sock.sendMessage(from, { react: { text: '❌', key: info.key } });
            await sock.sendMessage(from, { text: `❌ Erro ao ler a ficha: ${dadosParseados.error}` }, { quoted: info });
            return;
        }

        // --- 4. Preparar Dados (Implementando História 2.4) ---
        const dadosParaSalvar = {
            nome: dadosParseados.nome,
            cla: dadosParseados.cla,
            emojiCla: dadosParseados.emojiCla,
            recrutadoPorTexto: dadosParseados.recrutadoPorTexto,
            // História 2.4: Salva QUEM fez o registro
            registradoPorJid: info.key.participant || info.key.remoteJid, 
            data: moment.tz('America/Sao_Paulo').format('DD/MM')
        };

        // --- 5. Salvar no Banco de Dados ---
        db.saveFicha(targetJid, dadosParaSalvar);

        // --- 6. Feedback e Ação Final (Remover) ---
        await sock.sendMessage(from, { react: { text: '✅', key: info.key } });
        await sock.sendMessage(from, { 
            text: `✅ Ficha de *${dadosParseados.nome}* processada com sucesso!\n*Número:* ${targetJid.split('@')[0]}` 
        }, { quoted: info });

        try {
            // Tenta remover o autor da ficha do grupo
            await sock.groupParticipantsUpdate(from, [autorDaFichaJid], 'remove');
        } catch (e) {
            console.error('Falha ao remover recruta:', e);
            await sock.sendMessage(from, { text: `⚠ Falha ao remover @${autorDaFichaJid.split('@')[0]} do grupo. (Talvez eu não seja admin?)`, mentions: [autorDaFichaJid] }, { quoted: info });
        }
    }
};