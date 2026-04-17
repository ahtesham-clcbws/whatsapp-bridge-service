/**
 * Admin & Telemetry Routes
 */
const express = require('express');
const router = express.Router();
const os = require('os');
const { getRecentLogs, getDatabase, getPendingQueue } = require('../database');
const { isWhatsAppConnected, getQueueStatus } = require('../whatsapp');
const { flexibleAuth } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');


router.use(flexibleAuth);

/**
 * Admin Telemetry + System Vitals
 * GET /api/admin/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const db = await getDatabase();
        
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
                version: '3.8.3',
                queue: getQueueStatus()
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
 * Queue Telemetry
 * GET /api/admin/queue
 */
router.get('/queue', async (req, res) => {
    try {
        const queue = await getPendingQueue();
        res.json({
            status: 'success',
            count: queue.length,
            items: queue.map(i => ({
                id: i.id,
                recipient: i.recipient,
                is_priority: i.is_priority === 1,
                retry_count: i.retry_count,
                timestamp: i.timestamp
            }))
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to access queue.' });
    }
});

/**
 * Global Template Directory
 * GET /api/admin/templates
 */
router.get('/templates', (req, res) => {
    try {
        const templates = require('../templates.json');
        res.json(templates);
    } catch (e) {
        res.json([]);
    }
});

/**
 * System Logs API
 */
router.get('/logs/dates', (req, res) => {
    const logDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logDir)) return res.json([]);
    const files = fs.readdirSync(logDir).filter(f => f.startsWith('bridge-') && f.endsWith('.log'));
    // Extract date from filenames like bridge-info-2026-04-11.log
    const dates = [...new Set(files.map(f => {
        const parts = f.replace('.log', '').split('-');
        return parts.slice(-3).join('-'); // Get the YYYY-MM-DD part
    }))].sort().reverse();
    res.json(dates);
});

/**
 * Retrieve Audit Logs (Filtered)
 * GET /api/admin/logs
 */
router.get('/logs', (req, res) => {
    // Default to today if date is missing
    const today = new Date().toISOString().split('T')[0];
    const date = req.query.date || today;
    const level = (req.query.level || 'info').toLowerCase();
    
    const logDir = path.join(__dirname, '../../logs');
    const logFile = path.join(logDir, `bridge-${level}-${date}.log`);
    
    let logs = [];
    try {
        if (fs.existsSync(logFile)) {
            const rawContent = fs.readFileSync(logFile, 'utf8');
            const lines = rawContent.split('\n').filter(Boolean);
            logs = lines.map(l => { 
                try { 
                    const parsed = JSON.parse(l);
                    // Add human readable time if it's missing but we have a pino timestamp
                    if (parsed.time && !parsed.timestamp) parsed.timestamp = new Date(parsed.time).toISOString();
                    return parsed;
                } 
                catch(e){ 
                    // If it's not JSON, return it as a raw console entry
                    return { level: 30, msg: l, timestamp: new Date().toISOString(), type: 'raw' }; 
                } 
            }).filter(Boolean);
        }
        
        // Return logs sorted by time (latest first)
        logs.sort((a, b) => {
            const timeA = a.time || new Date(a.timestamp).getTime();
            const timeB = b.time || new Date(b.timestamp).getTime();
            return timeB - timeA;
        });

        // Limit to last 100 lines if it's the console view
        if (level === 'console') logs = logs.slice(0, 100);

        res.json(logs);
    } catch(e) {
        res.status(500).json({ error: 'Failed to parse logs.' });
    }
});

/**
 * Retrieve Recent Activity (Last 50)
 * GET /api/admin/logs/recent
 */
router.get('/logs/recent', async (req, res) => {
    try {
        const { getRecentLogs } = require('../database');
        const logs = await getRecentLogs(50);
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch recent logs.' });
    }
});

/**
 * Filtered Failure Report
 * GET /api/admin/reports/failed
 */
