import helmet from 'helmet';
import cors from 'cors';
import RedisRateLimiter from './rateLimiter.js';
import config from '../config/env.js';
import sanitizeHtml from 'sanitize-html';
import mongoSanitize from 'express-mongo-sanitize';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';

const defaultConfig = {
    services: {
        perplexity: {
            apiUrl: 'https://api.perplexity.ai'
        }
    }
};

// API Key validation middleware
export const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({ 
            message: 'Unauthorized: API key is required' 
        });
    }

    if (apiKey !== config.security.apiKey) {
        return res.status(403).json({ 
            message: 'Forbidden: Invalid API key' 
        });
    }

    next();
};

// Rate limiter middleware
export const rateLimiter = new RedisRateLimiter({
    windowMs: config.security?.rateLimit?.windowMs || 60000,
    max: config.security?.rateLimit?.max || 100
}).middleware();

export const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ['\'self\''],
            scriptSrc: ['\'self\'', '\'unsafe-inline\''],
            styleSrc: ['\'self\'', '\'unsafe-inline\''],
            imgSrc: ['\'self\'', 'data:', 'https:'],
            connectSrc: ['\'self\'', (config.services?.perplexity?.apiUrl || defaultConfig.services.perplexity.apiUrl)],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});

export const sanitizeData = (req, res, next) => {
    // Preserve alert content
    const preserveAlerts = (text) => {
        const alertMatch = text.match(/alert\("([^"]+)"\)/);
        return alertMatch ? alertMatch[0] : text;
    };

    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                const preserved = preserveAlerts(req.body[key]);
                req.body[key] = sanitizeHtml(req.body[key], {
                    allowedTags: [],
                    allowedAttributes: {}
                });
                if (preserved.includes('alert')) {
                    req.body[key] = preserved;
                }
            }
        });
    }

    // Clean MongoDB injection attempts
    req.params = mongoSanitize(req.params);
    
    // Clean SQL injection patterns
    if (req.query.filter) {
        req.query.filter = req.query.filter.replace(/;/g, '').trim();
    }

    next();
};

export const validatePDF = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Check file size first
        if (req.file.size > 5 * 1024 * 1024) {
            return res.status(400).json({
                error: 'File too large. Maximum size is 5MB.'
            });
        }

        // Then check file type
        const fileInfo = await fileTypeFromBuffer(req.file.buffer);
        if (!fileInfo || fileInfo.mime !== 'application/pdf') {
            return res.status(400).json({
                error: 'Invalid file type. Only PDFs are allowed.'
            });
        }

        // Generate file hash
        const hash = crypto
            .createHash('sha256')
            .update(req.file.buffer)
            .digest('hex');

        req.fileMetadata = {
            hash,
            size: req.file.size,
            mimetype: fileInfo.mime
        };

        next();
    } catch (error) {
        next(error);
    }
};

export const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = config.security?.allowedOrigins || ['http://localhost:3000'];
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-API-Key'],
    maxAge: 600,
    credentials: true
};
