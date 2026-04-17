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
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys');
const logger = require('./logger');
const qrcode = require('qrcode-terminal');
const { Boom } = require('@hapi/boom');
const { getDatabase, getSystemDatabase, getPendingQueue, deleteQueueItem, updateQueueItem } = require('./database');
const fs = require('fs');
const path = require('path');
const { notifyWebhook } = require('./webhook');
require('dotenv').config();

let sock;
let isConnected = false;
let latestQR = null;
let heartbeatInterval = null; 

/**
 * Intelligent Message Throttling & Queue Manager
 */
class MessageQueue {
    constructor() {
        this.isProcessing = false;
        this.maxRetries = parseInt(process.env.MAX_RETRIES) || 3;
    }

    /**
     * Enqueue a new message payload into SQLite
     */
    async enqueue(recipient, items, isPriority = false, auditId = null) {
        const sysDb = await getSystemDatabase();
        
        // PERFORMANCE FIX: Handle large buffers separately as BLOBs
        // This prevents JSON.stringify from creating massive memory-heavy strings
        let primaryBuffer = null;
        const sanitizedItems = items.map(item => {
            if (item.buffer && !primaryBuffer) {
                primaryBuffer = item.buffer;
                return { ...item, buffer: '##PRIMARY_BLOB##' };
            }
            return item;
        });

        return new Promise((resolve, reject) => {
            sysDb.run(
                `INSERT INTO pending_queue (recipient, payload, buffer, is_priority, audit_id) VALUES (?, ?, ?, ?, ?)`,
                [recipient, JSON.stringify(sanitizedItems), primaryBuffer, isPriority ? 1 : 0, auditId],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                }
            );
        }).then(id => {
            this.trigger();
            return id;
        });
    }

    /**
     * Kickstart the processing loop if not already running
     */
    async trigger() {
        if (this.isProcessing || !isConnected) return;
        this.isProcessing = true;
        this.work().catch(err => logger.error('Queue Worker Error:', err));
    }

    /**
     * Main Worker Loop
     */
    async work() {
        while (isConnected) {
            const pending = await getPendingQueue();
            if (pending.length === 0) {
                this.isProcessing = false;
                break;
            }

            const active = pending[0];
            try {
                await this.dispatch(active);
                await deleteQueueItem(active.id);
                
                // Update Audit Log to 'Sent' if audit_id exists
                if (active.audit_id) {
                    const db = await getDatabase();
                    db.run(`UPDATE audit_logs SET status = ? WHERE id = ?`, ['Sent', active.audit_id]);
                }

                // Intelligent Throttling logic
                const delay = this.calculateDelay(active);
                logger.info(`Queue: Message sent to ${active.recipient}. Throttling for ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            } catch (err) {
                logger.error(`Queue: Failed to process ID ${active.id}: ${err.message}`);
                const nextRetry = (active.retry_count || 0) + 1;
                
                if (nextRetry > this.maxRetries) {
                    logger.error(`Queue: ID ${active.id} exceeded max retries. Purging.`);
                    if (active.audit_id) {
                        const db = await getDatabase();
                        db.run(`UPDATE audit_logs SET status = ?, error = ? WHERE id = ?`, ['Failed', err.message, active.audit_id]);
                    }
                    await deleteQueueItem(active.id);
                } else {
                    await updateQueueItem(active.id, nextRetry, err.message);
                    await new Promise(r => setTimeout(r, 5000 * nextRetry)); // Backoff
                }
            }
        }
        this.isProcessing = false;
    }

    /**
     * Executes the actual Baileys send command
     */
    async dispatch(queueItem) {
        const items = JSON.parse(queueItem.payload);
        const jid = queueItem.recipient.includes('@') ? queueItem.recipient : `${queueItem.recipient.replace(/\D/g, '')}@s.whatsapp.net`;

        for (const item of items) {
            let messagePayload = {};
            const content = item.text || item.msg;
            const isPdf = (item.filename || '').toLowerCase().endsWith('.pdf');

            // PERFORMANCE FIX: Reconstruct Buffer from BLOB or JSON
            let dataBuffer = item.buffer;
            if (dataBuffer === '##PRIMARY_BLOB##') {
                dataBuffer = queueItem.buffer;
            } else if (dataBuffer && typeof dataBuffer === 'object' && dataBuffer.type === 'Buffer') {
                dataBuffer = Buffer.from(dataBuffer.data);
            }

            switch (item.type) {
                case 'image': messagePayload = { image: dataBuffer, caption: content }; break;
                case 'document': messagePayload = { 
                    document: dataBuffer, 
                    mimetype: isPdf ? 'application/pdf' : 'application/octet-stream', 
                    fileName: item.filename || 'document',
                    caption: item.text 
                }; break;
                case 'text': messagePayload = { text: content }; break;
                default: continue;
            }

            // [SYNC WARMUP] Send composing presence to force E2E key exchange
            try {
                await sock.sendPresenceUpdate('composing', jid);
                await new Promise(r => setTimeout(r, 1000)); // 1s buffer for key sync
            } catch (pErr) {
                logger.warn(`Presence update failed for ${jid}: ${pErr.message}`);
            }

            await sock.sendMessage(jid, messagePayload);
        }
    }

    /**
     * Calculates delay based on recipient type, priority, and time of day
     */
    calculateDelay(item) {
        if (item.is_priority) return 500; // Immediate priority lane

        const isGroup = item.recipient.endsWith('@g.us');
        let min = isGroup ? 5000 : 2000;
        let max = isGroup ? 12000 : 5000;

        // Human-Hour Simulation (1 AM - 6 AM)
        const hour = new Date().getHours();
        if (hour >= 1 && hour <= 6) {
            min *= 2;
            max *= 2;
        }

        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

const queue = new MessageQueue();

/**
 * @typedef {Object} BatchItem
 * @property {'text'|'image'|'document'} type - Content category.
 * @property {string} [text] - Caption or message body.
 * @property {Buffer} [buffer] - Binary data for media.
 * @property {string} [filename] - Original name for documents.
 */

// Initialize logger

const authDir = process.env.WHATSAPP_AUTH_DIR || './auth';

/**
 * Initializes the connection to WhatsApp.
 */
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info(`Starting WhatsApp Bridge with Baileys v${version.join('.')} [Latest: ${isLatest}]`);

    sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false,
        logger,
        browser: Browsers.macOS('Desktop'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // Diagnostic: See if the update is firing at all
        if (connection) logger.info(`Connection Status: ${connection}`);
        if (qr) {
            console.log('\n>>> NEW QR CODE RECEIVED - RENDER START >>>\n');
            latestQR = qr;
            qrcode.generate(qr, { small: true });
            console.log('\n<<< RENDER END <<<\n');
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
            
            // Kickstart the queue worker on connection
            queue.trigger();
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
        logger.trace({ updates }, '');
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

    /** DIAGNOSTIC LISTENERS **/
    sock.ev.on('messaging-history.set', (data) => logger.trace());
    sock.ev.on('presence.update', (data) => logger.trace());
    sock.ev.on('chats.update', (updates) => {
        const reduced = updates.map(u => ({ id: u.id, name: u.name, unread: u.unreadCount }));
        logger.trace();
    });

    /**
     * Heartbeat Logic: Ensures the socket stays active by performing
     * a light status check every 30 minutes (safely prevents stale connections).
     */
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(async () => {
        if (isConnected && sock) {
            try {
                // Perform a light query to verify socket health
                await sock.query({ tag: 'iq', attrs: { type: 'get', xmlns: 'w:p', to: '@s.whatsapp.net' }, content: [] });
                logger.info('Socket Heartbeat: Connection stable.');
                
                // Trigger Background Maintenance
                const { purgeExpiredData } = require('./database');
                purgeExpiredData();
            } catch (err) {
                logger.warn('Socket Heartbeat: Ping failed. Potential stale connection.');
            }
        }
    }, 30 * 60 * 1000);

    return sock;
}

/**
 * Sends a dynamic MFA authentication code to a specified recipient or the self account.
 * @param {string} code - The 6-digit OTP.
 * @param {string} [recipient] - Optional recipient JID or phone number.
 */
async function sendAuthCode(code, recipient = null) {
    if (!isConnected || !sock) throw new Error('WhatsApp not connected');
    
    // Default to self if no recipient provided
    const jid = recipient 
        ? (recipient.includes('@') ? recipient : `${recipient.replace(/\D/g, '')}@s.whatsapp.net`)
        : (sock.user.id.split(':')[0] + '@s.whatsapp.net');
    
    await sock.sendMessage(jid, { 
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
    logger.info(`[BRIDGE] sendBatch starting for ${recipient}`);
    if (!isConnected) throw new Error('WhatsApp not connected');

    const jid = recipient.includes('@') ? recipient : `${recipient.replace(/\D/g, '')}@s.whatsapp.net`;
    const db = await getDatabase();
    const maxRetries = parseInt(process.env.MAX_RETRIES) || 3;
    const retryDelays = [5000, 15000, 60000]; // 5s, 15s, 60s

    try {
        for (const item of items) {
            let messagePayload = {};
            
            const isPdf = (item.filename || '').toLowerCase().endsWith('.pdf');
            switch (item.type) {
                case 'text': messagePayload = { text: item.text }; break;
                case 'image': messagePayload = { image: item.buffer, caption: item.text }; break;
                case 'document': messagePayload = { 
                    document: item.buffer, 
                    mimetype: isPdf ? 'application/pdf' : 'application/octet-stream', 
                    fileName: item.filename || 'document',
                    caption: item.text 
                }; break;
                default: continue;
            }

            // [SYNC WARMUP] Send composing presence to force E2E key exchange
            try {
                await sock.sendPresenceUpdate('composing', jid);
                await new Promise(r => setTimeout(r, 1000)); // 1s buffer for key sync
            } catch (pErr) {
                logger.warn(`Presence update failed for ${jid}: ${pErr.message}`);
            }

            while (attempt <= maxRetries && !success) {
                try {
                    const sentMsg = await sock.sendMessage(jid, messagePayload);
                    logger.trace({ sentMsg }, '[BRIDGE] RAW DISPATCH RESPONSE');
                    success = true;
                    
                    if (logId) {
                        const db = await getDatabase();
                        db.run(`UPDATE audit_logs SET status = ?, whatsapp_id = ?, retry_count = ? WHERE id = ?`, 
                            ['Sent', sentMsg?.key?.id || 'ack', attempt, logId]);
                    }
                } catch (err) {
                    lastError = err;
                    attempt++;
                    if (attempt <= maxRetries) {
                        logger.warn(`[BRIDGE] Direct retry ${attempt} for ${recipient}: ${err.message}`);
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
    enqueue: (recipient, items, isPriority, auditId) => queue.enqueue(recipient, items, isPriority, auditId),
    getQueue: () => queue,
    getQueueStatus: () => ({ isProcessing: queue.isProcessing }),
    getAllGroups,
    getLatestQR: () => latestQR,
    getPairingCode,
    logoutSession,
    sendAuthCode,
    isWhatsAppConnected: () => isConnected
};

