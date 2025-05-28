const axios = require('axios');

const PERPLEXITY_API_URL = process.env.PERPLEXITY_API_URL || 'https://api.perplexity.ai/chat/completions';

// System prompt for financial analysis
const FINANCIAL_ANALYST_PROMPT = `You are an expert financial analyst AI. Analyze bank statements to:
1. Identify spending patterns and trends
2. Flag unusual transactions
3. Provide insights on financial health
4. Suggest potential savings opportunities

Format your response in these sections:
- SUMMARY: Brief overview (2-3 sentences)
- PATTERNS: Key spending patterns
- FLAGS: Unusual items or concerns
- RECOMMENDATIONS: Actionable advice

Keep total response under 500 words.`;

class LlmService {
    constructor() {
        this.apiKey = process.env.PERPLEXITY_API_KEY;
        if (!this.apiKey) {
            console.warn('Missing Perplexity API key');
        }
    }

    async analyzeStatement(statementData) {
        try {
            const prompt = this._prepareAnalysisPrompt(statementData);
            
            const response = await axios.post(
                PERPLEXITY_API_URL,
                {
                    model: 'pplx-70b-online',
                    messages: [
                        { role: 'system', content: FINANCIAL_ANALYST_PROMPT },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 1000,
                    temperature: 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return this._processResponse(response.data);

        } catch (error) {
            return this._handleError(error);
        }
    }

    _prepareAnalysisPrompt(statementData) {
        const { accountInfo, transactions } = statementData;
        
        // Calculate some basic statistics for the prompt
        const totalDebits = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
        const totalCredits = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);
        
        return `Analyze this bank statement:

PERIOD: ${accountInfo.statementPeriod.startDate} to ${accountInfo.statementPeriod.endDate}
BALANCE SUMMARY:
- Opening: $${accountInfo.balances.opening}
- Closing: $${accountInfo.balances.closing}
- Total Debits: $${totalDebits.toFixed(2)}
- Total Credits: $${totalCredits.toFixed(2)}

TRANSACTIONS (${transactions.length} total):
${this._formatTransactions(transactions)}

Consider:
1. Balance trend over the period
2. Major expense categories
3. Unusual transactions
4. Spending patterns
5. Potential savings areas`;
    }

    _formatTransactions(transactions) {
        // Limit to most recent 30 transactions to avoid token limits
        const recentTransactions = transactions
            .slice(-30)
            .map(t => `${t.date}: ${t.description.substring(0, 50)}... | ${t.debit ? '-$'+t.debit : '+$'+t.credit}`)
            .join('\n');
            
        return transactions.length > 30 
            ? `[Showing ${30} most recent of ${transactions.length} transactions]\n${recentTransactions}`
            : recentTransactions;
    }

    _processResponse(responseData) {
        try {
            const content = responseData.choices[0].message.content;
            
            // Split response into sections based on headers
            const sections = content.split(/\n(?=[A-Z]+:)/);
            
            return {
                timestamp: new Date().toISOString(),
                analysis: {
                    full: content,
                    sections: this._parseSections(sections),
                }
            };
        } catch (error) {
            console.error('Error processing LLM response:', error);
            return {
                error: 'Failed to process analysis response',
                timestamp: new Date().toISOString()
            };
        }
    }

    _parseSections(sections) {
        const result = {};
        sections.forEach(section => {
            const [header, ...content] = section.split('\n');
            if (header) {
                const key = header.split(':')[0].trim().toLowerCase();
                result[key] = content.join('\n').trim();
            }
        });
        return result;
    }

    _handleError(error) {
        const errorResponse = {
            error: {
                message: 'Analysis failed',
                details: error.message,
                timestamp: new Date().toISOString()
            }
        };

        if (error.response?.status === 429) {
            errorResponse.error.type = 'RATE_LIMIT';
            errorResponse.error.message = 'Rate limit exceeded. Please try again later.';
        } else if (error.response?.data?.error) {
            errorResponse.error.type = 'API_ERROR';
            errorResponse.error.details = error.response.data.error;
        }

        console.error('Perplexity API Error:', errorResponse);
        return errorResponse;
    }
}

module.exports = new LlmService();