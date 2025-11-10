// src/handlers/recrutamentoHandler.js
const { checkAdmin } = require('../../utils/common.js');
const parser = require('../../utils/parser.js');

// Importa os "trabalhadores" da pasta de comandos
const { executarAprovarAutomatico } = require('../commands/recrutamento/aprovar.js');
const andamentoClasCmd = require('../commands/recrutamento/andamento_clas.js');
const andamentoPlayersCmd = require('../commands/recrutamento/andamento_players.js');
const { executarExportarContatos } = require('../commands/recrutamento/exportar.js');
const { executarProcessarManual } = require('../commands/recrutamento/registrar.js');
// const { executarMenuAdmin } = require('../commands/recrutamento/menu.js');

// Mapeia comandos (e aliases) para suas respectivas funções
const commandMap = {
    '!processar': executarProcessarManual,
    '!registrar': executarProcessarManual,
    '!andamento': async (sock, msg, args) => {
        const subComando = args[0]?.toLowerCase();
        if (subComando === 'clas') {
            return andamentoClasCmd.execute(sock, msg, args);
        }
        if (subComando === 'players') {
            return andamentoPlayersCmd.execute(sock, msg, args);
        }
        throw new Error('Comando inválido. Use:\n*!andamento clas*\n*!andamento players*');
    },
    '!exportar': executarExportarContatos,
    // '!menu': executarMenuAdmin,
    // '!ajuda': executarMenuAdmin,
};

/**
 * O Handler Principal de Recrutamento (O "Gerente")
 */
async function handlerRecrutamento(sock, msg, text) {
    const from = msg.key.remoteJid;
    const args = text.split(' ').slice(1);
    const command = text.split(' ')[0].toLowerCase();
    const isAdmin = await checkAdmin(sock, msg);

    // 5. ROTEAMENTO DE COMANDOS DE ADMIN
    const commandFn = commandMap[command];
    if (commandFn) {
        if (!isAdmin) {
            await sock.sendMessage(from, { text: '⚠ Apenas administradores podem usar este comando.' }, { quoted: msg });
            return;
        }
        try {
            await commandFn(sock, msg, args, text);
        } catch (err) {
            console.error(`Erro ao executar o comando ${command}:`, err);
            await sock.sendMessage(from, { text: `❌ ${err.message}` }, { quoted: msg });
        }
        return;
    }

    // 6. "MODO TRY" AUTOMÁTICO
    // Se não for um comando de admin, o bot checa se é uma ficha

    // 6a. Primeiro, verifica se o autor é admin. Se for, ignora (evita processar admins)
    if (isAdmin) return; 

    // 6b. Usa a sua função 'detectarFicha' para ver se vale a pena tentar
    if (parser.detectarFicha(text)) {
        try {
            console.log(`[Auto-Ficha] Detectou uma ficha. Tentando processar...`);
            // 6c. Chama o "Plano A" (o worker 100% automático)
            await executarAprovarAutomatico(sock, msg);

        } catch (err) {
            // 6d. Se a automação falhar, avisa os admins
            console.error(`[Auto-Ficha] Falha:`, err.message);
            // Reage à ficha com "⚠️" para sinalizar que precisa de ação manual
            await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } });

            // Busca o número correto (s.whatsapp.net)
            const groupMetadata = await sock.groupMetadata(from);
            const participant = groupMetadata.participants.find(
                p => p.id === msg.key.participant
            );
            const realJid = participant ? participant.phoneNumber : msg.key.participant;

            // Monta o texto e menciona
            await sock.sendMessage(from, {
                text: `🔔 *ALERTA ADMIN* 🔔\nFalha ao processar ficha de @${realJid.split('@')[0]}.\nMotivo: ${err.message}\n\nAção manual necessária com !processar.`,
                mentions: [realJid]
            }, { quoted: msg });
        }
    }
}

module.exports = { handlerRecrutamento };