import { zohoAuth } from './auth.js';

export const zohoConfig = {
    auth: {
        clientId: process.env.ZOHO_CLIENT_ID,
        clientSecret: process.env.ZOHO_CLIENT_SECRET,
        redirectUri: process.env.ZOHO_REDIRECT_URI
    },
    endpoints: {
        crm: 'https://www.zohoapis.com/crm/v3',
        sheets: 'https://sheet.zoho.com/api/v2'
    }
};