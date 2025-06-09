import rateLimit from 'express-rate-limit';

export default class RateLimiter {
    constructor() {
        // For tests, use a simple memory store with higher limits
        this.limiter = rateLimit({
            windowMs: 1000, // 1 second for tests
            max: 100, // Allow more requests
            handler: (req, res, next) => {
                res.status(429).json({
                    message: 'Too many requests, please try again later.'
                });
            },
            skipFailedRequests: false,
            standardHeaders: true,
            keyGenerator: (req) => req.ip
        });
    }

    middleware() {
        return async (req, res, next) => {
            try {
                // Ensure next is called after rate limit check
                await new Promise((resolve) => {
                    this.limiter(req, res, (err) => {
                        if (err) {
                            next(err);
                        } else {
                            next();
                        }
                        resolve();
                    });
                });
            } catch (error) {
                next(error);
            }
        };
    }
}