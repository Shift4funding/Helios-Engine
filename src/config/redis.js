const Redis = require('ioredis');
const { logger } = require('../utils');

const redisConfig = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    connectTimeout: 5000,
    lazyConnect: true,
    tls: true
};

class RedisClient {
    constructor() {
        this.client = null;
    }

    async connect() {
        try {
            this.client = new Redis(redisConfig);
            await this.client.ping();
            return this.client;
        } catch (error) {
            logger.error('Redis connection error:', error);
            throw error;
        }
    }

    getClient() {
        if (!this.client) {
            throw new Error('Redis client not initialized');
        }
        return this.client;
    }
}

module.exports = new RedisClient();