import dotenv from 'dotenv';
import request from 'supertest';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import app from '../testApp';

dotenv.config({ path: '.env.test' });
    beforeAll(() => {
        // Create test PDF if it doesn't exist
        fs.writeFileSync(
            TEST_PDF_PATH,
            Buffer.from('Mock PDF content')
        );
    });
    beforeAll(() => {
        // Create test PDF if it doesn't exist
        require('fs').writeFileSync(
            TEST_PDF_PATH,
            Buffer.from('Mock PDF content')
        );
    });

    describe('Basic API Tests', () => {
        it('should return 200 on health check', async () => {
            const response = await request(app).get('/health');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'ok');
    });

    describe('POST /api/analysis/statement', () => {
        it('should analyze bank statement', async () => {
            const response = await request(app)
                .post('/api/analysis/statement')
                .attach('bankStatement', TEST_PDF_PATH);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('summary');
        });
    });
});