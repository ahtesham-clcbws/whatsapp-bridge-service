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
const path = require('path');
const crypto = require('crypto');

// --- Global State for v3.0 Admin Dashboard ---
const otpMap = new Map(); // Stores { code, expires, ip }
const sessions = new Set(); // Stores verified session tokens
const port = process.env.PORT || 3001;
const apiKey = process.env.API_KEY;

// Middleware: Multipart form handling for large attachments (In-Memory)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: process.env.MAX_FILE_SIZE || 50 * 1024 * 1024 }
});

// Middleware: Global body parsing (Forces JSON parsing even if headers are missing)
app.use(express.json({ type: () => true }));

// --- v3.0 Static Dashboard Engine ---
app.use('/dashboard', express.static(path.join(__dirname, '..', 'public')));
app.get('/dashboard/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

/**
 * Flexible Authorization Middleware: Accepts either a valid API_KEY 
 * or a valid Dashboard Session Token.
 */
const flexibleAuth = (req, res, next) => {
    const providedKey = req.body?.apiKey || req.query.apiKey || req.headers['x-api-key'];
    const adminToken = req.headers['x-admin-token'];

    // Check Dashboard Session First
    if (adminToken && sessions.has(adminToken)) {
        return next();
    }

    // Fallback to API_KEY
    if (providedKey && providedKey === apiKey) {
        return next();
    }

    res.status(401).json({ error: 'Unauthorized: Valid Session Token or API Key required.' });
};

// --- v3.0 Authentication & MFA Endpoints ---

/**
 * Request Dashboard Access (MFA)
 * POST /api/auth/request
 */
app.post('/api/auth/request', async (req, res) => {
    try {
        // If not connected, allow access via API_KEY for setup
        if (!isWhatsAppConnected()) {
            const bodyKey = req.body?.apiKey;
            if (bodyKey && bodyKey === apiKey) {
                const setupToken = crypto.randomUUID();
                sessions.add(setupToken);
                return res.json({ status: 'setup', token: setupToken, message: 'Bridge offline. Setup mode active.' });
            }
            return res.status(401).json({ error: 'Auth Required: Provide API_KEY to access setup mode.' });
        }

        // If connected, trigger WhatsApp OTP
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const tokenHash = crypto.randomUUID(); // Temporary token to track the verification attempt
        
        otpMap.set(tokenHash, { 
            code, 
            expires: Date.now() + 5 * 60 * 1000, // 5 min expiry
            ip: req.ip 
        });

        await require('./whatsapp').sendAuthCode(code);
        res.json({ status: 'pending', attemptToken: tokenHash, message: 'OTP sent to your WhatsApp.' });
    } catch (err) {
        logger.error('MFA Request Error:', err);
        res.status(500).json({ error: 'Failed to trigger MFA.' });
    }
});

/**
 * Verify Dashboard OTP
 * POST /api/auth/verify
 */
app.post('/api/auth/verify', (req, res) => {
    const { attemptToken, code } = req.body;
    const record = otpMap.get(attemptToken);

    if (!record || record.expires < Date.now()) {
        otpMap.delete(attemptToken);
        return res.status(401).json({ error: 'OTP expired or invalid.' });
    }

    if (record.code !== code) {
        return res.status(401).json({ error: 'Incorrect OTP code.' });
    }

    // Success: Generate Long-Lived Session Token
    const sessionToken = crypto.randomUUID();
    sessions.add(sessionToken);
    otpMap.delete(attemptToken);

    res.json({ status: 'success', token: sessionToken });
});

// --- Session Management Endpoints ---

/**
 * Connectivity Check
 * GET /session/status
 */
app.get('/session/status', flexibleAuth, (req, res) => {
    res.json({ connected: isWhatsAppConnected() });
});

/**
 * Fetch Current QR Code (Remote Pairing)
 * GET /session/qr
 */
app.get('/session/qr', flexibleAuth, (req, res) => {
    const qr = getLatestQR();
    if (isWhatsAppConnected()) return res.json({ message: 'Already connected' });
    if (!qr) return res.status(404).json({ error: 'QR code not yet available. Wait a few seconds.' });
    res.json({ qr });
});

/**
 * Request Account Pairing Code (8-digit)
 * POST /session/pairing-code
 */
app.post('/session/pairing-code', flexibleAuth, async (req, res) => {
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
app.get('/session/groups', flexibleAuth, async (req, res) => {
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
app.post('/session/logout', flexibleAuth, async (req, res) => {
    try {
        await logoutSession();
        res.json({ status: 'success', message: 'Session disconnected and cleared.' });
    } catch (err) {
        logger.error('Logout Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Admin Telemetry + System Vitals
 * GET /api/admin/stats
 */
app.get('/api/admin/stats', flexibleAuth, async (req, res) => {
    try {
        const db = await getDatabase();
        const os = require('os');
        
        const stats = await new Promise((resolve, reject) => {
            db.all(`SELECT COUNT(*) as total, SUM(CASE WHEN status IN ('Sent','Read','Delivered') THEN 1 ELSE 0 END) as success, SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) as failed, SUM(retry_count) as retries FROM audit_logs`, [], (err, rows) => {
                if (err) reject(err); else resolve(rows[0]);
            });
        });

        res.json({
            status: 'success',
            vitals: {
                uptime: Math.floor(process.uptime()),
                connected: isWhatsAppConnected(),
                cpu_load: os.loadavg()[0].toFixed(2),
                ram_usage: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(0),
                version: '3.0.0'
            },
            metrics: {
                total_dispatched: stats.total || 0,
                success_count: stats.success || 0,
                failure_count: stats.failed || 0,
                retry_volume: stats.retries || 0
            }
        });
    } catch (err) {
        logger.error('Stats Error:', err);
        res.status(500).json({ error: 'Telemetry Failure.' });
    }
});

/**
 * Dynamic Configuration Management
 * GET /api/admin/settings
 */
app.get('/api/admin/settings', flexibleAuth, (req, res) => {
    res.json({
        webhook_url: process.env.WEBHOOK_URL || 'Not Set',
        max_retries: process.env.MAX_RETRIES || 3,
        file_limit: process.env.MAX_FILE_SIZE || '50MB'
    });
});

/**
 * Audit Log Retreival
 * GET /logs
 */
app.get('/logs', flexibleAuth, async (req, res) => {
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
        version: '3.0.0',
        timestamp: new Date().toISOString()
    });
});

// --- Unified Messaging Endpoint ---

/**
 * Dispatch Hub
 * POST /send (Multipart/Form-Data or JSON)
 */
app.post('/send', flexibleAuth, (req, res, next) => {
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
