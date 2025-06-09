const express = require('express');
const router = express.Router();
const RedisService = require('../services/RedisService');
const mongoose = require('mongoose');
const logger = require('../config/logger');

router.get('/health', async (req, res) => {
    try {
        const status = {
            service: 'bank-statement-analyzer',
            uptime: process.uptime(),
            timestamp: Date.now(),
            version: process.env.npm_package_version,
            services: {
                mongodb: {
                    status: mongoose.connection.readyState === 1 ? 'up' : 'down',
                    latency: await checkMongoLatency()
                },
                redis: {
                    status: await RedisService.ping() ? 'up' : 'down',
                    latency: await checkRedisLatency()
                }
            }
        };

        const isHealthy = status.services.mongodb.status === 'up' && 
                         status.services.redis.status === 'up';

        logger.info(`Health check: ${isHealthy ? 'healthy' : 'unhealthy'}`);
        res.status(isHealthy ? 200 : 503).json(status);
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            status: 'error',
            message: 'Health check failed'
        });
    }
});

async function checkMongoLatency() {
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    return Date.now() - start;
}

async function checkRedisLatency() {
    const start = Date.now();
    await RedisService.ping();
    return Date.now() - start;
}

module.exports = router;