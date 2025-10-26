/*
 * ARQUIVO: src/routes.js
 * * Responsabilidade: Mapear as "condições" (comandos)
 * para as "ações" (handlers) corretas.
 *
 * ATUALIZADO: para rotear os comandos de recrutamento
 * para o handler correto.
 */

// 1. Importa o handler que contém TODA a lógica de recrutamento
const { handlerRecrutamento } = require('./handlers/recrutamentoHandler');

const commandRoutes = [

    {
        name: 'Funcoes de Recrutamento',

        /**
         * Condição: Checa se o texto da mensagem começa com algum
         * dos comandos do nosso módulo de recrutamento.
         */
        condition: (msg, remoteJid, text) => {
            if (!text) return false;

            const lowerText = text.toLowerCase();
            return (
                lowerText.startsWith('!processar') ||
                lowerText.startsWith('!registrar') ||
                lowerText.startsWith('!andamento') ||
                lowerText.startsWith('!exportar')  ||
                lowerText.startsWith('!menu')      ||
                lowerText.startsWith('!ajuda')     ||
                lowerText.startsWith('!comandos')
            );
        },
        /**
         * Ação: Se a condição for verdadeira, o roteador entrega
         * a mensagem (sock, msg, text) diretamente para o nosso handler.
         */
        action: handlerRecrutamento
    },
    {
        name: 'Debug: Get Group ID',
        condition: (msg, remoteJid, text) => text === '!mygroupid',
        action: async (sock, msg, text) => {
            await sock.sendMessage(msg.key.remoteJid, { text: `ID deste grupo: ${msg.key.remoteJid}`}, { quoted: msg });
        }
    },
    // ... Você pode adicionar outras rotas (outros módulos) aqui no futuro ...
];

module.exports = { commandRoutes };