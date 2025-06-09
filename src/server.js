// server.js


require('dotenv').config();
const app = require('./app');
const { logger } = require('./utils');

const port = process.env.PORT || 3000;

const gracefulShutdown = (server, code) => {
    logger.info(`Received ${code}. Starting graceful shutdown...`);
    server.close(() => {
        logger.info('Server closed');
        process.exit(code === 'SIGTERM' ? 0 : 1);
    });
};

process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    logger.error(err.name, err.message, err.stack);
    process.exit(1);
});

const server = app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
});

process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
    logger.error(err.name, err.message);
    gracefulShutdown(server, 'UNHANDLED REJECTION');
});

process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
process.on('SIGINT', () => gracefulShutdown(server, 'SIGINT'));