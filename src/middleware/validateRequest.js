const { validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');
const logger = require('../config/logger');

/**
 * Validate request against provided validation rules
 */
const validateRequest = (validations) => {
    return async (req, res, next) => {
        try {
            // Run all validations
            await Promise.all(validations.map(validation => validation.run(req)));

            const errors = validationResult(req);
            if (errors.isEmpty()) {
                return next();
            }

            const messages = errors.array().map(err => `${err.param}: ${err.msg}`);
            throw new ValidationError(messages.join(', '));
        } catch (error) {
            logger.warn('Validation failed', {
                path: req.path,
                error: error.message
            });
            next(error);
        }
    };
};

/**
 * Validate PDF file upload
 */
const validateFileUpload = (req, res, next) => {
    try {
        if (!req.file) {
            throw new ValidationError('No PDF file provided');
        }

        if (req.file.mimetype !== 'application/pdf') {
            throw new ValidationError('Only PDF files are allowed');
        }

        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        if (req.file.size > MAX_FILE_SIZE) {
            throw new ValidationError('File size exceeds 10MB limit');
        }

        next();
    } catch (error) {
        logger.warn('File validation failed', {
            path: req.path,
            error: error.message
        });
        next(error);
    }
};

module.exports = {
    validateRequest,
    validateFileUpload
};