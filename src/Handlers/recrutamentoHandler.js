// src/handlers/recrutamentoHandler.js

/*
    Aqui você pode definir a lógica para rotear e processar mensagens relacionadas a recrutamento.
    Este arquivo ajuda a manter o código organizado e modular.
    Exemplo simples de um handler de recrutamento:
*/

/* importem o que voces precisarem para o handler de recrutamento */

/* 
    Respondendo a ficha de recrutamento, use o comando
    !processar <numero> 

    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    quotedMsg.key.conversation vai ter a ficha de recrutamento
    implementar um regex pra filtrar dados e pegar só o que interessa
    addContact(nome, clan, numero) - função que cria o contato e salva no data/clas.json
*/

async function handlerRecrutamento(sock, msg, text) {
    // escreve aqui a lógica para lidar com mensagens de recrutamento
}

module.exports = { handlerRecrutamento };