const express = require('express');
const router = express.Router();
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const config = require('../config/env');

// Swagger configuration with fallback values
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Bank Statement Analyzer API',
            version: '1.0.0',
            description: 'API for analyzing bank statements'
        },
        servers: [
            {
                url: `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 3000}`
            }
        ]
    },
    apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsDoc(swaggerOptions);

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerSpec));

module.exports = router;