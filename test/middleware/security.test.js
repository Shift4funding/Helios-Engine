// test/middleware/security.test.js

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

describe('Security Middleware', () => {
    let mockReq;
    let mockRes;
    let nextFn;
    let validateApiKey;

    beforeEach(async () => {
        // Import after mocks are setup in test/setup.js
        const module = await import('../../src/middleware/security.js');
        validateApiKey = module.validateApiKey;

        // Setup test doubles
        mockReq = { headers: {} };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        nextFn = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should call next() if the API key is valid', () => {
        mockReq.headers['x-api-key'] = 'test-api-key';
        validateApiKey(mockReq, mockRes, nextFn);
        expect(nextFn).toHaveBeenCalledTimes(1);
    });

    it('should return a 401 error if the API key is missing', () => {
        validateApiKey(mockReq, mockRes, nextFn);
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
            message: 'Unauthorized: API key is required'
        });
    });

    it('should return a 403 error if the API key is invalid', () => {
        mockReq.headers['x-api-key'] = 'invalid-key';
        validateApiKey(mockReq, mockRes, nextFn);
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
            message: 'Forbidden: Invalid API key'
        });
    });
});