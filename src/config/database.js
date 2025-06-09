const mongoose = require('mongoose');
const { logger } = require('../utils');

// Default connection options optimized for production
const connectionOptions = {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    maxPoolSize: 20, // Maintain up to 20 socket connections
    minPoolSize: 5, // Maintain at least 5 socket connections
    heartbeatFrequencyMS: 10000, // Check connection every 10 seconds
    retryWrites: true, // Retry write operations if they fail
    retryReads: true, // Retry read operations if they fail
    autoIndex: process.env.NODE_ENV !== 'production' // Don't build indexes in production
};

/**
 * Connect to MongoDB with retry logic
 * @param {number} retryAttempts - Number of retry attempts
 * @returns {Promise<mongoose.Connection>}
 */
const connectDatabase = async (retryAttempts = 5) => {
    let attempts = 0;
    
    const tryConnect = async () => {
        try {
            attempts++;
            logger.info(`Connecting to MongoDB (attempt ${attempts}/${retryAttempts})`);
            
            const connection = await mongoose.connect(process.env.MONGO_URI, connectionOptions);
            
            logger.info(`MongoDB Connected: ${connection.connection.host}`);
            logger.info(`Database: ${connection.connection.name}`);
            
            return connection;
        } catch (error) {
            logger.error(`MongoDB connection failed (attempt ${attempts}/${retryAttempts}):`, error);
            
            if (attempts < retryAttempts) {
                const delay = Math.min(Math.pow(2, attempts) * 1000, 10000); // Exponential backoff capped at 10s
                logger.info(`Retrying in ${delay / 1000} seconds...`);
                
                return new Promise(resolve => {
                    setTimeout(() => resolve(tryConnect()), delay);
                });
            } else {
                logger.error('Maximum connection attempts reached. Exiting process.');
                process.exit(1);
            }
        }
    };
    
    return tryConnect();
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
    logger.error('MongoDB error:', err);
});

// Graceful handling for application termination
process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed due to application termination');
        process.exit(0);
    } catch (err) {
        logger.error('Error during MongoDB connection close:', err);
        process.exit(1);
    }
});

module.exports = connectDatabase;
