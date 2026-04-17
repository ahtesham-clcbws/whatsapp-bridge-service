/**
 * Messaging & Dispatch Routes
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { isWhatsAppConnected, enqueue, sendBatch } = require('../whatsapp');
const { getDatabase } = require('../database');
const { flexibleAuth } = require('../middleware/auth');
const logger = require('../logger');


// Middleware: Multipart form handling for large attachments (In-Memory)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024 }
}).any();

/**
 * Health Check (Public Status)
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'online',
        whatsapp: isWhatsAppConnected() ? 'connected' : 'disconnected',
        uptime: Math.floor(process.uptime()),
        version: '3.8.5',
        timestamp: new Date().toISOString()
    });
});

// Secure all subsequent messaging routes
router.use(flexibleAuth);

/**
 * Legacy Dispatch Alias (v1.3 Compatibility)
 * Redirects /dispatch to /send
 */
router.post('/dispatch', (req, res, next) => {
    req.url = '/send';
    next();
});

/**
 * Dispatch Hub
 * POST /send (Multipart/Form-Data or JSON)
 */
router.post('/send', (req, res, next) => {
    const contentType = req.get('content-type') || '';
    if (contentType.toLowerCase().includes('multipart')) {
        return upload(req, res, (err) => {
            if (err) return next(err);
            next();
        });
    }
    next();
}, async (req, res) => {
    try {
        if (!isWhatsAppConnected()) {
            return res.status(503).json({ error: 'Service unavailable. WhatsApp not linked.' });
        }

        const number = req.body.number || req.query.number;
        const texts = req.body.text || req.body.msg || req.query.text || req.query.msg;
        // CRITICAL FIX: If text exists but 'type' wasn't declared, default to 'text'.
        const types = req.body.type || req.query.type || (texts ? 'text' : undefined);
        const files = req.files || [];

        logger.trace({ payload: { number, types, texts, fileCount: files.length, isQueuedMode: req.body.delivery === 'queued', isPriority: req.body.priority === 'true' } }, '[DIAGNOSTIC] API PAYLOAD DUMP');


        if (!number) return res.status(400).json({ error: 'Recipient identifier (number or @g.us JID) is mandatory.' });

        // Parsing logic to handle literal \n sequences
        const typeArr = Array.isArray(types) ? types : [types];
        const textArr = (Array.isArray(texts) ? texts : [texts]).map(t => 
            typeof t === 'string' ? t.replace(/\\n/g, '\n') : t
        );

        const batchItems = [];
        let fileIndex = 0;

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
        
        // Default to Direct, but auto-queue if it's a large "Bulk" batch (> 5 items)
        const isQueuedMode = req.body.delivery === 'queued' || req.body.queue === 'true' || batchItems.length > 5;
        const isPriority = req.body.priority === 'true' || req.headers['x-priority'] === 'true';
        
        const db = await getDatabase();
        db.run(
            `INSERT INTO audit_logs (recipient, status, type, metadata) VALUES (?, ?, ?, ?)`, 
            [number, isQueuedMode ? 'Queued' : 'Failed', typeArr.join(','), JSON.stringify({ count: batchItems.length, mode: isQueuedMode ? 'Throttled' : 'Priority' })],
            function(err) {
                if (err) return logger.error('Audit Log Insertion Error:', err);
                const auditId = this.lastID;
                
                (async () => {
                    try {
                        if (isQueuedMode) {
                            console.log(`[ORCHESTRATOR] Enqueuing throttled message for ${number} (Audit: ${auditId})`);
                            await enqueue(number, batchItems, isPriority, auditId);
                        } else {
                            // TRULY DIRECT DISPATCH (Non-Queued)
                            console.log(`[ORCHESTRATOR] FIRING INSTANT MESSAGE to ${number} (No Queue)`);
                            sendBatch(number, batchItems, auditId).catch(err => {
                                console.error(`[BRIDGE] Direct Send Error:`, err);
                            });
                        }
                    } catch (dispatchErr) {
                        console.error(`[ORCHESTRATOR] CRITICAL TRIGGER ERROR:`, dispatchErr);
                    }
                })();
            }
        );

        res.json({ 
            status: 'success', 
            message: isQueuedMode ? 'Message enqueued for throttled delivery.' : 'Message accepted for priority dispatch.', 
            recipient: number 
        });
    } catch (err) {
        logger.error('API Messaging Error:', err);
        res.status(500).json({ error: 'Internal Bridge Failure.' });
    }
});


module.exports = router;
