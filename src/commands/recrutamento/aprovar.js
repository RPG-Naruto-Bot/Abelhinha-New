// src/commands/recrutamento/approve.js
// Versão simplificada: Apenas registra, salva e remove.

const parser = require('../../../utils/parser.js'); // Sobe 2 níveis
const db = require('../../../utils/database.js'); // Sobe 2 níveis
const moment = require('moment-timezone');

// Função auxiliar VCard (mantida)
function gerarVCardFallback(nome, numero) {
    const tel = (numero || '').replace(/[^0-9]/g, '');
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${nome || ''}`];
    if (tel) lines.push(`TEL;TYPE=CELL:${tel}`);
    lines.push('END:VCARD');
    return lines.join('\n');
}

/**
 * Lógica de APROVAÇÃO AUTOMÁTICA (Modo Try)
 * Esta função recebe a PRÓPRIA MENSAGEM DA FICHA do novato.
 */
async function executarAprovarAutomatico(sock, msg) {
    const from = msg.key.remoteJid; // JID do Grupo
    let nomeParaLogs = "Novato (erro no parse)"; // Fallback para o catch

    // O 'TRY' COMEÇA AQUI, NO TOPO DA FUNÇÃO
    try {
        // 1. OBTER O JID DO NOVATO (que é o autor desta mensagem)
        const novatoLid = msg.key.participant;
        if (!novatoLid) {
            throw new Error("Falha automática: Não foi possível identificar o autor da ficha.");
        }

        // 2. BUSCAR METADADOS PARA ENCONTRAR O NÚMERO REAL
        const metadata = await sock.groupMetadata(from);
        const participantInfo = metadata.participants.find(p => p.id === novatoLid);

        const novatoJid = participantInfo?.phoneNumber; // O número real!
        
        // *** A SUA VERIFICAÇÃO, AGORA DENTRO DO TRY ***
        if (!novatoJid) {
            // Isso agora joga o erro DIRETAMENTE para o 'catch' lá embaixo
            throw new Error(`Falha automática: O usuário @${novatoLid.split('@')[0]} já saiu do grupo.`);
        }
        const numeroLimpo = novatoJid.split('@')[0];

        // 3. PARSEAR A FICHA
        const textoFicha = parser.extractText(msg.message);
        const dadosParseados = parser.parseFicha(textoFicha);
        if (dadosParseados.error) {
            // Isso também joga o erro DIRETAMENTE para o 'catch'
            throw new Error(`Falha automática: ${dadosParseados.error}`);
        }
        
        // Se o parse funcionou, atualizamos o nome para o log
        nomeParaLogs = dadosParseados.nome || "Nome não encontrado";

        // 4. SALVAR NO BANCO DE DADOS
        const dadosParaSalvar = {
            nome: dadosParseados.nome,
            cla: dadosParseados.cla,
            emojiCla: dadosParseados.emojiCla,
            recrutadoPorTexto: dadosParseados.recrutadoPorTexto || 'Não informado',
            registradoPorJid: "AUTOMÁTICO",
            data: moment().tz('America/Sao_Paulo').format('DD/MM/YYYY'),
            timestamp: Date.now(),
            vcard: gerarVCardFallback(dadosParseados.nome, numeroLimpo)
        };
        
        // ----------------------------------------------------
        //      INÍCIO DO FLUXO SÍNCRONO (QUE JÁ ESTAVA OK)
        // ----------------------------------------------------

        // 5. SALVAR NO BANCO DE DADOS
        await db.saveFicha(novatoJid, dadosParaSalvar);

        // 6. AVISAR SOBRE A REMOÇÃO
        await sock.sendMessage(from, { text: `ℹ️ Removendo @${novatoLid.split('@')[0]} do grupo...`, mentions: [novatoLid] });

        // 7. REMOVER NOVATO DO GRUPO
        await sock.groupParticipantsUpdate(from, [novatoLid], 'remove');

        // 8. REAGIR À MENSAGEM ORIGINAL
        await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        // 9. ENVIAR FEEDBACK FINAL
        await sock.sendMessage(from, {
            text: `✅ Ficha processada e aprovada automaticamente!`
        });

    } catch (erro) {
        // AGORA ESTE CATCH PEGA *QUALQUER* ERRO DA FUNÇÃO
        console.error(`Falha grave no processo síncrono da ficha [${nomeParaLogs}]:`, erro);

        // Avisa no grupo EXATAMENTE o que deu errado (seja do parser, do usuário que saiu, etc.)
        await sock.sendMessage(from, {
            text: `❌ Ops! Ocorreu um erro ao processar a ficha.\n\n*Motivo:* ${erro.message}`
        });
    }
}

module.exports = { executarAprovarAutomatico };