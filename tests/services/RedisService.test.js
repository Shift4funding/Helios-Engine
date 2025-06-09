require('dotenv').config();
const RedisService = require('../../src/services/RedisService');

// Mock Redis client
jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => ({
        ping: jest.fn().mockResolvedValue('PONG'),
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockImplementation((key) => {
            return Promise.resolve(JSON.stringify({ data: 'test-value' }));
        }),
        quit: jest.fn().mockResolvedValue('OK'),
        on: jest.fn()
    }));
});

describe('RedisService', () => {
    beforeAll(async () => {
        await RedisService.connect();
    });

    afterAll(async () => {
        await RedisService.disconnect();
    });

    it('should set and get a value', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };
        
        await RedisService.set(key, value);
        const result = await RedisService.get(key);
        
        expect(result).toEqual(value);
    });

    it('should handle connection errors', async () => {
        const originalClient = RedisService.client;
        RedisService.client = null;

        await expect(RedisService.set('key', 'value'))
            .rejects
            .toThrow('Redis not connected');

        RedisService.client = originalClient;
    });
});