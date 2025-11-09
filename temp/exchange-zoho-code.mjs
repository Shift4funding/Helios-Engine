#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const rawArgs = process.argv.slice(2);
const args = {};
for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === '--code' || arg === '-c') {
    args.code = rawArgs[++i];
  } else if (arg === '--region' || arg === '-r') {
    args.region = rawArgs[++i];
  } else if (arg === '--accountsUrl' || arg === '-u') {
    args.accountsUrl = rawArgs[++i];
  }
}

if (!args.code) {
  console.error('Usage: node temp/exchange-zoho-code.mjs --code <authorization_code> [--region us|eu|in|au|cn] [--accountsUrl <custom>]');
  process.exit(1);
}

const REGIONS = {
  us: 'https://accounts.zoho.com',
  eu: 'https://accounts.zoho.eu',
  in: 'https://accounts.zoho.in',
  cn: 'https://accounts.zoho.com.cn',
  au: 'https://accounts.zoho.com.au',
  jp: 'https://accounts.zoho.jp'
};

const accountsBase = args.accountsUrl || REGIONS[args.region || 'us'];

if (!accountsBase) {
  console.error('Unknown region. Valid options: us, eu, in, cn, au, jp');
  process.exit(1);
}

const clientId = process.env.ZOHO_CLIENT_ID;
const clientSecret = process.env.ZOHO_CLIENT_SECRET;
const redirectUri = process.env.ZOHO_REDIRECT_URI || 'http://localhost:3000/auth/zoho/callback';

if (!clientId || !clientSecret) {
  console.error('Missing ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET in .env');
  process.exit(1);
}

if (!redirectUri) {
  console.error('Missing ZOHO_REDIRECT_URI in .env and no fallback was provided.');
  process.exit(1);
}

(async () => {
  try {
    const tokenUrl = `${accountsBase}/oauth/v2/token`;
    const params = new URLSearchParams({
      code: args.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.data.access_token && !response.data.refresh_token) {
      console.log('Response payload:', response.data);
    }
    console.log('Access token:', response.data.access_token || '(not returned)');
    console.log('Refresh token:', response.data.refresh_token || '(not returned)');
    console.log('Expires in (seconds):', response.data.expires_in || '(unknown)');
  } catch (error) {
    console.error('Failed to exchange code:', error.response?.data || error.message);
    process.exit(1);
  }
})();
