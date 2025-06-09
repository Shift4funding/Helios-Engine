import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors.js';

/**
 * Authentication middleware for JWT validation
 */
export const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            throw new AppError('Authentication token required', 401);
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) throw new AppError('Invalid token', 401);
            req.user = user;
            next();
        });
    } catch (error) {
        next(new AppError(error.message, 401));
    }
};
