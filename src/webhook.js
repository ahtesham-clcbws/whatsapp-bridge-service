/**
 * WhatsApp Bridge Service - Webhook Utility
 * ----------------------------------------
 * Handles outbound notifications to external services (e.g., Laravel).
 */

const axios = require('axios');
const pino = require('pino');
require('dotenv').config();

const logger = pino({ level: 'info' });
const webhookUrl = process.env.WEBHOOK_URL;

/**
 * Dispatches a notification to the configured WEBHOOK_URL.
 * @param {string} event - event name (e.g., 'message.received', 'delivery.update')
 * @param {Object} data - Payload data.
 */
async function notifyWebhook(event, data) {
    if (!webhookUrl) {
        // Silently skip if no webhook is configured
        return;
    }

    try {
        const payload = {
            event,
            data,
            timestamp: new Date().toISOString()
        };

        const response = await axios.post(webhookUrl, payload, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });

        logger.info({ event, status: response.status }, 'Webhook notified successfully');
    } catch (err) {
        logger.error({ 
            event, 
            error: err.message, 
            url: webhookUrl 
        }, 'Webhook notification failed');
    }
}

module.exports = { notifyWebhook };
