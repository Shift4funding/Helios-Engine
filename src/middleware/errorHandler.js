const { logger, AppError } = require('../utils');

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log error
    logger.error({
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        statusCode: err.statusCode
    });

    // Don't leak error details in production
    const errorResponse = process.env.NODE_ENV === 'development' 
        ? {
            status: err.status,
            message: err.message,
            stack: err.stack
        }
        : {
            status: err.status,
            message: err.isOperational ? err.message : 'Something went wrong'
        };

    res.status(err.statusCode).json(errorResponse);
};

module.exports = errorHandler;