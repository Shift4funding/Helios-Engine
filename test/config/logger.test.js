// test/config/logger.test.js

// 1. Import the required Jest functions
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock winston's named exports
jest.unstable_mockModule('winston', () => ({
    createLogger: jest.fn(() => ({
        info: jest.fn(),
        error: jest.fn()
    })),
    format: {
        combine: jest.fn(),
        timestamp: jest.fn(),
        json: jest.fn(),
        colorize: jest.fn(),
        printf: jest.fn()
    },
    transports: {
        Console: jest.fn()
    }
}));

describe('Logger Configuration', () => {
    let logger;
    let spy;

    beforeEach(async () => {
        // Import logger after mocks
        const { logger: loggerInstance } = await import('../../src/config/logger.js');
        logger = loggerInstance;
        spy = jest.spyOn(logger, 'info');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should include service name in metadata', () => {
        const logMessage = 'Test log message';
        logger.info(logMessage, { service: 'bank-statement-analyzer' });

        expect(spy).toHaveBeenCalledWith(
            logMessage,
            expect.objectContaining({
                service: 'bank-statement-analyzer'
            })
        );
    });
});