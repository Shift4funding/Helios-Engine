const path = require('path');
const { AppError, ValidationError, PDFParseError, LLMError } = require('./errors');
const logger = require('./logger');
const cacheService = require('./cacheService');
const metrics = require('./metrics');

// Export all utilities as named exports
module.exports = {
    // Error classes
    AppError,
    ValidationError,
    PDFParseError,
    LLMError,
    
    // Core utilities
    logger,
    cacheService,
    metrics,
    
    // Helper functions
    sanitizePath: (filePath) => path.normalize(filePath),
    
    // Constants
    ALLOWED_FILE_TYPES: ['application/pdf'],
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    
    // Error messages
    ERRORS: {
        INVALID_FILE_TYPE: 'Invalid file type. Only PDF files are allowed.',
        FILE_TOO_LARGE: 'File size exceeds the 5MB limit.',
        MISSING_FILE: 'No file was uploaded.',
        INVALID_API_KEY: 'Invalid API key provided.'
    }
};