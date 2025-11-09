/**
 * @license
 * Copyright (c) 2025 Shift 4 Financial INC
 * This code is licensed under the MIT License.
 * See LICENSE file for details.
 */

// Load environment variables FIRST before any other imports
import './config/env.js';

import mongoose from 'mongoose';
import app from './app.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 3000;

// Database connection (optional for now)
const connectDB = async () => {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      logger.info('Connected to MongoDB');
    } else {
      logger.warn('MongoDB URI not provided, running without database');
    }
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    logger.warn('Continuing without database connection');
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  logger.error('Stack trace:', err.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', err);
  logger.error('Stack trace:', err.stack);
  process.exit(1);
});

// Handle warnings
process.on('warning', (warning) => {
  logger.warn('Warning:', warning.name, warning.message);
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    
    const server = app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Upload endpoint: http://localhost:${PORT}/api/statements`);
      logger.info(`Metrics endpoint: http://localhost:${PORT}/api/metrics`);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        logger.error('Server error:', error);
        process.exit(1);
      }
    });
    
    // Handle process termination
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
