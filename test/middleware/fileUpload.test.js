import request from 'supertest';
import path from 'path';
import { promises as fs } from 'fs';
import app from '../../src/app.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('File Upload Middleware', () => {
    const fixturesDir = path.join(__dirname, '../fixtures');
    const testPdfPath = path.join(fixturesDir, 'sample.pdf');
    
    beforeAll(async () => {
        // Setup test environment
        process.env.NODE_ENV = 'test';
        
        // Create test directories and files
        await fs.mkdir(fixturesDir, { recursive: true });
        const pdfContent = Buffer.from('%PDF-1.4\nMock PDF content');
        await fs.writeFile(testPdfPath, pdfContent);
    });

    afterEach(async () => {
        // Clean up any test files except sample.pdf
        const testFiles = await fs.readdir(fixturesDir).catch(() => []);
        await Promise.all(
            testFiles
                .filter(file => file !== 'sample.pdf')
                .map(file => fs.unlink(path.join(fixturesDir, file)).catch(() => {}))
        );
    });

    afterAll(async () => {
        try {
            await fs.unlink(testPdfPath).catch(() => {});
            await fs.rmdir(fixturesDir, { recursive: true }).catch(() => {});
            // Allow time for connections to close
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });

    it('should accept PDF files up to 50MB', async () => {
        const response = await request(app)
            .post('/api/analysis/statement')
            .attach('bankStatement', testPdfPath)
            .set('Accept', 'application/json')
            .timeout(5000);

        expect(response.status).toBe(200);
    }, 10000);

    it('should reject non-PDF files', async () => {
        const txtPath = path.join(fixturesDir, 'test.txt');
        await fs.writeFile(txtPath, 'test content');

        const response = await request(app)
            .post('/api/analysis/statement')
            .attach('bankStatement', txtPath)
            .set('Accept', 'application/json')
            .timeout(5000);

        expect(response.status).toBe(415);
        expect(response.body.message).toBe('Only PDF files are allowed');
    }, 10000);

    it('should reject files larger than 50MB', async () => {
        const largePath = path.join(fixturesDir, 'large.pdf');
        const largeBuffer = Buffer.alloc(51 * 1024 * 1024, '%PDF-1.4\n');
        await fs.writeFile(largePath, largeBuffer);

        const response = await request(app)
            .post('/api/analysis/statement')
            .attach('bankStatement', largePath)
            .set('Accept', 'application/json')
            .timeout(10000);

        expect(response.status).toBe(413);
        expect(response.body.message).toBe('File too large. Maximum size is 50MB');
    }, 15000);
});