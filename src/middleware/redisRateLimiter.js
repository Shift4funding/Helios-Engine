const Redis = require('ioredis');
const logger = require('../config/logger');

class RedisRateLimiter {
    constructor(options = {}) {
        this.client = new Redis({
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
            password: process.env.REDIS_PASSWORD
        });

        this.windowMs = options.windowMs || 900000; // 15 minutes
        this.max = options.max || 100; // Max requests per window
        this.keyPrefix = 'ratelimit:';
    }

    middleware() {
        return async (req, res, next) => {
            try {
                const key = `${this.keyPrefix}${req.ip}`;
                const requests = await this.client.incr(key);

                // Set expiry on first request
                if (requests === 1) {
                    await this.client.expire(key, this.windowMs / 1000);
                }

                const ttl = await this.client.ttl(key);

                res.set({
                    'X-RateLimit-Limit': this.max,
                    'X-RateLimit-Remaining': Math.max(0, this.max - requests),
                    'X-RateLimit-Reset': ttl
                });

                if (requests > this.max) {
                    return res.status(429).json({
                        error: 'Too many requests, please try again later'
                    });
                }

                next();
            } catch (error) {
                logger.error('Rate limiter error:', error);
                next(error);
            }
        };
    }
}

module.exports = RedisRateLimiter;