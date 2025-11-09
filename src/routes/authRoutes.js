import express from 'express';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { validateRequest } from '../middleware/validation.js';
import config from '../config/env.js';

const router = express.Router();

// Mock user for testing
const mockUser = {
  id: '123',
  email: 'test@example.com',
  password: '$2a$10$XOPbrlUPQdwdJUpSrIF6X.LbE14qsMmKGhM0Z8Pld7pzo.sRZyYaq' // 'password123'
};

// Login route
router.post('/login', 
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // For testing purposes - check against mock user
      if (email !== mockUser.email) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, mockUser.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: mockUser.id, email: mockUser.email },
        config.jwtSecret || 'your-secret-key',
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: mockUser.id,
            email: mockUser.email
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Server error'
      });
    }
  }
);

// Register route
router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // For testing purposes - just return success
      res.status(201).json({
        success: true,
        data: {
          message: 'User registered successfully',
          user: {
            id: Date.now().toString(),
            email
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Server error'
      });
    }
  }
);

// Logout route
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Logged out successfully'
    }
  });
});

// Get current user
router.get('/me', 
  (req, res, next) => {
    // Check for auth header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    jwt.verify(token, config.jwtSecret || 'your-secret-key', (err, user) => {
      if (err) {
        return res.status(403).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }
      req.user = user;
      next();
    });
  },
  (req, res) => {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  }
);

export default router;