jest.mock('../../src/config/env', () => 
    require('../mocks/configMock')
);
jest.mock('../../src/middleware/rateLimiter', () => 
    require('../mocks/redisRateLimiterMock')
);

const securityMiddleware = require('../../src/middleware/security');
const config = require('../../src/config/env');
const fs = require('fs').promises;
const path = require('path');

describe('Security Middleware', () => {
    let mockReq;
    let mockRes;
    let nextFunction;

    beforeEach(() => {
        mockReq = {
            body: { 
                test: '<script>alert("xss")</script>',
                html: '<p>Hello <script>bad</script></p>'
            },
            params: { id: { $gt: '' } },
            query: { filter: '; DROP TABLE users;' },
            file: null
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            setHeader: jest.fn()
        };
        nextFunction = jest.fn();
    });

    describe('sanitizeData', () => {
        it('should sanitize HTML and remove malicious content', () => {
            securityMiddleware.sanitizeData(mockReq, mockRes, nextFunction);
            
            expect(mockReq.body.test).toBe('alert("xss")');
            expect(mockReq.body.html).toBe('Hello');
            expect(nextFunction).toHaveBeenCalled();
        });

        it('should sanitize MongoDB injection attempts', () => {
            securityMiddleware.sanitizeData(mockReq, mockRes, nextFunction);
            
            expect(mockReq.params.id).not.toHaveProperty('$gt');
            expect(mockReq.query.filter).toBe('DROP TABLE users;');
        });
    });

    describe('rateLimiter', () => {
        it('should block excessive requests', async () => {
            const req = { ip: '127.0.0.1' };
            const middleware = await securityMiddleware.rateLimiter(req, mockRes, nextFunction);
            
            // Simulate multiple requests
            for (let i = 0; i <= config.security.rateLimit.max; i++) {
                await middleware(req, mockRes, nextFunction);
            }
            
            // Verify the last request was blocked
            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Too many requests'
                })
            );
        });
    });

    describe('validatePDF', () => {
        beforeAll(async () => {
            // Create test PDF buffer
            const pdfPath = path.join(__dirname, '../fixtures/test.pdf');
            const pdfExists = await fs.access(pdfPath).then(() => true).catch(() => false);
            
            if (!pdfExists) {
                // Create a minimal valid PDF for testing
                const minimalPDF = '%PDF-1.4\n%EOF';
                await fs.writeFile(pdfPath, minimalPDF);
            }
        });

        it('should validate a legitimate PDF file', async () => {
            const pdfBuffer = await fs.readFile(
                path.join(__dirname, '../fixtures/test.pdf')
            );
            mockReq.file = {
                buffer: pdfBuffer,
                size: 1024 * 1024,
                mimetype: 'application/pdf'
            };

            await securityMiddleware.validatePDF(mockReq, mockRes, nextFunction);
            expect(mockReq.fileMetadata.hash).toBeDefined();
            expect(mockReq.fileMetadata.hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash format
        });

        it('should reject oversized files', async () => {
            mockReq.file = {
                buffer: Buffer.alloc(6 * 1024 * 1024),
                size: 6 * 1024 * 1024,
                mimetype: 'application/pdf'
            };

            await securityMiddleware.validatePDF(mockReq, mockRes, nextFunction);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'File too large. Maximum size is 5MB.'
            });
        });

        it('should reject non-PDF files', async () => {
            mockReq.file = {
                buffer: Buffer.from('fake image data'),
                size: 1024,
                mimetype: 'image/jpeg'
            };

            await securityMiddleware.validatePDF(mockReq, mockRes, nextFunction);
            expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });
});