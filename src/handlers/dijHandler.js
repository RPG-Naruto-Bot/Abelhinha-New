/*
 * ARQUIVO: src/Handlers/dijHandler.js
 * * Responsabilidade: Handler de Comandos para a Divisão de Inteligência de Jogo (DIJ).
 * Carrega e executa comandos da pasta src/commands/dij/.
 */

const fs = require('fs');
const path = require('path');
// Importa a função centralizada de verificação de admin (correto)
const { checkAdmin } = require('../../utils/common.js'); 

// Mapeia a pasta onde os comandos da DIJ estão
// Sobe dois níveis de 'Handlers' (para src) e desce para 'commands/dij'
const commandsDir = path.join(__dirname, '..', 'commands', 'dij');
const dijCommands = new Map();

// --- 1. Carregamento dos Comandos (Executado na inicialização) ---
function loadDIJCommands() {
    console.log('[Handler DIJ] Carregando comandos...');
    try {
        // Leitura de todos os arquivos .js na pasta de comandos
        const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            // Importa o módulo (o comando)
            const command = require(path.join(commandsDir, file));
            if (command.name) {
                // Adiciona o comando ao Map, usando o nome como chave
                dijCommands.set(command.name.toLowerCase(), command);
                console.log(`[Handler DIJ] Carregado: ${command.name}`);
            }
        }
    } catch (e) {
        console.error('[Handler DIJ] Erro ao carregar comandos:', e);
        // Tenta criar a pasta se ela não existir (útil para o primeiro deploy)
        try {
            fs.mkdirSync(commandsDir, { recursive: true });
        } catch (e2) {}
    }
}

loadDIJCommands(); // Carrega os comandos na inicialização

/**
 * O Handler Principal da DIJ (Divisão de Inteligência de Jogo)
 * Roteia a mensagem para o comando correto.
 */
async function handlerDIJ(sock, msg, text) {
    // Remove o prefixo '!' e pega o nome do comando
    const commandName = text.split(' ')[0].toLowerCase().replace('!', ''); 
    const args = text.split(' ').slice(1);

    const command = dijCommands.get(commandName);

    if (!command) {
        // Ignora se não for um comando conhecido da DIJ
        return; 
    }
    
    try {
        // Executa a função 'execute' do comando (ex: salvar_missao.js)
        await command.execute(sock, msg, args);
    } catch (error) {
        console.error(`[❌ ERRO DIJ] Falha ao executar comando ${commandName}:`, error);
        // Resposta de erro genérica
        await sock.sendMessage(msg.key.remoteJid, { text: `❌ Erro interno ao executar !${commandName}. Verifique os logs.` }, { quoted: msg });
    }
}

module.exports = { handlerDIJ };
