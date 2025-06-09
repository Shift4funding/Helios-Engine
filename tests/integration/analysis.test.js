import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../../src/app.js';
import { 
    getFixturePath, 
    setupTestDatabase, 
    cleanupTestDatabase, 
    generateTestPDF 
} from '../testHelpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Analysis Integration Tests', () => {
    const testPdfPath = path.join(__dirname, '../fixtures/test-statement.pdf');
    let testPdfBuffer;

    beforeAll(async () => {
        // Setup test environment
        await setupTestDatabase();
        
        // Generate test PDF if it doesn't exist
        try {
            testPdfBuffer = await fs.readFile(testPdfPath);
        } catch {
            testPdfBuffer = await generateTestPDF({
                bankName: 'Test Bank',
                accountNumber: '1234567890',
                transactions: [
                    { date: '2025-01-01', description: 'SALARY DEPOSIT', amount: 5000 },
                    { date: '2025-01-15', description: 'RENT PAYMENT', amount: -2000 },
                    { date: '2025-01-31', description: 'UTILITIES', amount: -150 }
                ]
            });
            await fs.mkdir(path.dirname(testPdfPath), { recursive: true });
            await fs.writeFile(testPdfPath, testPdfBuffer);
        }
    });

    afterAll(async () => {
        await cleanupTestDatabase();
    });

    it('should upload PDF and return analysis', async () => {
        const response = await request(app)
            .post('/api/analysis/upload')
            .attach('statement', testPdfPath)
            .expect('Content-Type', /json/)
            .expect(200);

        expect(response.body).toMatchObject({
            id: expect.any(String),
            businessMetrics: {
                cashFlow: {
                    monthlyAverages: expect.any(Object),
                    stability: expect.any(Number),
                    trends: expect.any(Array)
                },
                riskIndicators: {
                    nsf: expect.any(Array),
                    riskScore: expect.any(Number)
                },
                operatingStats: expect.any(Object),
                cashReserves: expect.any(Object)
            },
            metadata: {
                analyzedAt: expect.any(String),
                bankName: 'Test Bank',
                accountNumber: expect.any(String)
            }
        });
    });

    it('should return 400 if no file is uploaded', async () => {
        await request(app)
            .post('/api/analysis/upload')
            .expect(400)
            .expect({
                error: 'No PDF file provided'
            });
    });

    it('should get analysis by ID', async () => {
        // First upload a statement
        const uploadResponse = await request(app)
            .post('/api/analysis/upload')
            .attach('statement', testPdfPath);

        const analysisId = uploadResponse.body.id;

        // Then retrieve the analysis
        const response = await request(app)
            .get(`/api/analysis/${analysisId}`)
            .expect(200);

        expect(response.body).toHaveProperty('businessMetrics');
        expect(response.body.id).toBe(analysisId);
    });

    it('should handle invalid PDF files', async () => {
        const invalidPdfPath = path.join(__dirname, '../fixtures/invalid.pdf');
        await fs.writeFile(invalidPdfPath, 'Not a PDF file');

        const response = await request(app)
            .post('/api/analysis/upload')
            .attach('statement', invalidPdfPath)
            .expect(400);

        expect(response.body).toMatchObject({
            error: expect.stringContaining('Invalid PDF')
        });

        await fs.unlink(invalidPdfPath);
    });

    it('should analyze uploaded statement', async () => {
        const response = await request(app)
            .post('/api/analysis')
            .send({
                transactions: [
                    { date: '2025-01-01', description: 'SALARY', amount: 5000 },
                    { date: '2025-01-15', description: 'RENT', amount: -2000 }
                ]
            })
            .expect(200);

        expect(response.body).toMatchObject({
            businessMetrics: {
                cashFlow: expect.any(Object),
                riskIndicators: expect.any(Object)
            }
        });
    });
});