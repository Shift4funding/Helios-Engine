const { AnalyticsService } = require('../../src/services/analyticsService');
const { TValueCalculator } = require('../../src/utils/tValueCalculator');

describe('Analytics Service', () => {
    let analyticsService;
    let mockTransactions;

    beforeEach(() => {
        analyticsService = new AnalyticsService();
        mockTransactions = [
            {
                date: '2025-01-01',
                amount: 10000,
                type: 'deposit',
                balance: 10000
            },
            // ... more mock transactions
        ];
    });

    describe('TValue Calculations', () => {
        it('should calculate net present value correctly', async () => {
            const npv = await analyticsService.calculateNetPresentValue(mockTransactions);
            expect(npv).toBeDefined();
            expect(typeof npv).toBe('number');
        });

        it('should generate accurate amortization schedule', async () => {
            const schedule = await analyticsService.generateAmortizationSchedule(mockTransactions);
            expect(schedule).toHaveLength(12); // Assuming monthly payments
            expect(schedule[0]).toHaveProperty('principal');
            expect(schedule[0]).toHaveProperty('interest');
        });

        // ... more tests
    });

    describe('Financial Calculations', () => {
        describe('DSCR Calculations', () => {
            it('should calculate basic DSCR correctly', async () => {
                const mockTransactions = [
                    { date: '2025-01-01', type: 'income', amount: 120000 },
                    { date: '2025-01-15', type: 'debt_payment', amount: 40000 }
                ];

                const result = await analyticsService.calculateDSCR(mockTransactions);
                expect(result).toBeCloseTo(3.0); // 120k/40k = 3.0
            });

            it('should handle Global DSCR calculations', async () => {
                const mockBusinessData = {
                    netIncome: 100000,
                    debtService: 30000
                };
                const mockPersonalData = {
                    netIncome: 50000,
                    debtService: 20000
                };

                const result = await analyticsService.calculateGlobalDSCR(
                    mockBusinessData, 
                    mockPersonalData
                );
                expect(result).toBeCloseTo(3.0); // (100k+50k)/(30k+20k) = 3.0
            });
        });

        describe('Working Capital Analysis', () => {
            it('should calculate working capital ratio', async () => {
                const mockBalanceSheet = {
                    currentAssets: 200000,
                    currentLiabilities: 100000
                };

                const result = await analyticsService.calculateWorkingCapitalRatio(mockBalanceSheet);
                expect(result).toBe(2.0);
            });
        });
    });
});