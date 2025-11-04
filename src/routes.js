/*
 * ARQUIVO: src/routes.js
 * * Responsabilidade: Mapear as "condições" (comandos)
 * para as "ações" (handlers) corretas.
 */

// 1. Importa o handler que contém TODA a lógica de recrutamento
const { handlerRecrutamento } = require('./handlers/recrutamentoHandler.js');
const { handlerDIJ } = require('./handlers/dijHandler.js');

// Importa o parser (necessário para a detecção)
const parser = require('../utils/parser.js');
// Importa as configurações (para a Whitelist)
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
            await sock.sendMessage(msg.key.remoteJid, { text: `ID deste grupo: ${msg.key.remoteJid}`}, { quoted: msg });
        }
    },
    {
        // --- NOVA ROTA: DIVISÃO DE INTELIGÊNCIA DE JOGO (DIJ) ---
        name: 'Funcoes da DIJ (Coleta de Dados Brutos)',
        
        condition: (msg, remoteJid, text) => {
            if (!text) return false;
            const lowerText = text.toLowerCase();
            
            // Verifica se é o comando de salvar missão
            if (lowerText.startsWith('!salvarmissao')) {
                // --- VERIFICAÇÃO DE WHITELIST DE GRUPO (NOVA REGRA) ---
                // Verifica se é uma mensagem de grupo E se o ID do grupo está na lista de grupos de Missão (DIJ)
                if (remoteJid.endsWith('@g.us') && config.allowedMissionFeedGroups.includes(remoteJid)) {
                    return true;
                }
                // Log de rejeição para debug
                console.log(`[DIJ ROTA] Comando !salvarmissao negado: Grupo ${remoteJid} não está na Whitelist de Missões.`);
                return false; 
            }
            return false;
        },
        action: handlerDIJ // Chama o novo ROTEADOR DIJ
    }
];

module.exports = { commandRoutes };
