import { describe, it, expect, jest } from '@jest/globals';
import { AppError, PDFParseError, LLMError, ValidationError } from '../../src/utils/errors.js';

describe('Error Classes', () => {
    describe('AppError', () => {
        it('should create operational error with default values', () => {
            const error = new AppError('Test error');
            
            expect(error).toBeInstanceOf(Error);
            expect(error.statusCode).toBe(500);
            expect(error.status).toBe('error');
            expect(error.isOperational).toBe(true);
        });

        it('should create client error with status fail', () => {
            const error = new AppError('Bad request', 400);
            
            expect(error.status).toBe('fail');
            expect(error.statusCode).toBe(400);
        });
    });

    describe('Specific Error Types', () => {
        it('should create PDF parse error', () => {
            const error = new PDFParseError('Invalid PDF');
            
            expect(error).toBeInstanceOf(AppError);
            expect(error.statusCode).toBe(400);
            expect(error.name).toBe('PDFParseError');
        });

        it('should create LLM error with custom status code', () => {
            const error = new LLMError('API unavailable', 503);
            
            expect(error).toBeInstanceOf(AppError);
            expect(error.statusCode).toBe(503);
            expect(error.name).toBe('LLMError');
        });
    });
});
