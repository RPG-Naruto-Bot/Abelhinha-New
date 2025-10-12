// Core / Libs
const {
    DisconnectReason,
    makeWASocket,
    useMultiFileAuthState
} = require('baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');

const { routeMessages } = require('./messageRouter.js');

function startBot() {
    async function connectToWhatsApp() {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        const sock = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (qr) {
                console.log('💡 Autenticação necessária! Escaneie o QR Code abaixo:');
                try {
                    const qrcode = require('qrcode-terminal');
                    qrcode.generate(qr, { small: true });
                } catch (err) {
                    console.error('Erro ao gerar QR Code:', err);
                }
            }

            if (connection === 'close') {
                const boomError = new Boom(lastDisconnect?.error);
                const statusCode = boomError.output.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('❌ Sessão desconectada. Por favor, autentique novamente.');
                } else {
                    console.log(`❌ Conexão fechada. Razão: ${boomError.message} (Código: ${statusCode})`);
                }
            } else if (connection === 'open') {
                console.log('✅ Conectado ao WhatsApp com sucesso!');
            }
         });

        sock.ev.on('creds.update', saveCreds);
        console.log('🤖 Iniciando o bot...');

        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            const sender = msg.key.participant || msg.key.remoteJid; // Pode ser grupo ou individual
            try {
                await routeMessage(sock, msg);
            } catch (err) {
                console.error(`[❌ ERRO] Falha ao processar mensagem de ${sender}:`, err);
            }
        });
    }
    connectToWhatsApp();
}

startBot();