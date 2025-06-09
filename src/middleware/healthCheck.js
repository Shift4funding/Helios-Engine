const Redis = require('ioredis');

class HealthCheck {
    constructor() {
        this.redisClient = process.env.NODE_ENV === 'test' 
            ? this.getMockRedisClient()
            : new Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD,
                enableOfflineQueue: false,
                lazyConnect: true
            });
    }

    getMockRedisClient() {
        return {
            connect: jest.fn().mockResolvedValue(true),
            disconnect: jest.fn().mockResolvedValue(true),
            ping: jest.fn().mockResolvedValue('PONG')
        };
    }

    async checkHealth() {
        try {
            if (process.env.NODE_ENV !== 'test') {
                await this.redisClient.connect();
            }
            const redisStatus = await this.redisClient.ping();
            
            return {
                status: 'healthy',
                redis: redisStatus === 'PONG' ? 'connected' : 'disconnected',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                redis: 'disconnected',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        } finally {
            if (process.env.NODE_ENV !== 'test') {
                await this.redisClient.disconnect();
            }
        }
    }

    middleware() {
        return async (req, res) => {
            try {
                const health = await this.checkHealth();
                const statusCode = health.status === 'healthy' ? 200 : 503;
                res.status(statusCode).json(health);
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: 'Error checking health status',
                    timestamp: new Date().toISOString()
                });
            }
        };
    }
}

module.exports = new HealthCheck();