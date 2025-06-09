const express = require('express');
const responseTime = require('response-time');
const { promClient, metrics } = require('../services/metricsService');
const redisClient = require('../config/redis');

const router = express.Router();

// Health check endpoint with detailed status
router.get('/health', async (req, res) => {
    try {
        // Check Redis connection
        await redisClient.ping();
        
        const health = {
            status: 'up',
            timestamp: new Date(),
            services: {
                redis: 'up',
                api: 'up'
            },
            uptime: process.uptime()
        };
        
        res.json(health);
    } catch (error) {
        res.status(503).json({
            status: 'error',
            timestamp: new Date(),
            services: {
                redis: 'down',
                api: 'up'
            },
            error: error.message
        });
    }
});

// Prometheus metrics endpoint
router.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', promClient.register.contentType);
        const metrics = await promClient.register.metrics();
        res.send(metrics);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Usage statistics endpoint
router.get('/stats', async (req, res) => {
    try {
        const stats = await redisClient.hgetall('api:stats');
        res.json({
            totalRequests: parseInt(stats.totalRequests || 0),
            successfulAnalyses: parseInt(stats.successfulAnalyses || 0),
            failedAnalyses: parseInt(stats.failedAnalyses || 0),
            cacheHits: parseInt(stats.cacheHits || 0),
            cacheMisses: parseInt(stats.cacheMisses || 0)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;