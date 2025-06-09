const healthCheck = require('../../src/middleware/healthCheck');

describe('Health Check', () => {
    it('should return healthy status when Redis is up', async () => {
        const health = await healthCheck.check();
        expect(health.status).toBe('healthy');
        expect(health.redis.status).toBe('up');
        expect(health.redis.latency).toBeDefined();
    });
});