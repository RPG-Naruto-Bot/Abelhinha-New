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

    // 1. OBTER O JID DO NOVATO (que é o autor desta mensagem)
    const novatoLid = msg.key.participant;
    if (!novatoLid) {
        throw new Error("Falha automática: Não foi possível identificar o autor da ficha.");
    }

    // 2. BUSCAR METADADOS PARA ENCONTRAR O NÚMERO REAL
    const metadata = await sock.groupMetadata(from);
    const participantInfo = metadata.participants.find(p => p.id === novatoLid);

    const novatoJid = participantInfo?.phoneNumber; // O número real!
    if (!novatoJid) {
        throw new Error(`Falha automática: O usuário ${novatoLid} já saiu do grupo.`);
    }
    const numeroLimpo = novatoJid.split('@')[0];

    // 3. PARSEAR A FICHA (usando seu parser global)
    // O parser.js já extrai o clã (pelo texto) e o emojiCla
    const textoFicha = parser.extractText(msg.message);
    const dadosParseados = parser.parseFicha(textoFicha);
    if (dadosParseados.error) {
        throw new Error(`Falha automática: ${dadosParseados.error}`);
    }

    // 4. SALVAR NO BANCO DE DADOS
    const dadosParaSalvar = {
        nome: dadosParseados.nome,
        cla: dadosParseados.cla,
        emojiCla: dadosParseados.emojiCla,
        recrutadoPorTexto: dadosParseados.recrutadoPorTexto || 'Não informado',
        registradoPorJid: "AUTOMÁTICO", // Identifica que foi o bot
        data: moment().tz('America/Sao_Paulo').format('DD/MM/YYYY'),
        timestamp: Date.now(),
        vcard: gerarVCardFallback(dadosParseados.nome, numeroLimpo)
    };
    try {
        // 1. SALVAR NO BANCO DE DADOS
        // (ESPERA o DB confirmar)
        await db.saveFicha(novatoJid, dadosParaSalvar);

        // 2. AVISAR SOBRE A REMOÇÃO
        // (ESPERA o WhatsApp enviar a msg)
        await sock.sendMessage(from, { text: `ℹ️ Removendo @${novatoLid.split('@')[0]} do grupo...`, mentions: [novatoLid] });

        // 3. REMOVER NOVATO DO GRUPO
        // (ESPERA o WhatsApp confirmar a remoção)
        await sock.groupParticipantsUpdate(from, [novatoLid], 'remove');

        // 4. REAGIR À MENSAGEM ORIGINAL
        // (ESPERA o WhatsApp confirmar a reação)
        await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        // 5. ENVIAR FEEDBACK FINAL
        // (ESPERA o WhatsApp enviar a msg final)
        await sock.sendMessage(from, {
            text: `✅ Ficha de *${dadosParaSalvar.nome}* (${dadosParaSalvar.cla} ${dadosParaSalvar.emojiCla}) processada e aprovada automaticamente!`
        });

    } catch (erro) {
        // SE QUALQUER ETAPA ACIMA FALHAR, ELE PULA PARA CÁ
        console.error("Falha grave no processo síncrono da ficha:", erro);

        // É crucial avisar no grupo que algo deu errado, 
        // já que o processo foi interrompido.
        await sock.sendMessage(from, {
            text: `❌ Ops! Ocorreu um erro no processamento da ficha de *${dadosParaSalvar.nome}*. O processo foi interrompido. Verifique o console.`
        });
    }
}

module.exports = { executarAprovarAutomatico };