router.get('/reports/failed', async (req, res) => {
    try {
        const db = await getDatabase();
        const failures = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM audit_logs WHERE status = 'Failed' ORDER BY timestamp DESC LIMIT 100`, 
                [], 
                (err, rows) => { if (err) reject(err); else resolve(rows); }
            );
        });
        // Attach the current weekId for retry context
        const weekId = require('../database').getCurrentWeekId();
        res.json(failures.map(f => ({ ...f, weekId })));
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate failure report.' });
    }
});

/**
 * Retry a Failed Message
 * POST /api/admin/retry/:id
 */
router.post('/retry/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { week } = req.query;
        if (!week) return res.status(400).json({ error: 'Week context required.' });

        const database = require('../database');
        const dbPath = path.join(process.cwd(), 'logs', `audit_${week}.db`);
        
        // 1. Fetch the failed message data
        const record = await new Promise((resolve, reject) => {
            const db = new (require('sqlite3').Database)(dbPath, (err) => {
                if (err) reject(err);
                db.get(`SELECT * FROM audit_logs WHERE id = ?`, [id], (err, row) => {
                    db.close();
                    if (err) reject(err); else resolve(row);
                });
            });
        });

        if (!record) return res.status(404).json({ error: 'Failure record not found.' });

        // 2. Re-enqueue into the system
        const { enqueue } = require('../whatsapp').getQueue(); 
        const items = [{ type: record.type, [record.type === 'text' ? 'text' : 'msg']: record.metadata }];
        
        // Handle media if buffer exists (simplified for now as retry mostly for text/reports)
        await require('../whatsapp').enqueue(record.recipient, items, true, record.id);

        res.json({ status: 'success', message: 'Message re-enqueued for retry.' });
    } catch (err) {
        logger.error('Retry Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Delivery Analytics (Dynamic Range)
 * GET /api/admin/analytics/delivery?days=30
 */
const analyticsCache = {}; // Cache per day-range

router.get('/analytics/delivery', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const now = Date.now();
        
        // Cache management (1 hour TTL per range)
        if (analyticsCache[days] && (now - analyticsCache[days].time < 3600000)) {
            return res.json(analyticsCache[days].data);
        }

        const { getHistoricalAnalytics } = require('../database');
        const data = await getHistoricalAnalytics(days);
        
        analyticsCache[days] = { time: now, data };
        res.json(data);
    } catch (err) {
        logger.error('Analytics Fetch Error:', err);
        res.status(500).json({ error: 'Failed to aggregate analytics.' });
    }
});

/**
 * Delete a specific Log File
 * DELETE /api/admin/logs?date=YYYY-MM-DD&level=LEVEL
 */
router.delete('/logs', (req, res) => {
    try {
        const { date, level } = req.query;
        if (!date || !level) return res.status(400).json({ error: 'Missing parameters.' });

        const logPath = path.join(process.cwd(), 'logs', `bridge-${level}-${date}.log`);
        if (fs.existsSync(logPath)) {
            fs.unlinkSync(logPath);
            res.json({ status: 'success', message: 'Log file purged.' });
        } else {
            res.status(404).json({ error: 'Log file not found.' });
        }
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete log file.' });
    }
});

/**
 * Delete a specific Audit Record
 * DELETE /api/admin/audit/:id?week=YYYY-WXX
 */
router.delete('/audit/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { week } = req.query;
        if (!week) return res.status(400).json({ error: 'Week context required.' });

        const { deleteAuditLog } = require('../database');
        await deleteAuditLog(id, week);
        res.json({ status: 'success', message: 'Record destroyed.' });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Failed to delete record.' });
    }
});

/**
 * Remote System Maintenance
 */
router.post('/system/update', (req, res) => {
    const { exec } = require('child_process');
    exec('git pull origin master', (err, stdout, stderr) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message, log: stderr });
        res.json({ status: 'success', message: 'Repository Synchronized.', log: stdout });
    });
});

router.post('/system/reboot', async (req, res) => {
    res.json({ status: 'success', message: 'Service rebooting... Syncing session.' });
    setTimeout(() => {
        logger.info('Maintenance Reboot Triggered via Admin Panel.');
        process.exit(0);
    }, 2000);
});

/**
 * Dynamic Configuration Management
 * GET /api/admin/settings
 */
router.get('/settings', (req, res) => {
    res.json({
        webhook_url: process.env.WEBHOOK_URL || 'Not Set',
        max_retries: process.env.MAX_RETRIES || 3,
        file_limit: process.env.MAX_FILE_SIZE || '100MB',
        node_version: process.version,
        platform: process.platform,
        admin_phone: process.env.ADMIN_PHONE ? 'Configured' : 'Not Set'
    });
});

/**
 * Hardware Analytics
 * GET /api/admin/system/hardware
 */
router.get('/system/hardware', (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = ((usedMem / totalMem) * 100).toFixed(1);
    
    res.json({
        cpuLoad: os.loadavg()[0].toFixed(2), // 1-minute load average
        memUsage: `${memUsage}%`,
        uptime: Math.floor(os.uptime() / 3600), // Hours
        platform: os.platform(),
        arch: os.arch()
    });
});

/**
 * Queue Item Deletion
 * DELETE /api/admin/queue/:id
 */
router.delete('/queue/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { deleteQueueItem } = require('../database');
        await deleteQueueItem(id);
        res.json({ status: 'success', message: 'Message purged from queue.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete item.' });
    }
});

/**
 * Legacy Support: Audit Log Retrieval
 * GET /logs
 */
router.get('/logs', async (req, res) => {
    try {
        const logs = await getRecentLogs(50);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to access audit logs.' });
    }
});

module.exports = router;
