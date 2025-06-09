import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock axios responses
const mockAxiosClient = {
    interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
    },
    patch: jest.fn().mockResolvedValue({ 
        data: { 
            status_code: 200,
            data: [{ id: 'LOAN-123', status: 'updated' }]
        } 
    }),
    post: jest.fn().mockResolvedValue({
        data: {
            status_code: 200,
            data: { id: 'SHEET-456' }
        }
    })
};

// Setup mocks
jest.unstable_mockModule('axios', () => ({
    default: {
        create: jest.fn(() => mockAxiosClient)
    }
}));

describe('Zoho Integration', () => {
    let crmService, sheetsService;
    let mockAnalysis;

    beforeEach(async () => {
        const { ZohoCRMService } = await import('../../src/services/zohoCRMService.js');
        const { ZohoSheetsService } = await import('../../src/services/zohoSheetsService.js');
        
        crmService = new ZohoCRMService();
        sheetsService = new ZohoSheetsService();

        mockAnalysis = {
            applicationId: 'LOAN-123',
            riskScore: 85,
            metrics: {
                averageBalance: 5000,
                monthlyIncome: 8000,
                expenseRatio: 0.4
            },
            transactions: [
                { 
                    date: '2025-06-08',
                    description: 'Salary',
                    amount: 8000,
                    category: 'Income'
                }
            ]
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('CRM Integration', () => {
        it('should update loan application with analysis results', async () => {
            const result = await crmService.updateApplication(mockAnalysis);

            expect(result.status_code).toBe(200);
            expect(mockAxiosClient.patch).toHaveBeenCalledWith(
                'https://www.zohoapis.com/crm/v3/Deals/LOAN-123',
                {
                    data: [{
                        id: 'LOAN-123',
                        Risk_Score: 85,
                        Average_Balance: 5000,
                        Monthly_Income: 8000,
                        Expense_Ratio: 0.4
                    }]
                }
            );
        });

        it('should handle API errors gracefully', async () => {
            mockAxiosClient.patch.mockRejectedValueOnce(new Error('API Error'));
            await expect(crmService.updateApplication(mockAnalysis))
                .rejects
                .toThrow('API Error');
        });
    });

    describe('Sheets Integration', () => {
        it('should export transaction analysis to worksheet', async () => {
            const result = await sheetsService.exportAnalysis(mockAnalysis);

            expect(result.status_code).toBe(200);
            expect(mockAxiosClient.post).toHaveBeenCalledWith(
                'https://sheet.zoho.com/api/v2/spreadsheets',
                expect.objectContaining({
                    data: expect.arrayContaining([
                        expect.objectContaining({
                            Date: '2025-06-08',
                            Amount: 8000,
                            Category: 'Income'
                        })
                    ])
                })
            );
        });

        it('should retry on network failures', async () => {
            // First call fails, second succeeds
            mockAxiosClient.post
                .mockRejectedValueOnce(new Error('Network Error'))
                .mockResolvedValueOnce({ 
                    data: { 
                        status_code: 200,
                        data: { id: 'SHEET-456' }
                    } 
                });

            const result = await sheetsService.exportAnalysis(mockAnalysis);

            expect(result.status_code).toBe(200);
            expect(mockAxiosClient.post).toHaveBeenCalledTimes(2);
            expect(mockAxiosClient.post.mock.calls[0][0]).toBe('https://sheet.zoho.com/api/v2/spreadsheets');
            expect(mockAxiosClient.post.mock.calls[1][0]).toBe('https://sheet.zoho.com/api/v2/spreadsheets');
        }, 10000); // Increase timeout for retry delays
    });
});