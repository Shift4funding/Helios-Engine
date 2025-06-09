import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class ZohoAuthService {
    constructor() {
        this.clientId = process.env.ZOHO_CLIENT_ID;
        this.clientSecret = process.env.ZOHO_CLIENT_SECRET;
        this.redirectUri = 'http://localhost:3000/auth/zoho/callback';
    }

    async exchangeCodeForTokens(code) {
        if (!code || code === '<paste-new-code-here>') {
            throw new Error('Valid authorization code is required');
        }

        try {
            // Log request details for debugging
            console.log('Attempting token exchange with:', {
                clientId: this.clientId?.substring(0, 8) + '...',
                hasSecret: !!this.clientSecret,
                code: code?.substring(0, 8) + '...',
                redirectUri: this.redirectUri
            });

            const formData = new URLSearchParams({
                code: code,
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'authorization_code',
                redirect_uri: this.redirectUri
            });

            const response = await axios({
                method: 'post',
                url: 'https://accounts.zoho.com/oauth/v2/token',
                data: formData,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                }
            });

            if (!response.data.access_token) {
                throw new Error('No access token received in response');
            }

            return {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiryTime: Date.now() + ((response.data.expires_in || 3600) * 1000)
            };
        } catch (error) {
            const errorDetails = {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            };
            console.error('Token exchange failed:', JSON.stringify(errorDetails, null, 2));
            throw new Error(`Token exchange failed: ${error.response?.data?.error || error.message}`);
        }
    }
}

export default new ZohoAuthService();