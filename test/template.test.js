import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module path handling
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define mocks before jest.mock calls
const mockImplementation = {
    doSomething: jest.fn().mockResolvedValue('mocked result'),
    processData: jest.fn().mockReturnValue({ status: 'success' })
};

// Setup mocks before importing actual modules
jest.mock('../../src/services/myService.js', () => ({
    default: mockImplementation
}));

// Import actual modules after mocks
import myService from '../../src/services/myService.js';

describe('Service Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should use mocked service', async () => {
        const result = await myService.doSomething();
        expect(result).toBe('mocked result');
    });

    it('should handle dynamic imports', async () => {
        await jest.isolateModulesAsync(async () => {
            const { default: config } = await import('../../src/config.js');
            expect(config).toBeDefined();
        });
    });
});