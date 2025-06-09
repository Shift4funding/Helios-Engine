const sanitizeHtml = require('sanitize-html');
const xss = require('xss');
const logger = require('../config/logger');

const sanitizeOptions = {
    allowedTags: [], // No HTML tags allowed
    allowedAttributes: {}, // No attributes allowed
    disallowedTagsMode: 'recursiveEscape'
};

const sanitizeValue = (value) => {
    if (typeof value === 'string') {
        // HTML sanitization
        const htmlSanitized = sanitizeHtml(value, sanitizeOptions);
        // XSS prevention
        return xss(htmlSanitized);
    }
    return value;
};

const sanitizeObject = (obj) => {
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }
    
    if (obj !== null && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
    }
    
    return sanitizeValue(obj);
};

// Mock sanitizer for testing
const sanitizeRequest = (req, res, next) => {
    if (process.env.NODE_ENV === 'test') {
        return next();
    }

    try {
        // Simple sanitization for now
        if (req.body) {
            Object.keys(req.body).forEach(key => {
                if (typeof req.body[key] === 'string') {
                    req.body[key] = req.body[key].trim();
                }
            });
        }

        // Sanitize query parameters
        if (req.query) {
            req.query = sanitizeObject(req.query);
        }

        // Sanitize URL parameters
        if (req.params) {
            req.params = sanitizeObject(req.params);
        }

        // Don't sanitize file uploads
        if (req.file || req.files) {
            logger.debug('Skipping sanitization for file upload');
        }

        next();
    } catch (error) {
        logger.error('Sanitization error:', error);
        next(error);
    }
};

module.exports = {
    sanitizeRequest,
    sanitizeValue, // Export for use in other parts of the application
    sanitizeObject
};