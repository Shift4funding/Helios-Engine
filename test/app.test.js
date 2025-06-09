import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';

// Mock dependencies
jest.unstable_mockModule('express', () => ({
    default: jest.fn(() => ({
        use: jest.fn(),
        listen: jest.fn()
    }))
}));

describe('App Configuration', () => {
    let app;

    beforeEach(async () => {
        // Import app after mocks
        const { default: appModule } = await import('../src/app.js');
        app = appModule;
    });

    test('should have security headers', async () => {
        const response = await request(app).get('/');
        
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('DENY');
        expect(response.headers['x-xss-protection']).toBe('1; mode=block');
        expect(response.headers['strict-transport-security'])
            .toBe('max-age=31536000; includeSubDomains');
    });

    test('should return 404 for unknown routes', async () => {
        const response = await request(app)
            .get('/unknown-route')
            .set('X-API-Key', process.env.API_KEY);

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('status', 'error');
        expect(response.body).toHaveProperty('message');
    });
});