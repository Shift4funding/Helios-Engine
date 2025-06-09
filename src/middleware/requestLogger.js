const morgan = require('morgan');
const logger = require('../config/logger');

// Custom format that includes request ID and user info
morgan.token('request-id', (req) => req.id);
morgan.token('user', (req) => req.user ? req.user.id : 'anonymous');

// Skip logging for test environment and health checks
const skipLogging = (req, res) => {
    return process.env.NODE_ENV === 'test' || 
           req.path === '/health' ||
           req.path === '/metrics';
};

// Custom error handler for morgan
const handleError = (err) => {
    logger.error('Request logging error:', err);
};

// Create logger middleware with custom format
const requestLogger = morgan(
    ':request-id :remote-addr :user ":method :url HTTP/:http-version" :status :res[content-length] :response-time ms',
    {
        stream: {
            write: (message) => {
                try {
                    logger.http(message.trim());
                } catch (error) {
                    handleError(error);
                }
            }
        },
        skip: skipLogging,
        handleError
    }
);

// Export middleware
module.exports = requestLogger;