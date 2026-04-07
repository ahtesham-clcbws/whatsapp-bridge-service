const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

async function test() {
    console.log('Testing WhatsApp connection...');
    const { state, saveCreds } = await useMultiFileAuthState('./test_auth');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr) {
            console.log('QR RECEIVED:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'open') {
            console.log('Connected!');
            process.exit(0);
        }
    });
}
test();
