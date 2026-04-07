/**
 * WhatsApp Bridge Service - Core Handler
 * --------------------------------------
 * This module manages the connection to WhatsApp Web via the Baileys library.
 * It handles authentication, reconnection logic, and batch message dispatching.
 * 
 * @author Ahtesham
 * @license MIT
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
require('dotenv').config();

// Initialize pino-logger for efficient logging
const logger = pino({ level: 'info' });
const authDir = process.env.WHATSAPP_AUTH_DIR || './auth';

let sock;
let isConnected = false;
let latestQR = null;

/**
 * Initializes the connection to WhatsApp.
 * Handles the multi-file authentication state and creates the socket.
 */
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    logger.info(`Starting WhatsApp Bridge with Baileys v${version.join('.')}`);

    sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false, // QR is handled manually for potential remote access
        logger,
        browser: ['WhatsApp Bridge Service', 'Chrome', '1.1.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000
    });

    sock.ev.on('creds.update', saveCreds);

    // Monitor connection lifecycle events
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Capture QR code for terminal or remote display
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
            
            // Reconnect unless the user explicitly logged out
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            logger.error(`Connection closed (${statusCode}). Reconnecting: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 5000);
            }
        } else if (connection === 'open') {
            isConnected = true;
            latestQR = null;
            logger.info('WhatsApp connection established successfully!');
            
            // Send connection confirmation to self (internal verification)
            const selfJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            await sock.sendMessage(selfJid, { 
                text: '✅ *WhatsApp Bridge Service Connected Successfully!*\n\nThe headless dispatcher is now active and awaiting HTTP requests.' 
            });
        }
    });

    return sock;
}

/**
 * Generates an 8-digit pairing code for a phone number (Alternate login).
 * @param {string} phoneNumber - Destination number in E.164 format.
 * @returns {string} 8-character pairing code.
 */
async function getPairingCode(phoneNumber) {
    if (isConnected) throw new Error('Already connected');
    if (!sock) throw new Error('Socket not initialized');
    
    logger.info(`Requesting pairing code for ${phoneNumber}`);
    // Strip non-numeric characters
    const code = await sock.requestPairingCode(phoneNumber.replace(/\D/g, ''));
    return code;
}

/**
 * Log out from the current WhatsApp session and clear all local credentials.
 */
async function logoutSession() {
    if (sock) {
        await sock.logout();
        isConnected = false;
        latestQR = null;
        
        // Wipe the authentication directory for security
        if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
        }
        
        logger.info('Logged out. Session data deleted.');
        // Re-initialize to allow new pairing flow
        setTimeout(connectToWhatsApp, 2000);
    }
}

/**
 * Dispatches a sequence of messages (Text/Media) with randomized delays.
 * @param {string} number - Destination phone number.
 * @param {Array} items - List of items { type, text, buffer, filename }.
 * @param {number} logId - SQLite log ID for status tracking.
 */
async function sendBatch(number, items, logId) {
    if (!isConnected) throw new Error('WhatsApp not connected');

    const jid = `${number.replace(/\D/g, '')}@s.whatsapp.net`;
    const db = await getDatabase();

    try {
        for (const item of items) {
            let messagePayload = {};
            
            switch (item.type) {
                case 'text':
                    messagePayload = { text: item.text };
                    break;
                case 'image':
                    messagePayload = { 
                        image: item.buffer, 
                        caption: item.text 
                    };
                    break;
                case 'document':
                    messagePayload = { 
                        document: item.buffer, 
                        mimetype: 'application/octet-stream', 
                        fileName: item.filename || 'document',
                        caption: item.text 
                    };
                    break;
                default:
                    logger.warn(`Unsupported message type skipped: ${item.type}`);
                    continue;
            }

            await sock.sendMessage(jid, messagePayload);
            
            // Intelligent delay to prevent rate-limiting: 800ms - 1500ms
            const delay = Math.floor(Math.random() * 700) + 800;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Mark as successfully sent
        if (logId) {
            db.run(`UPDATE audit_logs SET status = ? WHERE id = ?`, ['Sent', logId]);
        }
    } catch (err) {
        logger.error(`Batch Dispatch Failed for ${number}:`, err);
        if (logId) {
            db.run(`UPDATE audit_logs SET status = ?, error = ? WHERE id = ?`, ['Failed', err.message, logId]);
        }
    }
}

module.exports = {
    connectToWhatsApp,
    sendBatch,
    getLatestQR: () => latestQR,
    getPairingCode,
    logoutSession,
    isWhatsAppConnected: () => isConnected
};
