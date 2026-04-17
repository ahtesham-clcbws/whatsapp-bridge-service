/**
 * WhatsApp Bridge Service - API Server [v3.8.1]
 * ------------------------------------------------
 * Core entry point for the bridge service. Orchestrates modular 
 * routers for authentication, session management, and messaging.
 * 
 * @author Ahtesham
 * @license MIT
 */

const express = require('express');
const path = require('path');
const logger = require('./logger');

const app = express();
const port = process.env.PORT || 3001;

// Global Middleware (Standard JSON parsing - only handles application/json)
app.use(express.json());

// --- Static Dashboard Engine ---
app.use('/dashboard', express.static(path.join(__dirname, '..', 'public')));
app.get('/dashboard/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

// --- Modular Route Injections ---
const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/session');
const adminRoutes = require('./routes/admin');
const messageRoutes = require('./routes/message');

// 1. Auth & Session (Public/MFA - MUST be above root middleware)
app.use('/api/auth', authRoutes);
app.use('/session', sessionRoutes);

// 2. High-Priority Messaging Layer (Mounted at root)
app.use('/', messageRoutes);

// 3. Admin & System
app.use('/api/admin', adminRoutes);
app.get('/logs', adminRoutes); 

/**
 * Global Error Handler: Catches JSON parsing errors and middleware failures.
 */
app.use((err, req, res, next) => {
    logger.error({ err: err.message, stack: err.stack }, 'Global Request Error');
    res.status(err.status || 500).json({ 
        error: 'Server Error', 
        message: err.message,
        type: err.constructor.name
    });
});

/**
 * Bootstraps the Express Server.
 */
function startServer() {
    app.listen(port, () => {
        logger.info(`WhatsApp Bridge is listening at http://localhost:${port}`);
    });
}

module.exports = { startServer };
