/*
 * ARQUIVO: src/routes.js
 * * Responsabilidade: Mapear as "condições" (comandos)
 * para as "ações" (handlers) corretas.
 */

// 1. Importa handlers com caminhos corrigidos (tudo minúsculo)
const { handlerRecrutamento } = require('./handlers/recrutamentoHandler');
const { handlerDIJ, isUserInBatchMode } = require('./handlers/dijHandler');
const { handerInfos } = require('./handlers/infosHandler');


// Importa o parser (necessário para a detecção)
const config = require('./configs/ids-groups.json');

const commandRoutes = [
    {
        // --- ESTA É A ROTA DE RECRUTAMENTO CORRETA ---
        name: 'Handler de Recrutamento',
        description: 'Processa todos os comandos de admin E fichas de novatos nos grupos de recrutamento.',
        category: 'Recrutamento',
        condition: (_msg, remoteJid, _text) => config.allowedRecruitmentGroups.includes(remoteJid),

        action: handlerRecrutamento
    },
    {
        // --- ROTA DE DEBUG (MANTIDA) ---
        name: 'Debug: Get Group ID',
        condition: (_msg, _remoteJid, text) => text === '!mygroupid',
        action: async (sock, msg) => {
            await sock.sendMessage(msg.key.remoteJid, { text: `ID deste grupo: ${msg.key.remoteJid}` }, { quoted: msg });
        }
    },
    {
        // --- ROTA DE DEBUG (MOSTRAR groupMetadata) ---
        name: 'Debug: Group Metadata',
        condition: (_msg, _remoteJid, text) => text === '!groupmeta',
        action: async (sock, msg) => {
            const groupId = msg.key.remoteJid;

            if (!groupId.endsWith('@g.us')) {
                await sock.sendMessage(groupId, { text: '❌ Este comando só funciona em grupos.' }, { quoted: msg });
                return;
            }

            try {
                const meta = await sock.groupMetadata(groupId);
                await sock.sendMessage(groupId, { text: '🧩 *Group Metadata:*\n```' + JSON.stringify(meta, null) + '```' }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(groupId, { text: `❌ Erro ao buscar metadata: ${err.message}` }, { quoted: msg });
                console.error('[Debug:GroupMeta]', err);
            }
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
            if (lowerText.startsWith('!iniciarsalvamento') ||
                lowerText.startsWith('!encerrarsalvamento') ||
                lowerText.startsWith('!vermissoes') ||
                lowerText.startsWith('!vermissao') ||
                lowerText.startsWith('!verm')) {
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
    {
        name: 'Rota de Informações Gerais para Grupos de Vila',
        description: 'Processa comandos gerais em grupos de vila.',
        condition: (_msg, remoteJid, _text) => config.allowedVillageGroups.includes(remoteJid),
        action: handerInfos
    }
];

module.exports = { commandRoutes };