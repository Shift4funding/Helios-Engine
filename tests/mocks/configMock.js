module.exports = {
    services: {
        perplexity: {
            apiUrl: 'https://api.perplexity.test',
            apiKey: 'test-key'
        }
    },
    security: {
        rateLimit: {
            windowMs: 1000,
            max: 5
        },
        allowedOrigins: ['http://localhost:3000'],
        maxFileSize: 5 * 1024 * 1024
    }
};