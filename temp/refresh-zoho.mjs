import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import ZohoCrmService from '../src/services/crm/zoho.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const config = {
  clientId: process.env.ZOHO_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_REFRESH_TOKEN,
  apiDomain: process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com',
  apiVersion: 'v2',
  accountsUrl: process.env.ZOHO_AUTH_URL || process.env.ZOHO_ACCOUNTS_URL
};

async function main() {
  try {
    const service = new ZohoCrmService(config);
    await service.refreshAccessToken();
    console.log('✅ Token refresh succeeded');
  } catch (error) {
    console.error('❌ Token refresh failed:', error.message);
    if (error.response?.data) {
      console.error('Zoho response:', error.response.data);
    }
  }
}

main();
