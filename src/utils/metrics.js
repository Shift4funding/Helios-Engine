const client = require('prom-client');

// Create a Registry
const register = new client.Registry();

// Define custom metrics only if they don't exist
const metrics = {
    httpRequestDuration: register.getSingleMetric('http_request_duration_seconds') || 
        new client.Histogram({
            name: 'http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'status'],
            registers: [register]
        }),
    
    bankStatementAnalysis: register.getSingleMetric('bank_statement_analysis_duration_seconds') || 
        new client.Histogram({
            name: 'bank_statement_analysis_duration_seconds',
            help: 'Duration of bank statement analysis in seconds',
            labelNames: ['status'],
            registers: [register]
        })
};

module.exports = {
    register,
    metrics
};