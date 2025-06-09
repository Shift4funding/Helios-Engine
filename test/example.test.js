import { describe, it, expect, jest } from '@jest/globals';
import { createUser, getUser } from '../../src/services/userService.js';
import { database as mockDatabase } from '../mocks/database.mock.js';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module path handling
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock setup
jest.mock('../../src/services/database.js', () => ({
    default: mockDatabase,
    connect: jest.fn()
}));

// Define mock before jest.mock
const mockService = {
    doSomething: jest.fn().mockResolvedValue('mocked result')
};

// Setup mock before importing actual service
jest.mock('../../src/services/service.js', () => ({
    realService: jest.fn().mockImplementation(() => mockService)
}));

// Import actual service after mock setup
import { realService } from '../../src/services/service.js';

// Test suite
describe('Service Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create user', async () => {
        const user = await createUser('test@example.com');
        expect(user.email).toBe('test@example.com');
    });

    it('should load configuration dynamically', async () => {
        await jest.isolateModulesAsync(async () => {
            process.env.TEST_MODE = 'true';
            const { default: config } = await import('../../src/config.js');
            expect(config.testMode).toBe(true);
        });
    });

    it('should use mocked service', async () => {
        const result = await realService();
        expect(result).toEqual(mockService);
    });
});

describe('Example Test', () => {
    it('should work', () => {
        expect(true).toBe(true);
    });
});