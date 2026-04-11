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
const logger = require('./logger');

const logsDir = path.join(process.cwd(), 'logs');

// Ensure the logs directory exists
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Returns a connection to the permanent system database (for sessions, config, etc.)
 * @returns {Promise<sqlite3.Database>}
 */
function getSystemDatabase() {
    const dbPath = path.join(logsDir, `system.db`);
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) return reject(err);
            db.serialize(() => {
                db.run(`CREATE TABLE IF NOT EXISTS admin_sessions (
                    token TEXT PRIMARY KEY,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME NOT NULL
                )`);
                db.run(`CREATE TABLE IF NOT EXISTS auth_attempts (
                    attempt_token TEXT PRIMARY KEY,
                    code TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    ip TEXT
                )`);
                db.run(`CREATE TABLE IF NOT EXISTS pending_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    recipient TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    buffer BLOB,
                    is_priority INTEGER DEFAULT 0,
                    retry_count INTEGER DEFAULT 0,
                    last_error TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // Auto-Migration: Add audit_id if missing
                db.all("PRAGMA table_info(pending_queue)", (err, columns) => {
                    if (err || !columns) return;
                    const hasAuditId = columns.some(c => c.name === 'audit_id');
                    if (!hasAuditId) {
                        db.run("ALTER TABLE pending_queue ADD COLUMN audit_id INTEGER");
                    }
                });

                resolve(db);
            });
        });
    });
}

/**
 * Retrieves all items in the pending queue, ordered by priority and then creation date.
 */
async function getPendingQueue() {
    const db = await getSystemDatabase();
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM pending_queue ORDER BY is_priority DESC, created_at ASC`, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

/**
 * Removes an item from the pending queue.
 */
async function deleteQueueItem(id) {
    const db = await getSystemDatabase();
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM pending_queue WHERE id = ?`, [id], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

/**
 * Updates a queue item (e.g., after a failed attempt).
 */
async function updateQueueItem(id, retryCount, lastError) {
    const db = await getSystemDatabase();
    return new Promise((resolve, reject) => {
        db.run(`UPDATE pending_queue SET retry_count = ?, last_error = ? WHERE id = ?`, [retryCount, lastError, id], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
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
                
                // Index for analytics performance
                db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)`);

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

/**
 * Aggregates delivery stats for the last 30 days across multiple weekly databases.
 */
async function getHistoricalAnalytics(days = 30) {
    const analytics = {};
    const weekIds = [];
    
    // 1. Pre-seed the requested window with 0s
    for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toISOString().split('T')[0];
        analytics[dayStr] = { success: 0, failed: 0 };
    }

    // Determine how many weeks to scan
    const weekCount = Math.ceil(days / 7) + 1;
    for (let i = 0; i < weekCount; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (i * 7));
        
        const weekD = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        weekD.setUTCDate(weekD.getUTCDate() + 4 - (weekD.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(weekD.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((weekD - yearStart) / 86400000) + 1) / 7);
        weekIds.push(`${weekD.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`);
    }

    const uniqueWeeks = [...new Set(weekIds)];
    
    for (const weekId of uniqueWeeks) {
        const dbPath = path.join(logsDir, `audit_${weekId}.db`);
        if (!fs.existsSync(dbPath)) continue;

        await new Promise((resolve) => {
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) return resolve();
                db.all(`
                    SELECT date(timestamp) as day, status, count(*) as count 
                    FROM audit_logs 
                    WHERE timestamp >= date('now', '-' || ? || ' days')
                    GROUP BY day, status
                `, [days], (err, rows) => {
                    if (!err && rows) {
                        rows.forEach(row => {
                            const status = row.status ? row.status.toLowerCase() : '';
                            const isSuccess = ['success', 'sent', 'delivered', 'read'].includes(status);
                            const isFailed = status === 'failed';

                            if (analytics[row.day]) {
                                if (isSuccess) analytics[row.day].success += row.count;
                                else if (isFailed) analytics[row.day].failed += row.count;
                            }
                        });
                    }
                    db.close();
                    resolve();
                });
            });
        });
    }

    return Object.keys(analytics).sort().map(day => ({ day, ...analytics[day] }));
}

/**
 * Permanently deletes a specific audit record from a weekly database.
 */
async function deleteAuditLog(id, weekId) {
    const dbPath = path.join(logsDir, `audit_${weekId}.db`);
    if (!fs.existsSync(dbPath)) throw new Error('Database not found');

    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) return reject(err);
            db.run(`DELETE FROM audit_logs WHERE id = ?`, [id], (err) => {
                db.close();
                if (err) return reject(err);
                resolve();
            });
        });
    });
}

module.exports = {
    getDatabase,
    getSystemDatabase,
    getRecentLogs,
    getPendingQueue,
    deleteQueueItem,
    updateQueueItem,
    getHistoricalAnalytics,
    deleteAuditLog
};
