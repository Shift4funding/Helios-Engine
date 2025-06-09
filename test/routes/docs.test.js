// test/routes/docs.test.js

import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js'; // Note the .js extension

describe('API Documentation', () => {
    it('should serve Swagger documentation', async () => {
        const response = await request(app)
            .get('/api-docs/')
            .expect('Content-Type', /html/)
            .expect(200);

        expect(response.text).toContain('swagger-ui');
        expect(response.text).toContain('Bank Statement Analyzer API');
    });

    it('should serve OpenAPI specification', async () => {
        const response = await request(app)
            .get('/api-docs/swagger.json')
            .expect('Content-Type', /application\/json/)
            .expect(200);

        expect(response.body.openapi).toBe('3.0.0');
        expect(response.body.info.title).toBe('Bank Statement Analyzer API');
        expect(response.body.servers).toBeDefined();
    });
});