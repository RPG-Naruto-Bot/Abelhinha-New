// messageRouter.js

/* 
    Aqui você pode definir a lógica para rotear e processar mensagens recebidas.
    Por exemplo, você pode encaminhar mensagens para diferentes manipuladores
    com base no conteúdo da mensagem, remetente, etc.
    Este arquivo ajuda a manter o código organizado e modular.
    Exemplo simples de roteamento de mensagens:  
*/
const { commandRoutes } = require('./src/routes.js');

// Função auxiliar para extrair texto de diferentes tipos de mensagens, a lógica ta boa, NAO MUDAR
function getMessageText(message) {
    // Usamos uma variável separada para não modificar o original desnecessariamente
    let unwrappedMessage = message;
    while (unwrappedMessage && unwrappedMessage.ephemeralMessage) {
        unwrappedMessage = unwrappedMessage.ephemeralMessage.message;
    }
    if (!unwrappedMessage) {
        return '';
    }
    const textContent =
        unwrappedMessage.extendedTextMessage?.text ||
        unwrappedMessage.videoMessage?.caption ||
        unwrappedMessage.imageMessage?.caption ||
        unwrappedMessage.conversation;

    const finalText = typeof textContent === 'string' ? textContent : ''

    return finalText;
}

async function routeMessage(sock, msg) {
    const text = getMessageText(msg.message);
    const remoteJid = msg.key.remoteJid;
    const senderJid = msg.key.participant || remoteJid;

    for (const route of commandRoutes) {
        if (route.condition(msg, remoteJid, text)) {
            await route.action(sock, msg, text); 
            // Esse console.log é apenas para fins de depuração
            console.log(`[ROTA ACIONADA] Handler: ${route.name} | JID: ${remoteJid} | Remetente: ${senderJid}`);
            break;
        }
    }
}
module.exports = { routeMessage };