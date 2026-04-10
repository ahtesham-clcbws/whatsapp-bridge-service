/**
 * WhatsApp Bridge Service - API Server
 * ------------------------------------
 * This module provides a multipart/form-data HTTP interface to 
 * interact with the linked WhatsApp account. It handles multi-media 
 * uploads, batch sequencing, and session management.
 * 
 * @author Ahtesham
 * @license MIT
 */

const express = require('express');
const multer = require('multer');
const { 
    sendBatch, 
    isWhatsAppConnected, 
    getLatestQR, 
    getPairingCode, 
    logoutSession,
    getAllGroups
} = require('./whatsapp');
const { getRecentLogs, getDatabase } = require('./database');
const pino = require('pino');
require('dotenv').config();

const logger = pino({ level: 'info' });
const app = express();
const port = process.env.PORT || 3001;
const apiKey = process.env.API_KEY;

// Middleware: Multipart form handling for large attachments (In-Memory)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: process.env.MAX_FILE_SIZE || 50 * 1024 * 1024 }
});

// Middleware: Global body parsing (Forces JSON parsing even if headers are missing)
app.use(express.json({ type: () => true }));

/**
 * Security Middleware: Validates the request against the static API_KEY.
 */
const authMiddleware = (req, res, next) => {
    const providedKey = req.body?.apiKey || req.query.apiKey || req.headers['x-api-key'];
    
    // Debug Trace to catch why requests fail in middleware
    // logger.info({ method: req.method, path: req.path, hasBody: !!req.body, hasHeaderKey: !!req.headers['x-api-key'] }, 'Security Trace');

    if (!providedKey || providedKey !== apiKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API Key provided.' });
    }
    next();
};

// --- Session Management Endpoints ---

/**
 * Connectivity Check
 * GET /session/status
 */
app.get('/session/status', authMiddleware, (req, res) => {
    res.json({ connected: isWhatsAppConnected() });
});

/**
 * Fetch Current QR Code (Remote Pairing)
 * GET /session/qr
 */
app.get('/session/qr', authMiddleware, (req, res) => {
    const qr = getLatestQR();
    if (isWhatsAppConnected()) return res.json({ message: 'Already connected' });
    if (!qr) return res.status(404).json({ error: 'QR code not yet available. Wait a few seconds.' });
    res.json({ qr });
});

/**
 * Request Account Pairing Code (8-digit)
 * POST /session/pairing-code
 */
app.post('/session/pairing-code', authMiddleware, async (req, res) => {
    try {
        const { number } = req.body;
        if (!number) return res.status(400).json({ error: 'Phone number is required for pairing.' });
        
        const code = await getPairingCode(number);
        res.json({ code });
    } catch (err) {
        logger.error('Pairing Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Retrieve all Groups (ID + Name)
 * GET /session/groups
 */
app.get('/session/groups', authMiddleware, async (req, res) => {
    try {
        const groups = await getAllGroups();
        res.json(groups);
    } catch (err) {
        logger.error('Group Fetch Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Session Disconnect / Clear State
 * POST /session/logout
 */
app.post('/session/logout', authMiddleware, async (req, res) => {
    try {
        await logoutSession();
        res.json({ status: 'success', message: 'Session disconnected and cleared.' });
    } catch (err) {
        logger.error('Logout Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Audit Log Retreival
 * GET /logs
 */
app.get('/logs', authMiddleware, async (req, res) => {
    try {
        const logs = await getRecentLogs(50);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to access audit logs.' });
    }
});

/**
 * Service Heartbeat / Health Check
 */
app.get('/health', async (req, res) => {
    res.json({
        status: 'online',
        whatsapp: isWhatsAppConnected() ? 'connected' : 'disconnected',
        uptime: Math.floor(process.uptime()),
        version: '2.1.0',
        timestamp: new Date().toISOString()
    });
});

// --- Unified Messaging Endpoint ---

/**
 * Dispatch Hub
 * POST /send (Multipart/Form-Data or JSON)
 */
app.post('/send', authMiddleware, (req, res, next) => {
    // Only trigger multer if the request is multipart/form-data
    if (req.headers['content-type']?.includes('multipart')) {
        return upload.any()(req, res, next);
    }
    next();
}, async (req, res) => {
    try {
        // logger.info({ body: req.body, headers: req.headers }, 'Incoming dispatch request');

        if (!isWhatsAppConnected()) {
            return res.status(503).json({ error: 'Service unavailable. WhatsApp not linked.' });
        }

        // Support both JSON body and Multipart form fields
        const number = req.body.number || req.query.number;
        const types = req.body.type || req.query.type;
        const texts = req.body.text || req.query.text;
        const files = req.files || [];

        if (!number) return res.status(400).json({ error: 'Recipient identifier (number or @g.us JID) is mandatory.' });

        // Parsing logic to handle literal \n sequences often sent via HTTP clients
        const typeArr = Array.isArray(types) ? types : [types];
        const textArr = (Array.isArray(texts) ? texts : [texts]).map(t => 
            typeof t === 'string' ? t.replace(/\\n/g, '\n') : t
        );

        const batchItems = [];
        let fileIndex = 0;

        // Loop through the arrays and build the sequential queue
        for (let i = 0; i < typeArr.length; i++) {
            const currentType = typeArr[i];
            const currentText = textArr[i] || '';

            if (currentType === 'text') {
                batchItems.push({ type: 'text', text: currentText });
            } else {
                const currentFile = files[fileIndex++];
                if (!currentFile) continue;
                batchItems.push({ 
                    type: currentType, 
                    text: currentText, 
                    buffer: currentFile.buffer, 
                    filename: currentFile.originalname 
                });
            }
        }
        
        // Logging the dispatch attempt to SQLite (Current Week)
        const db = await getDatabase();
        db.run(
            `INSERT INTO audit_logs (recipient, status, type, metadata) VALUES (?, ?, ?, ?)`, 
            [number, 'Scheduled', typeArr.join(','), JSON.stringify({ count: batchItems.length })],
            function(err) {
                if (err) return logger.error('Audit Log Insertion Error:', err);
                
                // Process in background with log awareness
                sendBatch(number, batchItems, this.lastID).catch(err => 
                    logger.error('Async Batch Error:', err)
                );
            }
        );

        res.json({ status: 'success', message: 'Batch dispatch scheduled successfully.', recipient: number });
    } catch (err) {
        logger.error('API Server Error:', err);
        res.status(500).json({ error: 'Internal Bridge Failure.' });
    }
});

/**
 * Global Error Handler: Catches JSON parsing errors and middleware failures.
 */
app.use((err, req, res, next) => {
    logger.error({ err: err.message, stack: err.stack }, 'Global Request Error');
    res.status(err.status || 500).json({ 
        error: 'Middleware/Parser Error', 
        message: err.message 
    });
});

/**
 * Bootstraps the Express Server.
 */
function startServer() {
    app.listen(port, () => {
        logger.info(`WhatsApp Bridge API is listening at http://localhost:${port}`);
    });
}

module.exports = { startServer };
