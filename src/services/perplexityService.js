const axios = require('axios');
const logger = require('../config/logger');

class PerplexityService {
    constructor() {
        this.apiKey = process.env.PERPLEXITY_API_KEY;
        this.baseURL = process.env.PERPLEXITY_API_URL;
        this.model = 'sonar-medium-online';
    }

    async analyzeTransactions(transactions) {
        try {
            const response = await axios.post(this.baseURL, {
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a financial analyst specializing in transaction analysis.'
                    },
                    {
                        role: 'user',
                        content: this.buildAnalysisPrompt(transactions)
                    }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return this.processResponse(response.data);
        } catch (error) {
            logger.error('Perplexity analysis failed:', {
                error: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
            throw new Error('Analysis failed');
        }
    }

    buildAnalysisPrompt(transactions) {
        return `Analyze these financial transactions:
${JSON.stringify(transactions, null, 2)}

Provide insights on:
1. Spending patterns
2. Unusual transactions
3. Budget recommendations
4. Potential savings`;
    }

    processResponse(data) {
        return {
            structured: {
                patterns: [],
                recommendations: [],
                risks: []
            },
            metadata: {
                model: this.model,
                timestamp: new Date().toISOString()
            },
            rawResponse: data
        };
    }
}

// Export the class itself, not an instance
module.exports = PerplexityService;