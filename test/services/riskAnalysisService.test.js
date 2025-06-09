import riskAnalysisService from '../../src/services/riskAnalysisService.js';

describe('Risk Analysis Service', () => {
    it('should calculate risk score accurately', async () => {
        const mockTransactions = [
            {
                date: '2025-06-01',
                amount: -100,
                riskMetrics: { isNSF: true }
            },
            {
                date: '2025-06-02',
                amount: 15000,
                riskMetrics: { isNSF: false }
            }
        ];

        const analysis = await riskAnalysisService.analyzeStatementRisk(mockTransactions);
        
        // Specific metrics validation
        expect(analysis.riskMetrics.nsfCount).toBe(1);
        expect(analysis.riskMetrics.largeDeposits).toHaveLength(1);

        // Structure validation
        expect(analysis.detailedAnalysis).toBeDefined();
        expect(analysis.detailedAnalysis.trends).toBeDefined();
        expect(analysis.riskMetrics.overallRiskScore).toBeLessThanOrEqual(100);
    });

    it('should handle empty transaction list', async () => {
        const analysis = await riskAnalysisService.analyzeStatementRisk([]);
        expect(analysis.riskMetrics.overallRiskScore).toBe(100);
        expect(analysis.detailedAnalysis.transactionAnalysis.totalTransactions).toBe(0);
    });

    // Add new test cases to improve coverage
    it('should detect seasonal patterns in transactions', async () => {
        // Create 90 days of transactions with clear weekly patterns
        const mockTransactions = Array.from({ length: 90 }, (_, i) => ({
            date: new Date(2025, 0, i + 1).toISOString(),
            // Simulate higher deposits on Fridays (i % 7 === 5)
            amount: i % 7 === 5 ? 10000 : -1000,
            riskMetrics: { isNSF: false, isOverdraft: false }
        }));

        const analysis = await riskAnalysisService.analyzeStatementRisk(mockTransactions);
        
        // Test seasonal pattern detection
        expect(analysis.detailedAnalysis.trends.seasonality).toBeDefined();
        expect(analysis.detailedAnalysis.trends.seasonality.weekdayPattern).toBeDefined();
        expect(analysis.detailedAnalysis.trends.seasonality.weekdayPattern.hasPattern).toBe(true);
        expect(analysis.detailedAnalysis.trends.seasonality.weekdayPattern.confidence).toBeGreaterThan(50);
    });

    it('should identify high risk factors correctly', async () => {
        const mockTransactions = [
            {
                date: '2025-06-01',
                amount: -100,
                riskMetrics: { isNSF: true, isOverdraft: true }
            },
            {
                date: '2025-06-02',
                amount: -200,
                riskMetrics: { isNSF: true, isOverdraft: true }
            },
            {
                date: '2025-06-03',
                amount: -300,
                riskMetrics: { isNSF: true, isOverdraft: true }
            }
        ];

        const analysis = await riskAnalysisService.analyzeStatementRisk(mockTransactions);
        
        expect(analysis.riskMetrics.nsfCount).toBe(3);
        expect(analysis.riskMetrics.overdraftCount).toBe(3);
        expect(analysis.detailedAnalysis.riskFactors.highRisk).toContain('High NSF Activity');
        expect(analysis.riskMetrics.overallRiskScore).toBeLessThan(50);
    });

    it('should analyze balance trends accurately', async () => {
        const mockTransactions = [
            { date: '2025-06-01', amount: 10000, riskMetrics: {} },
            { date: '2025-06-02', amount: -2000, riskMetrics: {} },
            { date: '2025-06-03', amount: 15000, riskMetrics: {} }
        ];

        const analysis = await riskAnalysisService.analyzeStatementRisk(mockTransactions);
        
        expect(analysis.detailedAnalysis.trends.balanceTrend).toBeDefined();
        expect(analysis.detailedAnalysis.trends.balanceTrend.direction).toBe('increasing');
        expect(analysis.detailedAnalysis.trends.transactionFrequency.totalDays).toBe(3);
    });

    it('should handle edge cases in risk factor identification', async () => {
        const mockTransactions = [
            {
                date: '2025-06-01',
                amount: 50000, // Single large deposit
                riskMetrics: { isNSF: false, isOverdraft: false }
            },
            {
                date: '2025-06-02',
                amount: 1000,
                riskMetrics: { isNSF: false, isOverdraft: false }
            }
        ];

        const analysis = await riskAnalysisService.analyzeStatementRisk(mockTransactions);
        
        // Test for large deposit detection
        expect(analysis.detailedAnalysis.riskFactors.mediumRisk)
            .toContain('Multiple Large Deposits');
        // Test for minimum balance maintenance
        expect(analysis.riskMetrics.overallRiskScore).toBeGreaterThan(0);
    });

    it('should handle insufficient data for seasonality', async () => {
        // Create mock transactions with less than 30 days
        const mockTransactions = [
            {
                date: '2025-06-01',
                amount: 1000,
                riskMetrics: {}
            }
        ];

        const analysis = await riskAnalysisService.analyzeStatementRisk(mockTransactions);
        
        // Verify that seasonality is null with insufficient data
        expect(analysis.detailedAnalysis.trends.seasonality).toBeNull();
        expect(analysis.detailedAnalysis.trends.balanceTrend).not.toBeNull();
        expect(analysis.detailedAnalysis.trends.transactionFrequency).not.toBeNull();
    });

    describe('Error Handling', () => {
        it('should handle malformed transaction data', async () => {
            const malformedTransactions = [
                { date: 'not-a-date', amount: 'invalid' },
                { date: undefined, amount: null },
                { date: '2025-06-01', amount: '1000.50' }
            ];

            const analysis = await riskAnalysisService.analyzeStatementRisk(malformedTransactions);
            
            expect(analysis.riskMetrics).toBeDefined();
            expect(analysis.riskMetrics.nsfCount).toBe(0);
            expect(analysis.detailedAnalysis.transactionAnalysis.totalTransactions).toBe(3);
            expect(analysis.recommendedAction).toBeDefined();
        });

        it('should handle extreme values', async () => {
            const extremeTransactions = [
                { 
                    date: '2025-06-01', 
                    amount: Number.MAX_SAFE_INTEGER,
                    riskMetrics: { isNSF: true }
                }
            ];

            const analysis = await riskAnalysisService.analyzeStatementRisk(extremeTransactions);
            
            expect(analysis.riskMetrics.overallRiskScore).toBeGreaterThanOrEqual(0);
            expect(analysis.riskMetrics.overallRiskScore).toBeLessThanOrEqual(100);
            expect(analysis.riskMetrics.riskFlags).toHaveLength(1);
        });

        it('should handle empty risk metrics', async () => {
            const transactionsWithoutMetrics = [
                { date: '2025-06-01', amount: 1000 }
            ];

            const analysis = await riskAnalysisService.analyzeStatementRisk(transactionsWithoutMetrics);
            
            expect(analysis.riskMetrics).toBeDefined();
            expect(analysis.riskMetrics.nsfCount).toBe(0);
            expect(analysis.riskMetrics.overdraftCount).toBe(0);
            expect(analysis.detailedAnalysis.riskFactors.highRisk).toEqual([]);
        });
    });
});