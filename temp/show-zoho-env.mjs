import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mask = (value = '') => {
  if (!value) return '(missing)';
  if (value.length <= 8) return `${value[0]}***${value[value.length - 1]}`;
  return `${value.slice(0,4)}***${value.slice(-4)} (len=${value.length})`;
};

console.log('ZOHO_CLIENT_ID:', mask(process.env.ZOHO_CLIENT_ID));
console.log('ZOHO_CLIENT_SECRET:', mask(process.env.ZOHO_CLIENT_SECRET));
console.log('ZOHO_REFRESH_TOKEN:', mask(process.env.ZOHO_REFRESH_TOKEN));
console.log('ZOHO_API_DOMAIN:', process.env.ZOHO_API_DOMAIN || '(default https://www.zohoapis.com)');
console.log('ZOHO_AUTH_URL:', process.env.ZOHO_AUTH_URL || process.env.ZOHO_ACCOUNTS_URL || '(default https://accounts.zoho.com/oauth/v2/token)');
