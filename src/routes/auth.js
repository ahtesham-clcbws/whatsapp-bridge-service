/**
 * Authentication & MFA Routes
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
// Polyfill randomUUID for Node < 15.6.0
if (!crypto.randomUUID) {
    crypto.randomUUID = () => require('crypto').randomBytes(16).toString('hex');
}

const { isWhatsAppConnected, sendAuthCode } = require('../whatsapp');
const { getSystemDatabase } = require('../database');
const logger = require('../logger');

const apiKey = process.env.API_KEY;

/**
 * Request Dashboard Access (MFA)
 * POST /api/auth/request
 */
router.post('/request', async (req, res) => {
    try {
        // If not connected, allow access via API_KEY for setup
        if (!isWhatsAppConnected()) {
            const bodyKey = req.body?.apiKey;
            if (bodyKey && bodyKey === apiKey) {
                const setupToken = crypto.randomUUID();
                const expires = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
                
                const sysDb = await getSystemDatabase();
                await new Promise((resolve) => {
                    sysDb.run(`INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)`, [setupToken, expires], () => resolve());
                });

                return res.json({ status: 'setup', token: setupToken, message: 'Bridge offline. Setup mode active.' });
            }
            return res.status(401).json({ error: 'Auth Required: Provide API_KEY to access setup mode.' });
        }

        // If connected, trigger WhatsApp OTP
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const tokenHash = crypto.randomUUID();
        // Standardize to SQLite datetime format (YYYY-MM-DD HH:MM:SS) in UTC
        const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        
        const sysDb = await getSystemDatabase();
        await new Promise((resolve, reject) => {
            sysDb.run(`INSERT INTO auth_attempts (attempt_token, code, expires_at, ip) VALUES (?, ?, ?, ?)`, 
                [tokenHash, code, expires, req.ip], (err) => err ? reject(err) : resolve());
        });

        // Dual-Channel MFA: Admin Phone -> Self Fallback
        const adminPhone = process.env.ADMIN_PHONE;
        try {
            await sendAuthCode(code, adminPhone);
            res.json({ status: 'pending', attemptToken: tokenHash, message: 'OTP sent to Admin Device.' });
        } catch (mfaErr) {
            logger.warn('MFA Primary dispatch failed, falling back to Self');
            await sendAuthCode(code); // Defaults to self
            res.json({ status: 'pending', attemptToken: tokenHash, message: 'OTP sent to Bridge Device.' });
        }
    } catch (err) {
        logger.error('MFA Request Error:', err);
        res.status(500).json({ error: 'Failed to trigger MFA.' });
    }
});

/**
 * Verify Dashboard OTP
 * POST /api/auth/verify
 */
router.post('/verify', async (req, res) => {
    const { attemptToken, code } = req.body;
    const sysDb = await getSystemDatabase();

    const attempt = await new Promise((resolve) => {
        sysDb.get(`SELECT * FROM auth_attempts WHERE attempt_token = ? AND code = ? AND expires_at > datetime('now')`, 
            [attemptToken, code], (err, row) => resolve(row));
    });

    if (attempt) {
        const sessionToken = crypto.randomUUID();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        
        await new Promise((resolve) => {
            sysDb.run(`INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)`, [sessionToken, expires], () => resolve());
            sysDb.run(`DELETE FROM auth_attempts WHERE attempt_token = ?`, [attemptToken]);
        });
        
        res.json({ status: 'success', token: sessionToken });
    } else {
        res.status(401).json({ error: 'Invalid or expired code.' });
    }
});

module.exports = router;
