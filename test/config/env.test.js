// test/config/env.test.js

import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

// Mock dotenv using ES Module syntax
const mockConfig = jest.fn();
jest.unstable_mockModule('dotenv', () => ({
    config: mockConfig
}));

describe('Environment Configuration', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...OLD_ENV };
        process.env.NODE_ENV = 'test';
        process.env.API_KEY = 'test-api-key';
        process.env.PERPLEXITY_API_KEY = 'test-perplexity-key';
    });

    afterAll(() => {
        process.env = OLD_ENV;
        jest.resetModules();
    });

    it('should load configuration with default values', async () => {
        const { default: config } = await import('../../src/config/env.js');

        expect(config).toBeDefined();
        expect(config.server.port).toBe(3000); // Changed from 3001 to 3000
        expect(config.security.apiKey).toBe('test-api-key');
    });

    it('should throw error when required values are missing', async () => {
        delete process.env.API_KEY;
        delete process.env.PERPLEXITY_API_KEY;

        // 3. The test logic remains the same, but now it will work
        await expect(import('../../src/config/env.js'))
          .rejects.toThrow('Missing required configuration: API_KEY, PERPLEXITY_API_KEY');
    });

    it('should override defaults with environment values', async () => {
        process.env.PORT = '4000';
        const { default: config } = await import('../../src/config/env.js');
        expect(config.server.port).toBe(4000);
    });
});