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
    // Garante que só execute em grupos
    if (!groupId || !groupId.endsWith('@g.us')) {
        return false;
    }

    const senderJid = msg.key.participant || msg.key.remoteJid; // Quem enviou

    try {
        // Busca os metadados do grupo
        const groupMetadata = await sock.groupMetadata(groupId);
        
        // Encontra as informações do participante específico
        const participantInfo = groupMetadata.participants.find(p => p.id === senderJid);

        if (!participantInfo) {
            console.warn(`[checkAdmin] ALERTA: Não foi possível encontrar informações do participante ${senderJid} na lista do grupo.`);
            return false;
        }

        // A lógica de verificação (padrão Baileys)
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
            } catch (e2) {}
        }
    } else {
        // 3. NÃO é Admin: Envia a mensagem de erro padrão
        try {
            await sock.sendMessage(from, { text: '⚠ Apenas administradores podem usar este comando.' }, { quoted: msg });
        } catch (e2) {}
    }
};
// --- FIM DA NOVA FUNÇÃO ---

module.exports = {
    checkAdmin,
    withAdminPermission // <-- Exporta o wrapper
};