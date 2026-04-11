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

// Create a filtered stream for each level to prevent duplication
levels.forEach(lvl => {
    const logPath = path.join(logDir, `bridge-${lvl}-${dateStr}.log`);
    const writeStream = fs.createWriteStream(logPath, { flags: 'a' });
    
    // Pino level numbers: trace=10, debug=20, info=30, warn=40, error=50, fatal=60
    const lvlNum = pino.levels.values[lvl] || 30;
    
    streams.push({
        level: lvl,
        stream: {
            write: (str) => {
                try {
                    const log = JSON.parse(str);
                    // Strict filtering: only write if level matches exactly
                    // This prevents info logs from showing up in warn/error files etc.
                    if (log.level === lvlNum) {
                        writeStream.write(str);
                    } else if (lvl === 'debug' && log.level <= 20) {
                        // Debug file captures both trace (10) and debug (20)
                        writeStream.write(str);
                    }
                } catch (e) {
                    // Fallback to writing anyway if JSON parse fails (shouldn't happen with pino)
                    writeStream.write(str);
                }
            }
        }
    });
});

// Generate the master logger
const logger = pino(
    { level: isDebugMode ? 'trace' : 'info' },
    pino.multistream(streams)
);

module.exports = logger;
