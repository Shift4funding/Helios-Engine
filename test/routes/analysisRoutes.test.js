const request = require('supertest');
const path = require('path');
const app = require('../../src/app');

describe('Analysis Routes', () => {
    const FIXTURES_PATH = path.join(__dirname, '../fixtures');

    test('should reject requests without API key', async () => {
        const response = await request(app)
            .post('/api/analysis/statement')
            .attach('bankStatement', path.join(FIXTURES_PATH, 'sample-statement.pdf'));

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('status', 'error');
        expect(response.body).toHaveProperty('message', 'Invalid or missing API key');
    });

    test('should handle PDF upload and analysis', async () => {
        const response = await request(app)
            .post('/api/analysis/statement')
            .set('X-API-Key', process.env.API_KEY)
            .attach('bankStatement', path.join(FIXTURES_PATH, 'sample-statement.pdf'));

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('parsedStatement');
        expect(response.body.data).toHaveProperty('analysis');
    });

    test('should reject non-PDF files', async () => {
        const response = await request(app)
            .post('/api/analysis/statement')
            .set('X-API-Key', process.env.API_KEY)
            .attach('bankStatement', path.join(FIXTURES_PATH, 'not-a-pdf.txt'));

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('status', 'error');
        expect(response.body).toHaveProperty('message', 'Only PDF files are allowed');
    });
});