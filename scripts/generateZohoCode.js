import dotenv from 'dotenv';
import open from 'open';
import express from 'express';
import { writeFile, readFile } from 'fs/promises';
import path from 'path';
import axios from 'axios';

dotenv.config();

const app = express();
const port = 3000;

// Zoho URL configurations
const ZOHO_URLS = {
    homepage: 'https://www.zohoapis.com/crm/v2',
    redirectUri: 'http://localhost:3000/auth/zoho/callback',
    jsDomain: 'http://localhost:3000'
};

// Add debug logging middleware
app.use((req, res, next) => {
    console.log(`🔍 ${req.method} ${req.path}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Query:', JSON.stringify(req.query, null, 2));
    next();
});

// Validate configuration
const validateConfig = () => {
    const config = {
        clientId: process.env.ZOHO_CLIENT_ID,
        clientSecret: process.env.ZOHO_CLIENT_SECRET,
        redirectUri: 'http://localhost:3000/auth/zoho/callback', // Hardcode the correct URI
        scope: 'ZohoCRM.modules.ALL'
    };

    // Check for required values
    const missingValues = Object.entries(config)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

    if (missingValues.length > 0) {
        throw new Error(`Missing required configuration: ${missingValues.join(', ')}`);
    }

    console.log('\n🔍 Configuration:', {
        clientId: `${config.clientId.substring(0, 10)}...`,
        redirectUri: config.redirectUri,
        scope: config.scope
    });

    return config;
};

// Generate auth URL with required parameters
const generateAuthUrl = (config) => {
    const params = new URLSearchParams({
        client_id: config.clientId,
        response_type: 'code',
        scope: config.scope,
        access_type: 'offline',
        redirect_uri: config.redirectUri
    });

    return `https://accounts.zoho.com/oauth/v2/auth?${params.toString()}`;
};

// Handle auth callback
app.get('/auth/zoho/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        console.error('❌ Auth Error:', error);
        res.status(400).send(`Authentication failed: ${error}`);
        return;
    }

    if (!code) {
        console.error('❌ No auth code received');
        res.status(400).send('No authorization code received');
        return;
    }

    try {
        // Save the auth code
        const envPath = path.resolve(process.cwd(), '.env');
        const envContent = await readFile(envPath, 'utf8');
        const updatedContent = envContent.replace(
            /ZOHO_AUTH_CODE=.*/,
            `ZOHO_AUTH_CODE=${code}`
        );

        await writeFile(envPath, updatedContent);

        console.log('✅ Auth code saved:', code);
        res.send(`
            <h1>Authorization Successful!</h1>
            <p>You can close this window.</p>
        `);

        // Exit after successful auth
        setTimeout(() => process.exit(0), 1000);
    } catch (error) {
        console.error('❌ Error saving auth code:', error);
        res.status(500).send('Error saving authorization code');
    }
});

// Verify Zoho URLs configuration
const verifyUrls = () => {
    console.log('\n🌐 Zoho URL Configuration:');
    console.log('------------------------');
    console.log(`📍 Homepage URL: ${ZOHO_URLS.homepage}`);
    console.log(`🔄 Redirect URI: ${ZOHO_URLS.redirectUri}`);
    console.log(`🔗 JavaScript Domain: ${ZOHO_URLS.jsDomain}`);
    console.log('------------------------\n');
};

// Start the auth flow
const startAuth = async () => {
    try {
        verifyUrls(); // Verify Zoho URLs configuration
        const config = validateConfig();
        const authUrl = generateAuthUrl(config);

        app.listen(port, () => {
            console.log('\n🚀 Starting authentication flow...');
            console.log(`📍 Server running on port ${port}`);
            console.log('🌐 Opening browser...\n');
            open(authUrl);
        });
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

startAuth().catch(console.error);