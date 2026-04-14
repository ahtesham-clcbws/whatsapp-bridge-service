if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = require('node:crypto').webcrypto;
}
require('dotenv').config();
/**
 * WhatsApp Bridge Service - Bootstrapper
 * --------------------------------------
 * The main entry point that initializes the WhatsApp socket connection 
 * and starts the HTTP API server.
 */

const { connectToWhatsApp } = require('./whatsapp');
const { startServer } = require('./server');
const logger = require('./logger');


async function init() {
    try {
        logger.info('Initializing WhatsApp Bridge Service...');
        
        // 1. Establish WhatsApp WebSocket Connection
        // This will prompt for a QR scan in the terminal if not authenticated.
        await connectToWhatsApp();
        
        // 2. Start the Multipart API Server
        startServer();
        
        logger.info('Bridge Service is ready and operational.');
    } catch (err) {
        logger.error('Boot Failure:', err);
        process.exit(1);
    }
}

// Global error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

init();
