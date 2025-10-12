// src/routes.js

/*
    Aqui você pode definir a lógica para rotear e processar mensagens recebidas.
    Por exemplo, você pode encaminhar mensagens para diferentes manipuladores
    com base no conteúdo da mensagem, remetente, etc.
    Este arquivo ajuda a manter o código organizado e modular.
    Exemplo simples de roteamento de mensagens:
*/

const { RecrutamentoHandler } = require('./handlers/recrutamentoHandler.js');

const commandRoutes = [
    {
        name: 'Funcoes de recrutamento',
        condition: (msg, remoteJid, text) => {
            return text && text.startsWith('!comando');
        },
        action: async (sock, msg, text) => {
            await sock.sendMessage(msg.key.remoteJid, { text: 'Você acionou o comando de texto!' });
        }
    },
    {
        name: 'Comando de Imagem',
        condition: (msg, remoteJid, text) => {
            return msg.message.imageMessage && text && text.startsWith('!imagem');
        },
        action: async (sock, msg, text) => {
            await sock.sendMessage(msg.key.remoteJid, { text: 'Você acionou o comando de imagem!' });
        }
    }
];

module.exports = { commandRoutes };

/*
    Usem os arquivos da pasta data para armazenar dados persistentes, como JSON.
    Como arzenar os clas e atribuir eles vilas, usem a logica que quiserem, mas mantenham os dados
*/