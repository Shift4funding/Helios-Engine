const request = require('supertest');
const app = require('../../src/app');
const { setupTestDatabase, cleanupTestDatabase } = require('../helpers/testDb');

describe('Server Integration Tests', () => {
    beforeAll(async () => {
        await setupTestDatabase();
    });

    afterAll(async () => {
        await cleanupTestDatabase();
    });

    describe('Basic Server Functionality', () => {
        it('should respond to health check', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toEqual({
                status: 'success',
                message: 'Server is healthy'
            });
        });

        it('should handle 404 routes', async () => {
            const response = await request(app)
                .get('/not-existing-route')
                .expect(404);

            expect(response.body).toEqual({
                status: 'fail',
                message: 'Route not found'
            });
        });
    });
});