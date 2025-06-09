/**
 * @license
 * Copyright (c) 2025 [Your Name]
 * This code is licensed under the MIT License.
 * See LICENSE file for details.
 */

// This file configures the Express application, sets up middleware for parsing requests, and defines API routes.

const express = require('express');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const docsRouter = require('./routes/docs');
const analysisRouter = require('./routes/analysisRoutes');
const queryRoutes = require('./routes/queryRoutes');
const prometheusMiddleware = require('express-prometheus-middleware');
const client = require('prom-client');
const responseTime = require('response-time');
const monitoringRoutes = require('./routes/monitoringRoutes');
const { sanitizeRequest } = require('./middleware/sanitizer');
const rateLimiter = require('./middleware/rateLimiter');
const cacheService = require('./services/cacheService');
const healthCheck = require('./middleware/healthCheck');
const statementRoutes = require('./routes/statementRoutes');
const zohoRoutes = require('./routes/zohoRoutes');
const swaggerUI = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const fs = require('fs');
const { validateApiKey } = require('./middleware/auth');
const security = require('./middleware/security');

const app = express();

// Security middleware
app.use(helmet(security.helmetConfig));
app.use(cors(security.corsOptions));
app.use(security.rateLimiter);
app.use(security.sanitizeData);

// Request parsing & compression
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeRequest);
app.use(compression());

// Logging and monitoring
app.use(requestLogger);
app.use(responseTime());
if (process.env.NODE_ENV !== 'test') {
    app.use(prometheusMiddleware({
        metricsPath: '/metrics',
        collectDefaultMetrics: true,
        requestDurationBuckets: [0.1, 0.5, 1, 2, 5],
        prefix: 'bank_statement_analyzer_',
        customLabels: ['service', 'endpoint'],
        extractCustomLabels: (req) => ({
            service: 'bank-statement-analyzer',
            endpoint: req.path
        })
    }));
} else {
    // Use mock metrics in test environment
    app.use((req, res, next) => next());
}
app.use(morgan('dev'));

// Health and monitoring routes
app.get('/health', healthCheck.middleware());
app.use('/monitoring', monitoringRoutes);

// API Documentation
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpec));

// API Routes with authentication and file upload
app.use('/api/analysis', validateApiKey, analysisRouter);
app.use('/api/statements', validateApiKey, statementRoutes);
app.use('/api/zoho', validateApiKey, zohoRoutes);
app.use('/api', validateApiKey, queryRoutes);

// Error handling
app.use(errorHandler);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
try {
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
} catch (error) {
    console.error('Error creating uploads directory:', error);
    // Continue execution as directory might already exist
}

// Initialize cache cleanup
cacheService.startCleanup();

module.exports = app;
