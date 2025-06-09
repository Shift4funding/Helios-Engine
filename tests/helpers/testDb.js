const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'error',
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

let mongoServer;

const setupTestDatabase = async () => {
    try {
        // Close existing connections
        await mongoose.disconnect();
        
        // Create new server instance
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        
        // Connect to the in-memory database
        await mongoose.connect(mongoUri);
        
        logger.info('Test database connected');
    } catch (error) {
        logger.error('Test database setup failed:', error);
        throw error;
    }
};

const cleanupTestDatabase = async () => {
    try {
        // Only cleanup if we have an active connection
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.dropDatabase();
            await mongoose.disconnect();
        }
        
        // Stop the in-memory server
        if (mongoServer) {
            await mongoServer.stop();
            mongoServer = null;
        }
        
        logger.info('Test database cleanup completed');
    } catch (error) {
        logger.error('Test database cleanup failed:', error);
        throw error;
    }
};

module.exports = {
    setupTestDatabase,
    cleanupTestDatabase
};