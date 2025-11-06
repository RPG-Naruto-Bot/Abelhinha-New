/*
 * ARQUIVO: src/routes.js
 * * Responsabilidade: Mapear as "condições" (comandos)
 * para as "ações" (handlers) corretas.
 */

// 1. Importa handlers com caminhos corrigidos (tudo minúsculo)
const { handlerRecrutamento } = require('./handlers/recrutamentoHandler');
const { handlerDIJ, isUserInBatchMode } = require('./handlers/dijHandler');

// Importa o parser (necessário para a detecção)
const parser = require('../utils/parser');
const config = require('./configs/ids-groups.json');

const commandRoutes = [
    // Rota de Detecção Automática (Responde Número)
    {
        name: 'Detector de Ficha',
        condition: (msg, remoteJid, text) => {
            return parser.detectarFicha(text);
        },

        action: async (sock, msg, text) => {
            // Ação de Responder o JID/Número
            const autorJid = msg.key.participant || msg.key.remoteJid;
            const numeroAutor = autorJid ? autorJid.split('@')[0] : 'desconhecido';
            await sock.sendMessage(msg.key.remoteJid, {
                text: `Número do autor da ficha: ${numeroAutor}`
            });
        }
    },
    {
        // --- ROTA DE RECRUTAMENTO (Fichas e Andamento) ---
        name: 'Funcoes de Recrutamento & Ajuda',

        condition: (msg, remoteJid, text) => {
            if (!text) return false;

            const lowerText = text.toLowerCase();
            return (
                // Comandos de Recrutamento (Fichas)
                lowerText.startsWith('!processar') ||
                lowerText.startsWith('!registrar') ||
                lowerText.startsWith('!andamento') ||
                lowerText.startsWith('!exportar') ||
                lowerText.startsWith('!menu') ||
                lowerText.startsWith('!ajuda') ||
                lowerText.startsWith('!comandos')
            );
        },
        action: handlerRecrutamento
    },
    {
        // --- ROTA DE DEBUG (MANTIDA) ---
        name: 'Debug: Get Group ID',
        condition: (msg, remoteJid, text) => text === '!mygroupid',
        action: async (sock, msg, text) => {
            await sock.sendMessage(msg.key.remoteJid, { text: `ID deste grupo: ${msg.key.remoteJid}` }, { quoted: msg });
        }
    },
    // --- ROTA DA DIJ ATUALIZADA ---
    {
        name: 'Funcoes da DIJ (Coleta de Dados Brutos)',
        condition: (msg, remoteJid, text) => {
             if (!remoteJid.endsWith('@g.us') || !config.allowedMissionFeedGroups.includes(remoteJid)) {
                 // Ignora se não for de um grupo de missão permitido
                 return false; 
             }
             
             if (!text) return false; // Ignora stickers, mídias sem legenda, etc.

             const lowerText = text.toLowerCase();
             const userJid = msg.key.participant || msg.key.remoteJid;

             // Condição 1: É um comando da DIJ?
             if (lowerText.startsWith('!iniciarsalvamento') || lowerText.startsWith('!encerrarsalvamento')) {
                 return true;
             }

             // Condição 2: NÃO é um comando, mas o usuário ESTÁ no modo de lote?
             if (isUserInBatchMode(userJid)) {
                 return true;
             }
             
             // Se não for um comando DIJ e o usuário não estiver em modo de lote, ignora.
             return false;
        },
        action: handlerDIJ
    },
];

module.exports = { commandRoutes };
