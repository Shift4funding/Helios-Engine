import { ValidationError } from '../utils/errors.js';

const { body, header, query } = require('express-validator');

const analysisValidation = [
    // API Key validation
    header('X-API-Key')
        .exists()
        .withMessage('API key is required')
        .isString()
        .withMessage('API key must be a string')
        .isLength({ min: 32, max: 64 })
        .withMessage('Invalid API key format'),

    // Zoho integration validation
    body('zohoRecordId')
        .optional()
        .isString()
        .trim()
        .matches(/^[0-9a-zA-Z]+$/)
        .withMessage('Invalid Zoho record ID format')
        .isLength({ min: 10, max: 50 })
        .withMessage('Zoho record ID must be between 10 and 50 characters'),

    // Optional metadata validation
    body('metadata.requestedBy')
        .optional()
        .isString()
        .trim()
        .escape()
        .isLength({ max: 100 })
        .withMessage('Requested by field too long'),

    body('metadata.priority')
        .optional()
        .isIn(['low', 'medium', 'high'])
        .withMessage('Invalid priority level'),

    // Date range validation (if provided)
    body('dateRange.start')
        .optional()
        .isISO8601()
        .withMessage('Invalid start date format'),

    body('dateRange.end')
        .optional()
        .isISO8601()
        .withMessage('Invalid end date format')
        .custom((value, { req }) => {
            if (req.body.dateRange?.start && value <= req.body.dateRange.start) {
                throw new Error('End date must be after start date');
            }
            return true;
        })
];

// Add new file validation rules
const extendedFileValidation = (req, res, next) => {
    try {
        if (!req.file) {
            throw new ValidationError('No PDF file provided');
        }

        // Basic file checks
        if (req.file.mimetype !== 'application/pdf') {
            throw new ValidationError('Only PDF files are allowed');
        }

        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        if (req.file.size > MAX_FILE_SIZE) {
            throw new ValidationError('File size exceeds 10MB limit');
        }

        // Additional security checks
        if (req.file.originalname.includes('..')) {
            throw new ValidationError('Invalid file name');
        }

        // Check file signature/magic numbers for PDF
        const fileHeader = req.file.buffer.slice(0, 4).toString('hex');
        if (!fileHeader.startsWith('25504446')) { // PDF magic number
            throw new ValidationError('Invalid PDF file format');
        }

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    analysisValidation,
    extendedFileValidation
};