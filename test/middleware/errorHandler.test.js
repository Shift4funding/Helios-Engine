const errorHandler = require('../../src/middleware/errorHandler');
const { AppError } = require('../../src/utils/errors');
const logger = require('../../src/config/logger');

jest.mock('../../src/config/logger');

describe('Error Handler Middleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        mockReq = {
            path: '/test',
            method: 'GET',
            id: 'test-id'
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        mockNext = jest.fn();
        logger.error.mockClear();
    });

    it('should handle operational errors', () => {
        const error = new AppError('Test error', 400);
        
        errorHandler(error, mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
            status: 'fail',
            message: 'Test error'
        });
        expect(logger.error).toHaveBeenCalled();
    });

    it('should hide error details in production', () => {
        process.env.NODE_ENV = 'production';
        const error = new Error('System error');
        
        errorHandler(error, mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            status: 'error',
            message: 'Something went wrong'
        });
    });
});