class RedisRateLimiterMock {
    constructor(options) {
        this.windowMs = options.windowMs || 15 * 60 * 1000;
        this.max = options.max || 100;
        this.requests = new Map();
        this.timestamps = new Map();
    }

    middleware() {
        return async (req, res, next) => {
            const ip = req.ip;
            const now = Date.now();
            
            // Clean up old requests
            this.cleanupOldRequests(ip, now);
            
            // Get current request count
            const current = this.incrementRequests(ip);
            
            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', this.max);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, this.max - current));
            
            if (current > this.max) {
                return res.status(429).json({
                    error: 'Too many requests',
                    retryAfter: Math.ceil((this.windowMs) / 1000)
                });
            }

            next();
        };
    }

    cleanupOldRequests(ip, now) {
        const timestamps = this.timestamps.get(ip) || [];
        const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);
        this.timestamps.set(ip, validTimestamps);
        this.requests.set(ip, validTimestamps.length);
    }

    incrementRequests(ip) {
        const timestamps = this.timestamps.get(ip) || [];
        timestamps.push(Date.now());
        this.timestamps.set(ip, timestamps);
        const current = timestamps.length;
        this.requests.set(ip, current);
        return current;
    }
}

module.exports = RedisRateLimiterMock;