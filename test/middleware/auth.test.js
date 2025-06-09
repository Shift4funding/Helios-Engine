import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../../src/middleware/auth.js';
import { AppError } from '../../src/utils/errors.js';

describe('Authentication Middleware', () => {
    beforeAll(() => {
        process.env.JWT_SECRET = 'testsecret';
    });

    it('should authenticate valid JWT token', async () => {
        const token = jwt.sign({ userId: '123' }, process.env.JWT_SECRET);
        const req = {
            headers: {
                authorization: `Bearer ${token}`
            }
        };
        const res = {};
        const next = jest.fn();

        await authenticateToken(req, res, next);
        expect(req.user).toBeDefined();
        expect(req.user.userId).toBe('123');
        expect(next).toHaveBeenCalled();
    });

    it('should handle missing token', async () => {
        const req = { headers: {} };
        const res = {};
        const next = jest.fn();

        await authenticateToken(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
});