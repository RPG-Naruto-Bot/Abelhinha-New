// Este arquivo contém a lógica de execução dos comandos.

// 1. Importa as 12 funções que criamos no 01_info.js
const {
    getKatana,
    getContrato,
    getRegrasLutas,
    getRegrasRpg,
    getRegrasParalisia,
    getCronogramaRPG,
    getCronogramaJuiz,
    getCronogramaMissao,
    getLoja,
    getCompraLoja,
    getBemVindo,
    getMenu,
    // ... importe todas as outras 9 funções aqui:
    // getCronogramaRPG, getLoja, etc.
} = require('../commands/respostas/loja.js'); // Ajuste o caminho conforme sua estrutura!

// 2. Cria o MAPEAMENTO de Comandos (A melhor prática de Código Limpo)
// Chave: O comando que o usuário digita (ex: '!katana')
// Valor: A função que o bot deve chamar para obter a resposta
const commandsMap = {
    '!katana': getKatana,
    '!contrato': getContrato,
    '!regraslutas': getRegrasLutas,
    '!regrasrpg': getRegrasRpg,
    '!regrasparalisia': getRegrasParalisia,
    '!cronogramarpg': getCronogramaRPG,
    '!cronogramajuiz': getCronogramaJuiz,
    '!cronogramamissao': getCronogramaMissao,
    '!loja': getLoja,
    '!compraloja': getCompraLoja,
    '!bemvindo': getBemVindo,
    '!menu': getMenu
    // ... adicione os outros 9 comandos aqui:
    // '!cronogramarpg': getCronogramaRPG,
    // '!loja': getLoja, etc.
    // O comando '!ficha' será tratado separadamente (veja a seção 4!)
};

/**
 * Função principal que processa todas as mensagens recebidas.
 * @param {object} sock - O objeto de conexão do WhatsApp.
 * @param {object} msg - O objeto da mensagem recebida.
 * @param {string} text - O texto da mensagem (limpo).
 */
async function processCommands(sock, msg, text) {
    const from = msg.key.remoteJid; // ID do grupo/chat
    const commandName = text.trim().toLowerCase(); // Limpa e padroniza o comando

    // --- 🚨 ETAPA ESPECIAL: O COMANDO !FICHA (veja a seção 4) ---
    if (commandName.startsWith('!ficha')) {
        // ... (Aqui virá o código do !ficha, que é mais complexo) ...
        // Por enquanto, vamos ignorá-lo para focar nos 11 comandos simples.
    }
    // -------------------------------------------------------------

    // 3. Verifica se o comando existe no nosso mapa
    const responseFn = commandsMap[commandName];

    if (responseFn) {
        // ✅ Se o comando existir (ex: !katana):
        
        console.log(`[BOT] Comando ${commandName} detectado em ${from}.`);

        // 4. Obtém a mensagem de resposta (deve ser um await se a função for async)
        // Usamos await por precaução, mesmo que as funções sejam síncronas.
        const responseText = await responseFn(); 

        // 5. ENVIA A RESPOSTA (Marcar a mensagem original é feito com { quoted: msg })
        await sock.sendMessage(from, 
            { text: responseText }, 
            { quoted: msg } // 👈 ISSO FAZ O BOT RESPONDER MARCANDO A MENSAGEM
        );
        
        return; // Finaliza o processamento
    }
    
    // Se a execução chegar aqui, significa que não era um dos 12 comandos.
}

module.exports = { processCommands }; // Exporta para ser usado no seu arquivo principal


