/**
 * Shared Authorization Middleware
 */
const { getSystemDatabase } = require('../database');
require('dotenv').config();

const apiKey = process.env.API_KEY;

const flexibleAuth = async (req, res, next) => {
    try {
        const providedKey = req.body?.apiKey || req.query.apiKey || req.headers['x-api-key'];
        const adminToken = req.headers['x-admin-token'];

        // Check Dashboard Session First (Persistent v3.2)
        if (adminToken) {
            const sysDb = await getSystemDatabase();
            const session = await new Promise((resolve) => {
                sysDb.get(`SELECT * FROM admin_sessions WHERE token = ? AND expires_at > datetime('now')`, [adminToken], (err, row) => {
                    if (err) resolve(null); else resolve(row);
                });
            });
            if (session) return next();
        }

        // Fallback to API_KEY
        if (providedKey && providedKey === apiKey) {
            return next();
        }

        res.status(401).json({ error: 'Unauthorized: Valid Session Token or API Key required.' });
    } catch (err) {
        next(err);
    }
};

module.exports = { flexibleAuth };
