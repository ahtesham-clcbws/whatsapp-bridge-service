const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Ensure log directory exists
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const getFormattedDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const dateStr = getFormattedDate();
const isDebugMode = process.env.DEBUG === 'true';

const levels = ['info', 'warn', 'error'];
if (isDebugMode) levels.push('debug');

const streams = [
    { level: 'info', stream: process.stdout }
];

// Memory cache for active level-specific write streams
const activeFileStreams = {};
let lastDateStr = getFormattedDate();

/**
 * Retrieves or initializes a filtered file stream for a specific log level.
 * Features auto-rotation: if the date changes, it closes old streams and starts new ones.
 * 
 * @param {string} lvl - The log level (info, warn, error, debug).
 * @returns {Object} A pino-compatible stream object.
 */
function createPartitionedStream(lvl) {
    const lvlNum = pino.levels.values[lvl] || 30;

    return {
        write: (str) => {
            const nowDateStr = getFormattedDate();
            
            // Auto-rotation logic
            if (nowDateStr !== lastDateStr) {
                Object.keys(activeFileStreams).forEach(key => {
                    activeFileStreams[key].end();
                    delete activeFileStreams[key];
                });
                lastDateStr = nowDateStr;
            }

            if (!activeFileStreams[lvl]) {
                const logPath = path.join(logDir, `bridge-${lvl}-${nowDateStr}.log`);
                activeFileStreams[lvl] = fs.createWriteStream(logPath, { flags: 'a' });
            }

            try {
                const log = JSON.parse(str);
                if (log.level === lvlNum || (lvl === 'debug' && log.level <= 20)) {
                    activeFileStreams[lvl].write(str);
                }
            } catch (e) {
                activeFileStreams[lvl].write(str);
            }
        }
    };
}

// Initialize streams for each supported level
levels.forEach(lvl => {
    streams.push({
        level: lvl,
        stream: createPartitionedStream(lvl)
    });
});

// Generate the master logger
const logger = pino(
    { level: isDebugMode ? 'trace' : 'info' },
    pino.multistream(streams)
);

module.exports = logger;
