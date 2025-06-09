// test/middleware/rateLimiter.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// We will dynamically import the RateLimiter class after setting up mocks
let RateLimiter;

describe('Rate Limiter Middleware', () => {
    let mockReq, mockRes, nextFn;

    beforeEach(async () => {
        // Dynamically import the class for each test to get a fresh version
        const module = await import('../../src/middleware/rateLimiter.js');
        RateLimiter = module.default;

        jest.clearAllMocks();

        // A more complete mock request object
        mockReq = {
            ip: '127.0.0.1',
            headers: {
                'x-forwarded-for': '' // Needs to exist, even if empty
            },
            // The rate-limiter needs a reference to the express app
            app: {
                get: jest.fn((key) => {
                    if (key === 'trust proxy') return false;
                    return null;
                })
            }
        };

        mockRes = {
            status: jest.fn(() => mockRes),
            json: jest.fn(),
            setHeader: jest.fn(),
            get: jest.fn()
        };
        
        nextFn = jest.fn();
    });

    it('should call next() if the rate limit is not exceeded', async () => {
        const rateLimiter = new RateLimiter();
        const middleware = rateLimiter.middleware();

        await middleware(mockReq, mockRes, nextFn);
        
        // Wait for next tick to allow promises to resolve
        await new Promise(process.nextTick);
        
        expect(nextFn).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple requests within limits', async () => {
        const rateLimiter = new RateLimiter();
        const middleware = rateLimiter.middleware();

        const requests = Array(5).fill().map(() => 
            middleware(mockReq, mockRes, nextFn)
        );
        
        await Promise.all(requests);
        
        // Wait for next tick to allow promises to resolve
        await new Promise(process.nextTick);
        
        expect(nextFn).toHaveBeenCalledTimes(5);
    });
});