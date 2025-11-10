/*
 * ARQUIVO: src/utils/common.js
 * * Responsabilidade: Armazenar funções utilitárias que são compartilhadas 
 * entre diferentes módulos do bot (Recrutamento, DIJ, etc.).
 */

/**
 * Verifica se o remetente da mensagem é um administrador do grupo.
 * @param {object} sock A instância do socket Baileys.
 * @param {object} msg A mensagem recebida (info).
 * @returns {Promise<boolean>} Retorna true se for admin ou superadmin, false caso contrário.
 */
const checkAdmin = async (sock, msg) => {
    const groupId = msg.key.remoteJid;
    if (!groupId || !groupId.endsWith('@g.us')) return false;

    let senderJid = msg.key.participant || msg.participant || null;

    // 🔹 Corrige o sufixo ":xx" que o Baileys adiciona em replies
    if (senderJid && senderJid.includes(':')) {
        senderJid = senderJid.split(':')[0] + '@s.whatsapp.net';
    }

    if (!senderJid) {
        console.warn('[checkAdmin] Não foi possível identificar o remetente real da mensagem.');
        return false;
    }

    try {
        const groupMetadata = await sock.groupMetadata(groupId);

        // 🔹 Busca compatível com a nova estrutura do Baileys (id @lid ou phoneNumber @s.whatsapp.net)
        const participantInfo = groupMetadata.participants.find(
            p => p.id === senderJid || p.phoneNumber === senderJid
        );

        if (!participantInfo) {
            console.warn(`[checkAdmin] Participante ${senderJid} não encontrado no grupo ${groupId}.`);
            return false;
        }

        const isAdmin = participantInfo.admin === 'admin' || participantInfo.admin === 'superadmin';
        return isAdmin;
    } catch (e) {
        console.error("[checkAdmin] ERRO ao buscar metadados ou verificar admin:", e.message || e);
        return false;
    }
};

// --- NOVA FUNÇÃO WRAPPER (A "LAMBDA") ---
/**
 * Executa uma função de callback (lógica do comando) somente se o usuário for admin.
 * Lida automaticamente com a mensagem de erro se não for admin.
 * @param {object} sock O socket Baileys.
 * @param {object} msg A mensagem (info).
 * @param {Function} commandLogic A função (lambda) a ser executada se o usuário for admin.
 */
const withAdminPermission = async (sock, msg, commandLogic) => {
    const from = msg.key.remoteJid;

    if (await checkAdmin(sock, msg)) {
        // 1. É Admin: Tenta executar a lógica do comando
        try {
            await commandLogic();
        } catch (error) {
            // 2. Erro na LÓGICA DO COMANDO
            console.error(`[withAdminPermission] Erro ao executar lógica de comando admin:`, error);
            try {
                await sock.sendMessage(from, { text: `❌ Erro interno ao executar o comando. Avise o Setor de TI.` }, { quoted: msg });
            } catch (e2) {
                console.error(`[withAdminPermission] Erro ao enviar mensagem de permissão negada:`, e2);
            }
        }
    } else {
        // 3. NÃO é Admin: Envia a mensagem de erro padrão
        try {
            await sock.sendMessage(from, { text: '⚠ Apenas administradores podem usar este comando.' }, { quoted: msg });
        } catch (e2) {
            console.error(`[withAdminPermission] Erro ao enviar mensagem de permissão negada:`, e2);
        }
    }
};
// --- FIM DA NOVA FUNÇÃO ---

module.exports = {
    checkAdmin,
    withAdminPermission // <-- Exporta o wrapper
};