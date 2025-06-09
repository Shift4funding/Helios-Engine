import dotenv from 'dotenv';
import { jest } from '@jest/globals';
import zohoAuthService from '../../src/services/zohoAuthService.js';

dotenv.config();

describe('Zoho Authentication Service', () => {
    it('should exchange auth code for tokens', async () => {
        const authCode = process.env.ZOHO_AUTH_CODE;
        expect(authCode).toBeDefined();

        try {
            const result = await zohoAuthService.exchangeCodeForTokens(authCode);
            
            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
            expect(result).toHaveProperty('expiryTime');
            
            expect(typeof result.accessToken).toBe('string');
            expect(typeof result.refreshToken).toBe('string');
            expect(result.expiryTime).toBeGreaterThan(Date.now());
        } catch (error) {
            console.error('Token exchange failed:', {
                message: error.message,
                data: error.response?.data
            });
            throw error;
        }
    }, 15000);
});