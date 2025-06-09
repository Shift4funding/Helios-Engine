import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock axios client with consistent structure
const mockAxiosClient = {
    post: jest.fn(),
    interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
    }
};

// Setup module mock
jest.unstable_mockModule('axios', () => ({
    default: {
        create: jest.fn(() => mockAxiosClient)
    }
}));

let llmService;

describe('LLM Service', () => {
    beforeEach(async () => {
        const { LLMService } = await import('../../src/services/llmService.js');
        llmService = new LLMService({ apiKey: 'test-key' });

        // Reset mocks
        jest.clearAllMocks();

        // Setup default success response
        mockAxiosClient.post.mockResolvedValue({
            data: {
                choices: [{
                    message: {
                        content: `Financial Health Assessment:
Strong financial position with positive cash flow indicators.

Income Stability Analysis:
Regular salary deposits indicate stable monthly income.

Risk Factors:
- No overdrafts observed in period
- Low credit utilization detected
- Consistent income pattern established

Unusual Transactions:
- None detected in this period
- All transactions within normal patterns

Cash Flow Analysis:
Positive monthly cash flow trend with regular income deposits.`
                    }
                }]
            }
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const mockStatementData = {
        accountInfo: {
            period: { start: '2025-05-01', end: '2025-05-31' },
            accountNumber: '****1234'
        },
        balanceInfo: {
            starting: 5000,
            ending: 5500,
            average: 5250
        },
        transactions: [
            { date: '2025-05-01', description: 'SALARY DEPOSIT', amount: 3000 },
            { date: '2025-05-15', description: 'GROCERY STORE', amount: -150 }
        ]
    };

    it('should analyze statement data successfully', async () => {
        const result = await llmService.analyzeStatementData(mockStatementData);

        expect(result).toEqual({
            summary: expect.stringContaining('Strong financial position'),
            incomeStability: expect.stringContaining('Regular salary deposits'),
            riskFactors: expect.arrayContaining([
                'No overdrafts observed in period',
                'Low credit utilization detected',
                'Consistent income pattern established'
            ]),
            unusualTransactions: expect.arrayContaining([
                'None detected in this period',
                'All transactions within normal patterns'
            ]),
            cashFlowAnalysis: expect.stringContaining('Positive monthly cash flow')
        });

        expect(mockAxiosClient.post).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors with retries', async () => {
        // Reset mock from beforeEach
        jest.clearAllMocks();
        
        // Setup retry sequence
        mockAxiosClient.post
            .mockRejectedValueOnce(new Error('API Error 1'))
            .mockRejectedValueOnce(new Error('API Error 2'))
            .mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: `Financial Health Assessment:
Retry successful - analysis completed after retries.

Income Stability Analysis:
Regular income patterns observed after retry.

Risk Factors:
- No major concerns identified
- Stable transaction history

Unusual Transactions:
- None detected after retry analysis

Cash Flow Analysis:
Positive cash flow maintained throughout period.`
                        }
                    }]
                }
            });

        const result = await llmService.analyzeStatementData(mockStatementData);

        // Verify retry behavior
        expect(mockAxiosClient.post).toHaveBeenCalledTimes(3);
        expect(result.summary).toContain('Retry successful');
        expect(result).toEqual({
            summary: expect.stringContaining('Retry successful'),
            incomeStability: expect.stringContaining('Regular income patterns'),
            riskFactors: expect.arrayContaining([
                'No major concerns identified',
                'Stable transaction history'
            ]),
            unusualTransactions: expect.arrayContaining(['None detected after retry analysis']),
            cashFlowAnalysis: expect.stringContaining('Positive cash flow')
        });
    }, 10000); // Increased timeout for retries

    it('should format prompts correctly', async () => {
        await llmService.analyzeStatementData(mockStatementData);

        const [endpoint, requestData] = mockAxiosClient.post.mock.calls[0];
        
        expect(endpoint).toBe('/chat/completions');
        expect(requestData).toEqual(expect.objectContaining({
            model: 'sonar-medium-online',
            messages: [expect.objectContaining({
                role: 'user',
                content: expect.stringContaining('Transaction Summary')
            })]
        }));
    });

    it('should fail after max retries exceeded', async () => {
        mockAxiosClient.post.mockRejectedValue(new Error('API Error'));

        await expect(llmService.analyzeStatementData(mockStatementData))
            .rejects
            .toThrow('Failed to analyze statement data');

        expect(mockAxiosClient.post).toHaveBeenCalledTimes(3); // Default max retries
    });
});