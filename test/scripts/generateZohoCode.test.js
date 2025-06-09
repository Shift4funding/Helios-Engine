import { jest } from '@jest/globals';
import axios from 'axios';
import express from 'express';
import path from 'path';
import fs from 'fs/promises';

// Mock dependencies
jest.mock('axios');
jest.mock('express');
jest.mock('fs/promises');
jest.mock('open');

describe('Zoho Authentication Flow', () => {
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock environment variables
        process.env.ZOHO_CLIENT_ID = 'test-client-id';
        process.env.ZOHO_CLIENT_SECRET = 'test-client-secret';
    });

    test('validates configuration correctly', async () => {
        const { validateConfig } = require('../../scripts/generateZohoCode');
        const config = validateConfig();
        
        expect(config).toEqual({
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            redirectUri: 'http://localhost:3000/auth/zoho/callback',
            scope: 'ZohoCRM.modules.ALL'
        });
    });

    test('generates correct auth URL', async () => {
        const { generateAuthUrl } = require('../../scripts/generateZohoCode');
        const config = {
            clientId: 'test-client-id',
            scope: 'ZohoCRM.modules.ALL',
            redirectUri: 'http://localhost:3000/auth/zoho/callback'
        };

        const url = generateAuthUrl(config);
        expect(url).toContain('https://accounts.zoho.com/oauth/v2/auth');
        expect(url).toContain('client_id=test-client-id');
        expect(url).toContain('scope=ZohoCRM.modules.ALL');
    });

    test('handles auth callback successfully', async () => {
        const mockReq = {
            query: { code: 'test-auth-code' }
        };
        
        const mockRes = {
            send: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        // Mock file operations
        fs.readFile.mockResolvedValue('ZOHO_AUTH_CODE=old-code');
        fs.writeFile.mockResolvedValue();

        const { default: app } = require('../../scripts/generateZohoCode');
        await app.get('/auth/zoho/callback')(mockReq, mockRes);

        expect(fs.writeFile).toHaveBeenCalled();
        expect(mockRes.send).toHaveBeenCalled();
    });
});