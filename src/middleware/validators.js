const { body, param } = require('express-validator');

exports.validateAnalysisRequest = [
    body('bankName').trim().notEmpty().withMessage('Bank name is required'),
    body('statementDate').optional().isISO8601().withMessage('Invalid date format')
];