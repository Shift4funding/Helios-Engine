const promClient = require('prom-client');
const logger = require('../utils/logger');

// Enable default metrics
promClient.collectDefaultMetrics();

// Custom metrics
const httpRequestDurationMicroseconds = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5]
});

const analysisCounter = new promClient.Counter({
    name: 'statement_analysis_total',
    help: 'Total number of statement analyses performed',
    labelNames: ['status']
});

const cacheLookups = new promClient.Counter({
    name: 'cache_lookups_total',
    help: 'Total number of cache lookups',
    labelNames: ['hit', 'miss']
});

module.exports = {
    promClient,
    metrics: {
        httpRequestDuration: httpRequestDurationMicroseconds,
        analysisCounter,
        cacheLookups
    }
};