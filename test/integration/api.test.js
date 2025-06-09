import request from 'supertest';
import path from 'path';
import app from '../../src/app';
import { LLMError } from '../../src/utils/errors';

// Mock LLM service with more realistic responses
jest.unstable_mockModule('../../src/services/llmService', () => ({
    analyzeStatement: jest.fn().mockImplementation(async (data) => ({
        success: true,
        data: {
            summary: `Analysis for account ${data.accountInfo.accountHolder}'s statement`,
            patterns: 'Regular monthly deposits and withdrawals detected',
            flags: data.transactions.length > 5 ? 'High transaction volume' : 'No issues found',
            recommendations: 'Consider setting up automatic savings'
        }
    }))
}));

describe('API Integration', () => {
    const FIXTURES_PATH = path.join(__dirname, '../fixtures');
    const API_KEY = 'test-api-key';

    beforeEach(() => {
        process.env.API_KEY = API_KEY;
        jest.clearAllMocks();
    });

    describe('POST /api/analysis/statement', () => {
        it('should analyze PDF statement successfully', async () => {
            const response = await request(app)
                .post('/api/analysis/statement')
                .set('X-API-Key', API_KEY)
                .attach('bankStatement', path.join(FIXTURES_PATH, 'sample-statement.pdf'));

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('parsedStatement');
            expect(response.body.data).toHaveProperty('analysis');
        });

        it('should reject non-PDF files', async () => {
            const response = await request(app)
                .post('/api/analysis/statement')
                .set('X-API-Key', API_KEY)
                .attach('bankStatement', __filename); // Attaching this test file

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('status', 'error');
            expect(response.body.message).toContain('Only PDF files are allowed');
        });

        it('should enforce file size limit', async () => {
            // Create a large buffer
            const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

            const response = await request(app)
                .post('/api/analysis/statement')
                .set('X-API-Key', API_KEY)
                .attach('bankStatement', largeBuffer, 'large.pdf');

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('File size too large');
        });

        it('should handle missing file', async () => {
            const response = await request(app)
                .post('/api/analysis/statement')
                .set('X-API-Key', API_KEY);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('No PDF file provided');
        });

        it('should require API key', async () => {
            const response = await request(app)
                .post('/api/analysis/statement')
                .attach('bankStatement', path.join(FIXTURES_PATH, 'sample-statement.pdf'));

            expect(response.status).toBe(401);
            expect(response.body.message).toContain('Invalid or missing API key');
        });

        it('should handle malformed PDF files', async () => {
            // Create a fake PDF with invalid content
            const invalidPdfBuffer = Buffer.from('%PDF-1.7\nInvalid PDF Content');
            
            const response = await request(app)
                .post('/api/analysis/statement')
                .set('X-API-Key', API_KEY)
                .attach('bankStatement', invalidPdfBuffer, 'invalid.pdf');

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('status', 'error');
            expect(response.body.message).toMatch(/Failed to parse PDF/i);
        });

        it('should handle concurrent requests', async () => {
            const makeRequest = () => request(app)
                .post('/api/analysis/statement')
                .set('X-API-Key', API_KEY)
                .attach('bankStatement', path.join(FIXTURES_PATH, 'sample-statement.pdf'));

            const responses = await Promise.all([
                makeRequest(),
                makeRequest(),
                makeRequest()
            ]);

            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('success', true);
            });
        });

        it('should validate request content-type', async () => {
            const response = await request(app)
                .post('/api/analysis/statement')
                .set('X-API-Key', API_KEY)
                .set('Content-Type', 'application/json')
                .send({ someData: 'not a PDF' });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Invalid request format');
        });
    });

    describe('Error Handling', () => {
        it('should handle LLM service errors gracefully', async () => {
            const llmService = require('../../src/services/llmService');
            llmService.analyzeStatement.mockRejectedValueOnce(
                new LLMError('Service unavailable', 503)
            );

            const response = await request(app)
                .post('/api/analysis/statement')
                .set('X-API-Key', API_KEY)
                .attach('bankStatement', path.join(FIXTURES_PATH, 'sample-statement.pdf'));

            expect(response.status).toBe(503);
            expect(response.body).toHaveProperty('status', 'error');
        });

        it('should handle network timeouts', async () => {
            const llmService = require('../../src/services/llmService');
            llmService.analyzeStatement.mockImplementationOnce(() => 
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Request timeout')), 100)
                )
            );

            const response = await request(app)
                .post('/api/analysis/statement')
                .set('X-API-Key', API_KEY)
                .attach('bankStatement', path.join(FIXTURES_PATH, 'sample-statement.pdf'));

            expect(response.status).toBe(500);
            expect(response.body.message).toContain('Request timeout');
        });
    });

    describe('API Documentation and Health Check', () => {
        describe('GET /api-docs', () => {
            it('should serve API documentation', async () => {
                const response = await request(app).get('/api-docs');
                expect(response.status).toBe(200);
            });
        });

        describe('GET /health', () => {
            it('should return health status', async () => {
                const response = await request(app).get('/health');
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('status');
            });
        });
    });
});