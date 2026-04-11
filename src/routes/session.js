/**
 * WhatsApp Session Management Routes
 */
const express = require('express');
const router = express.Router();
const { isWhatsAppConnected, getLatestQR, getPairingCode, getAllGroups, logoutSession } = require('../whatsapp');
const { getSystemDatabase } = require('../database');
const { flexibleAuth } = require('../middleware/auth');
const logger = require('../logger');


router.use(flexibleAuth);

/**
 * Connectivity Check
 * GET /session/status
 */
router.get('/status', (req, res) => {
    res.json({ connected: (typeof isWhatsAppConnected === 'function') ? isWhatsAppConnected() : isWhatsAppConnected });
});

/**
 * Fetch Current QR Code (Remote Pairing)
 * GET /session/qr
 */
router.get('/qr', (req, res) => {
    const qr = getLatestQR();
    if (isWhatsAppConnected()) return res.json({ message: 'Already connected' });
    if (!qr) return res.status(404).json({ error: 'QR code not yet available. Wait a few seconds.' });
    res.json({ qr });
});

/**
 * Request Account Pairing Code (8-digit)
 * POST /session/pairing-code
 */
router.post('/pairing-code', async (req, res) => {
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
router.get('/groups', async (req, res) => {
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
router.post('/logout', async (req, res) => {
    try {
        const adminToken = req.headers['x-admin-token'];
        if (adminToken) {
            const sysDb = await getSystemDatabase();
            await new Promise(r => sysDb.run(`DELETE FROM admin_sessions WHERE token = ?`, [adminToken], () => r()));
        }
        await logoutSession();
        res.json({ status: 'success', message: 'Session disconnected and cleared.' });
    } catch (err) {
        logger.error('Logout Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
