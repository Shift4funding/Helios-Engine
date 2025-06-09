export class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

export class PDFParseError extends AppError {
    constructor(message) {
        super(message, 400);
        this.name = 'PDFParseError';
    }
}

export class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
        this.name = 'ValidationError';
    }
}

export class LLMError extends AppError {
    constructor(message, statusCode = 503) {
        super(message, statusCode);
        this.name = 'LLMError';
    }
}

export class ZohoAPIError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = 'ZohoAPIError';
        this.statusCode = statusCode;
    }
}
