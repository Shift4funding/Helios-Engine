import dotenv from 'dotenv';
import { jest } from '@jest/globals';
import zohoService from '../../src/services/zohoService.js';

dotenv.config();

describe('Zoho Authentication', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        zohoService.accessToken = null;
        zohoService.tokenExpiry = null;
    });

    it('should refresh and verify Zoho credentials', async () => {
        // Verify environment variables
        expect(process.env.ZOHO_CLIENT_ID).toBeDefined();
        expect(process.env.ZOHO_CLIENT_SECRET).toBeDefined();
        expect(process.env.ZOHO_AUTH_TOKEN).toBeDefined();

        try {
            const token = await zohoService.refreshAccessToken();
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
        } catch (error) {
            console.error('Zoho authentication error:', {
                message: error.message,
                response: error.response?.data,
                env: {
                    hasClientId: !!process.env.ZOHO_CLIENT_ID,
                    hasClientSecret: !!process.env.ZOHO_CLIENT_SECRET,
                    hasAuthToken: !!process.env.ZOHO_AUTH_TOKEN
                }
            });
            throw error;
        }
    }, 15000);
});