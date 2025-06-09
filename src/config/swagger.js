const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Bank Statement Analyzer API',
            version: '1.0.0',
            description: 'API for analyzing bank statements',
        },
        servers: [
            {
                url: '/api',
                description: 'API server'
            }
        ],
        components: {
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        status: {
                            type: 'string',
                            enum: ['error', 'fail']
                        },
                        message: {
                            type: 'string'
                        }
                    }
                },
                AnalysisResponse: {
                    type: 'object',
                    properties: {
                        analysisId: {
                            type: 'string',
                            description: 'Unique identifier for the analysis'
                        },
                        status: {
                            type: 'string',
                            enum: ['completed', 'processing', 'failed']
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                }
            },
            securitySchemes: {
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key'
                }
            }
        }
    },
    apis: ['./src/routes/*.js']
};

// Add validation check
const spec = swaggerJsdoc(options);

// Validate the spec before exporting
if (!spec || !spec.paths) {
    console.error('Invalid Swagger specification generated');
    process.exit(1);
}

module.exports = spec;