import { jest } from '@jest/globals';

// Mock environment configuration
jest.unstable_mockModule('../src/config/env.js', () => ({
    default: {
        security: { apiKey: 'test-api-key' }
    }
}));

console.log('✅ Jest setup file loaded successfully in ESM mode');
