const Redis = require('ioredis');
const logger = require('../config/logger');

class RedisService {
    constructor() {
        this.client = null;
    }

    async connect() {
        try {
            this.client = new Redis({
                host: process.env.REDIS_HOST,
                port: process.env.REDIS_PORT,
                password: process.env.REDIS_PASSWORD,
                tls: {
                    // Required for Redis Cloud SSL connections
                    rejectUnauthorized: false,
                    requestCert: true,
                    agent: false
                },
                retryStrategy(times) {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                }
            });

            this.client.on('error', (error) => {
                logger.error('Redis error:', error);
            });

            this.client.on('connect', () => {
                logger.info('Redis connected successfully');
            });

            await this.client.ping();
            return this.client;
        } catch (error) {
            logger.error('Redis connection error:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.quit();
            this.client = null;
        }
    }

    async set(key, value, ttl = 3600) {
        if (!this.client) throw new Error('Redis not connected');
        await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    }

    async get(key) {
        if (!this.client) throw new Error('Redis not connected');
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
    }
}

module.exports = new RedisService();