/**
 * WhatsApp Bridge Service - Core Handler [v3.0.0]
 * --------------------------------------------
 * Manages Baileys socket lifecycle, authentication, and multi-recipient dispatch.
 */

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { Boom } = require('@hapi/boom');
const { getDatabase } = require('./database');
const fs = require('fs');
const path = require('path');
const { notifyWebhook } = require('./webhook');
require('dotenv').config();

/**
 * @typedef {Object} BatchItem
 * @property {'text'|'image'|'document'} type - Content category.
 * @property {string} [text] - Caption or message body.
 * @property {Buffer} [buffer] - Binary data for media.
 * @property {string} [filename] - Original name for documents.
 */

// Initialize logger
const logger = pino({ level: 'info' });
const authDir = process.env.WHATSAPP_AUTH_DIR || './auth';

let sock;
let isConnected = false;
let latestQR = null;

/**
 * Initializes the connection to WhatsApp.
 */
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();
    
    logger.info(`Starting WhatsApp Bridge with Baileys v${version.join('.')}`);

    sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false,
        logger,
        browser: ['WhatsApp Bridge Service', 'Chrome', '1.1.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            latestQR = qr;
            console.log('\n--- SCAN THIS QR CODE WITH YOUR WHATSAPP ---\n');
            qrcode.generate(qr, { small: true });
            console.log('\n-------------------------------------------\n');
        }

        if (connection === 'close') {
            isConnected = false;
            latestQR = null;
            const statusCode = (lastDisconnect.error instanceof Boom) ? 
                lastDisconnect.error.output?.statusCode : 0;
            
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            logger.error(`Connection closed (${statusCode}). Reconnecting: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 5000);
            }
        } else if (connection === 'open') {
            isConnected = true;
            latestQR = null;
            logger.info('WhatsApp connection established successfully!');
            
            const selfJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            await sock.sendMessage(selfJid, { 
                text: '✅ *WhatsApp Bridge Service Connected!*\n\nGroup support and enhanced error handling are now active.' 
            });
        }
    });

    /**
     * Webhook Hook: Incoming Messages
     */
    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        for (const msg of m.messages) {
            if (msg.key.fromMe) continue; // Skip our own outbound status messages
            
            logger.info({ from: msg.key.remoteJid }, 'Incoming message received');
            notifyWebhook('message.received', {
                id: msg.key.id,
                remoteJid: msg.key.remoteJid,
                pushName: msg.pushName,
                message: msg.message,
                timestamp: msg.messageTimestamp
            });
        }
    });

    /**
     * Webhook Hook: Delivery Receipts & Status Updates
     */
    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            if (update.update.status) {
                const statusMap = { 1: 'Pending', 2: 'Sent', 3: 'Delivered', 4: 'Read', 5: 'Played' };
                const humanStatus = statusMap[update.update.status] || 'Unknown';
                
                logger.info({ id: update.key.id, status: humanStatus }, 'Delivery status updated');
                
                // Update Local Audit Log
                const db = await getDatabase();
                db.run(
                    `UPDATE audit_logs SET status = ? WHERE whatsapp_id = ?`, 
                    [humanStatus, update.key.id]
                );

                notifyWebhook('message.status', {
                    id: update.key.id,
                    status: humanStatus,
                    rawStatus: update.update.status,
                    remoteJid: update.key.remoteJid
                });
            }
        }
    });

    return sock;
}

/**
 * Sends a dynamic MFA authentication code to the connected WhatsApp account (Self-Message).
 * @param {string} code - The 6-digit OTP.
 */
async function sendAuthCode(code) {
    if (!isConnected || !sock) throw new Error('WhatsApp not connected');
    
    // The self JID is the connected number's ID
    const selfJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    await sock.sendMessage(selfJid, { 
        text: `🔐 *Bridge Dashboard Access*\n\nYour one-time login code is: *${code}*\n\n_If you did not request this, please check your server security._` 
    });
}

/**
 * Retrieves a list of all participating groups.
 * @returns {Promise<Array<{id: string, subject: string, participants: number}>>}
 */
async function getAllGroups() {
    if (!isConnected) throw new Error('WhatsApp not connected');
    const groups = await sock.groupFetchAllParticipating();
    return Object.values(groups).map(g => ({
        id: g.id,
        subject: g.subject,
        participants: g.participants.length
    }));
}

/**
 * Generates pairing code for remote login.
 * @param {string} phoneNumber 
 */
async function getPairingCode(phoneNumber) {
    if (isConnected) throw new Error('Already connected');
    if (!sock) throw new Error('Socket not initialized');
    return await sock.requestPairingCode(phoneNumber.replace(/\D/g, ''));
}

/**
 * Clears session and logs out.
 */
async function logoutSession() {
    if (sock) {
        await sock.logout();
        isConnected = false;
        latestQR = null;
        if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
        setTimeout(connectToWhatsApp, 2000);
    }
}

/**
 * Dispatches a sequence of messages to a JID (Individual or Group) with retry logic.
 * @param {string} recipient - Phone number or Group JID (@g.us).
 * @param {BatchItem[]} items - Payload sequence.
 * @param {number} logId - Audit log reference.
 */
async function sendBatch(recipient, items, logId) {
    if (!isConnected) throw new Error('WhatsApp not connected');

    const jid = recipient.includes('@') ? recipient : `${recipient.replace(/\D/g, '')}@s.whatsapp.net`;
    const db = await getDatabase();
    const maxRetries = parseInt(process.env.MAX_RETRIES) || 3;
    const retryDelays = [5000, 15000, 60000]; // 5s, 15s, 60s

    try {
        for (const item of items) {
            let messagePayload = {};
            
            switch (item.type) {
                case 'text': messagePayload = { text: item.text }; break;
                case 'image': messagePayload = { image: item.buffer, caption: item.text }; break;
                case 'document': messagePayload = { 
                    document: item.buffer, 
                    mimetype: 'application/octet-stream', 
                    fileName: item.filename || 'document',
                    caption: item.text 
                }; break;
                default: continue;
            }

            let attempt = 0;
            let success = false;
            let lastError = null;

            while (attempt <= maxRetries && !success) {
                try {
                    const sentMsg = await sock.sendMessage(jid, messagePayload);
                    success = true;
                    
                    if (sentMsg && logId) {
                        db.run(`UPDATE audit_logs SET status = ?, whatsapp_id = ?, retry_count = ? WHERE id = ?`, 
                            ['Sent', sentMsg.key.id, attempt, logId]);
                    }
                } catch (err) {
                    lastError = err;
                    attempt++;
                    
                    if (attempt <= maxRetries) {
                        logger.warn({ recipient, attempt, error: err.message }, 'Dispatch failed, retrying...');
                        if (logId) db.run(`UPDATE audit_logs SET retry_count = ? WHERE id = ?`, [attempt, logId]);
                        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt - 1] || 5000));
                    }
                }
            }

            if (!success) throw lastError;

            const delay = Math.floor(Math.random() * 700) + 800;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    } catch (err) {
        logger.error(`Dispatch Failed for ${recipient} after retries:`, err);
        if (logId) db.run(`UPDATE audit_logs SET status = ?, error = ? WHERE id = ?`, ['Failed', err.message, logId]);
    }
}

module.exports = {
    connectToWhatsApp,
    sendBatch,
    getAllGroups,
    getLatestQR: () => latestQR,
    getPairingCode,
    logoutSession,
    sendAuthCode,
    isWhatsAppConnected: () => isConnected
};

