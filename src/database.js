/**
 * WhatsApp Bridge Service - SQLite Persistence Layer
 * --------------------------------------------------
 * Manages weekly-rotated audit logs to ensure high performance 
 * and long-term stability. Current active database is determined 
 * by the ISO week number.
 * 
 * @author Ahtesham
 * @license MIT
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const pino = require('pino');

const logger = pino({ level: 'info' });
const logsDir = path.join(process.cwd(), 'logs');

// Ensure the logs directory exists
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Returns the current ISO week number and year.
 * Format: YYYY-WW (e.g., 2026-15)
 */
function getCurrentWeekId() {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    const year = d.getUTCFullYear();
    return `${year}-W${weekNo.toString().padStart(2, '0')}`;
}

/**
 * Initializes/Connects to the database for the current week.
 * Includes auto-migration to ensure all necessary columns exist.
 * @returns {Promise<sqlite3.Database>}
 */
function getDatabase() {
    const weekId = getCurrentWeekId();
    const dbPath = path.join(logsDir, `audit_${weekId}.db`);
    
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                logger.error(`SQLite Connection Error: ${err.message}`);
                return reject(err);
            }
            
            // Create/Upgrade Audit Logs table
            db.serialize(() => {
                // Initial Table Creation
                db.run(`
                    CREATE TABLE IF NOT EXISTS audit_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        recipient TEXT NOT NULL,
                        status TEXT NOT NULL,
                        type TEXT NOT NULL,
                        metadata TEXT,
                        error TEXT,
                        whatsapp_id TEXT,
                        retry_count INTEGER DEFAULT 0
                    )
                `);

                // Auto-Migration: Add whatsapp_id if missing from early v1.x databases
                db.all("PRAGMA table_info(audit_logs)", (err, columns) => {
                    if (err) return;
                    const hasWhatsappId = columns.some(c => c.name === 'whatsapp_id');
                    const hasRetryCount = columns.some(c => c.name === 'retry_count');

                    if (!hasWhatsappId) {
                        db.run("ALTER TABLE audit_logs ADD COLUMN whatsapp_id TEXT");
                        logger.info('Database Migration: Added whatsapp_id column');
                    }
                    if (!hasRetryCount) {
                        db.run("ALTER TABLE audit_logs ADD COLUMN retry_count INTEGER DEFAULT 0");
                        logger.info('Database Migration: Added retry_count column');
                    }
                });

                resolve(db);
            });
        });
    });
}

/**
 * Simple helper to retrieve all logs from the current week.
 * Use for the /logs endpoint.
 */
async function getRecentLogs(limit = 100) {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?`, [limit], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

module.exports = {
    getDatabase,
    getRecentLogs
};
