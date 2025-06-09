import axios from 'axios';
import { formatCurrency, formatDate } from '../utils/formatters.js';

export class LLMService {
    constructor(config = {}) {
        this.client = axios.create({
            baseURL: config.baseURL || 'https://api.perplexity.ai/v1',
            headers: {
                'Authorization': `Bearer ${config.apiKey || process.env.PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        this.maxRetries = config.maxRetries || 3;
    }

    /**
     * Analyze a bank statement and extract insights
     * @param {Object} parsedData - Parsed bank statement data
     * @returns {Object} Analysis results
     */
    async analyzeStatement(parsedData) {
        try {
            const prompt = this._buildPrompt(parsedData);
            
            const response = await axios.post(process.env.LLM_API_ENDPOINT, {
                prompt,
                max_tokens: 500,
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.LLM_API_KEY}`
                }
            });

            return this._parseResponse(response.data);
        } catch (error) {
            logger.error('LLM Statement Analysis Error:', error);
            throw new LLMError('Failed to analyze statement');
        }
    }
    
    /**
     * Process a natural language query about bank statement data
     * @param {string} question - The question being asked
     * @param {Object} context - The relevant bank statement context
     * @returns {Object} The answer to the question
     */
    async processQuery(question, context) {
        try {
            logger.info('Processing LLM query:', { question });
            
            const prompt = this._buildQueryPrompt(question, context);
            
            const response = await axios.post(process.env.LLM_API_ENDPOINT, {
                prompt,
                max_tokens: 1000,
                temperature: 0.3
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.LLM_API_KEY}`
                }
            });

            return this._parseQueryResponse(response.data, question);
        } catch (error) {
            logger.error('LLM Query Processing Error:', error);
            throw new LLMError(`Failed to process query: ${error.message}`);
        }
    }

    /**
     * Analyze statement data using Perplexity AI
     * @param {Object} statementData - The statement data to analyze
     * @returns {Object} Analysis results from Perplexity AI
     */
    async analyzeStatementData(statementData) {
        let attempts = 0;
        while (attempts < this.maxRetries) {
            try {
                const prompt = this._constructPrompt(statementData);
                const response = await this.client.post('/chat/completions', {
                    model: 'sonar-medium-online',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7
                });

                return this._processLLMResponse(response.data);
            } catch (error) {
                attempts++;
                if (attempts === this.maxRetries) {
                    throw new Error(`Failed to analyze statement data: ${error.message}`);
                }
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
            }
        }
    }

    /**
     * Build prompt for bank statement analysis
     * @private
     */
    _buildPrompt(parsedData) {
        return `Analyze this bank statement data: ${JSON.stringify(parsedData)}`;
    }
    
    /**
     * Build prompt for answering a specific question about bank statement data
     * @private
     */
    _buildQueryPrompt(question, context) {
        return `
You are a financial analyst assistant specializing in business bank statement analysis.
Your task is to answer the following question based ONLY on the bank statement data provided.

Question: "${question}"

Bank Statement Data:
${JSON.stringify(context, null, 2)}

Instructions:
1. Answer the question directly and concisely based only on the data provided
2. Include specific numerical figures in your answer when relevant
3. If the question cannot be answered from the data provided, clearly state why
4. Identify any patterns or trends relevant to the question
5. Format currency values as USD with dollar signs and two decimal places
6. If providing calculations, show your reasoning briefly
7. Do not make assumptions about data that is not provided

Please provide your answer:
`;
    }

    /**
     * Parse response from LLM statement analysis
     * @private
     */
    _parseResponse(llmResponse) {
        return {
            success: true,
            data: {
                riskScore: 0.0,
                insights: []
            }
        };
    }
    
    /**
     * Parse response from LLM query processing
     * @private
     */
    _parseQueryResponse(llmResponse, originalQuestion) {
        const answer = llmResponse.choices[0]?.message?.content || '';
        const confidence = this._calculateConfidence(answer);

        return {
            success: true,
            data: {
                question: originalQuestion,
                answer,
                confidence: Math.max(0.4, confidence),
                model: llmResponse.model || 'Unknown'
            }
        };
    }

    /**
     * Calculate confidence level based on the answer content
     * @private
     */
    _calculateConfidence(answer) {
        const uncertaintyPhrases = ['uncertain', 'unclear', 'cannot determine', 'don\'t know', 
                                    'insufficient data', 'not enough information'];
        
        let confidence = 0.85; // Default confidence
        
        for (const phrase of uncertaintyPhrases) {
            if (answer.toLowerCase().includes(phrase)) {
                confidence -= 0.15;
                break;
            }
        }
        
        if (answer.length < 50) {
            confidence -= 0.1;
        }
        
        return confidence;
    }

    /**
     * Construct prompt for detailed bank statement analysis
     * @private
     */
    _constructPrompt(data) {
        const { transactions, accountInfo, balanceInfo } = data;
        
        return `Analyze this bank statement data:
Account Period: ${formatDate(accountInfo.period.start)} to ${formatDate(accountInfo.period.end)}
Starting Balance: ${formatCurrency(balanceInfo.starting)}
Ending Balance: ${formatCurrency(balanceInfo.ending)}

Transaction Summary:
${transactions.map(t => 
    `${formatDate(t.date)}: ${t.description} - ${formatCurrency(t.amount)}`
).join('\n')}

Please provide a structured analysis with the following sections:
1. Financial Health:
2. Income Stability:
3. Risk Factors:
4. Unusual Transactions:
5. Cash Flow Analysis:`;
    }

    /**
     * Process response from Perplexity AI LLM
     * @private
     */
    _processLLMResponse(response) {
        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('Invalid LLM response format');
        }

        const sections = this._parseSections(content);
        return {
            summary: sections['Financial Health Assessment'] || '',
            incomeStability: sections['Income Stability Analysis'] || '',
            riskFactors: this._parseList(sections['Risk Factors'] || ''),
            unusualTransactions: this._parseList(sections['Unusual Transactions'] || ''),
            cashFlowAnalysis: sections['Cash Flow Analysis'] || ''
        };
    }

    /**
     * Parse structured sections from LLM response
     * @private
     */
    _parseSections(content) {
        const sections = {};
        const lines = content.split('\n');
        let currentSection = '';

        for (const line of lines) {
            // Match section headers ending with colon
            const sectionMatch = line.match(/^([^:]+):/);
            if (sectionMatch) {
                currentSection = sectionMatch[1].trim();
                sections[currentSection] = '';
            } else if (currentSection && line.trim()) {
                // Append non-empty lines to current section
                sections[currentSection] += (sections[currentSection] ? '\n' : '') + line.trim();
            }
        }

        return sections;
    }

    /**
     * Parse list items from text
     * @private
     */
    _parseList(text) {
        if (!text) return [];
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('-'))
            .map(line => line.substring(1).trim())
            .filter(Boolean);
    }
}