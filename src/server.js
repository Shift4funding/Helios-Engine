// server.js

const express = require('express');
const dotenv = require('dotenv');
const app = require('./app');

// Load environment variables from .env file
dotenv.config();

// Verify environment variables are loaded
if (!process.env.PERPLEXITY_API_KEY) {
    console.error('WARNING: Perplexity API key is not set in environment variables');
    process.exit(1);
}

// Check if the API key has a valid format
if (process.env.PERPLEXITY_API_KEY?.startsWith('pplx-')) {
    const maskedKey = process.env.PERPLEXITY_API_KEY.substring(0, 10) + '...' + 
                      process.env.PERPLEXITY_API_KEY.slice(-4);
    console.log('API Key loaded:', maskedKey);
} else {
    console.error('WARNING: Invalid Perplexity API key format');
    process.exit(1);
}

// Set the port from environment variables or default to 3000
const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});