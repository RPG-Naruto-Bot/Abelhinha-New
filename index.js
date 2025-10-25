// index.js
/* Ponto de entrada principal do bot WhatsApp.
   v1.8 - Simplificado: Força Pairing Code, sem Browser ID
*/
const {
    DisconnectReason,
    makeWASocket,
    useMultiFileAuthState
} = require('baileys');
const pino = require('pino');

const { routeMessage } = require('./messageRouter.js');
require('dotenv').config(); 
const phoneNumber = process.env.PHONE_NUMBER; 

function startBot() {
    
    if (!phoneNumber || phoneNumber.length < 10) {
        console.error('❌ ERRO: PHONE_NUMBER não definido no .env!');
        process.exit(1);
    }
    let connecting = false;

    async function connectToWhatsApp() {
        if (connecting) return;
        connecting = true;
        console.log('🤖 Iniciando o bot...');
        try {
            const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

            const sock = makeWASocket({
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false, // Vamos lidar com o código manualmente
                auth: state,
                syncFullHistory: false,
                pairingCode: true 
            });

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect, qr } = update;
                console.log('connection.update ->', connection);

                if (qr) {
                    console.log('====================================');
                    console.log('⚠️ ATENÇÃO: A string abaixo PROVAVELMENTE NÃO é um QR Code válido para pareamento.');
                    console.log('Tentando exibir como QR Code (versão completa):');
                    
                    try {
                        qrcode = require('qrcode-terminal');
                        qrcode.generate(qr, {small:true}); 
                    } catch (err) {
                        console.error('Erro ao gerar QR Code:', err);
                        console.log('String recebida (não pôde ser convertida em QR):', qr);
                    }
                    
                    console.log('====================================');
                }
                if (connection === 'open') {
                    console.log('✅ Conectado ao WhatsApp com sucesso!');
                }

                if (connection === 'close') {
                    let statusCode = null;
                    try {
                        statusCode = lastDisconnect?.error?.output?.statusCode ?? lastDisconnect?.error?.statusCode;
                    } catch (e) { }

                    console.log('Conexão fechada. statusCode:', statusCode);

                    const shouldReconnect = (statusCode !== DisconnectReason.loggedOut);

                    if (shouldReconnect) {
                        const delay = statusCode === DisconnectReason.restartRequired ? 3000 : 5000;
                        console.log(`🔌 Conexão perdida (${statusCode}). Tentando reconectar em ${delay/1000}s...`);
                        setTimeout(() => {
                            connecting = false;
                            connectToWhatsApp();
                        }, delay);
                    } else {
                        console.log('❌ Sessão desconectada (401/loggedOut). Apague a pasta "auth_info_baileys" e reinicie.');
                        process.exit(1);
                    }
                }
            });
            sock.ev.on('messages.upsert', async (m) => {
                const msg = m.messages && m.messages[0];
                if (!msg || !msg.message || msg.key.remoteJid === 'status@broadcast') return;
                const sender = msg.key.participant || msg.key.remoteJid;
                try {
                    await routeMessage(sock, msg);
                } catch (err) {
                    console.error(`[❌ ERRO] Falha ao processar mensagem de ${sender}:`, err);
                }
            });

            console.log('⏳ Aguardando conexão...');
        } catch (err) {
            console.error('Erro na inicialização do socket:', err);
            console.log('🔌 Tentando reiniciar em 5s...');
            setTimeout(() => {
                connecting = false;
                connectToWhatsApp();
            }, 5000);
        } finally {
            connecting = false;
        }
    }

    connectToWhatsApp();
}

startBot();