const FinancialMetrics = require('../../src/utils/financialMetrics');

describe('Financial Metrics', () => {
    describe('Quick Ratio Calculations', () => {
        it('should calculate quick ratio correctly', () => {
            const currentAssets = 500000;
            const inventory = 150000;
            const currentLiabilities = 200000;

            const ratio = FinancialMetrics.calculateQuickRatio(
                currentAssets,
                inventory,
                currentLiabilities
            );

            expect(ratio).toBe(1.75); // (500k - 150k) / 200k = 1.75
        });
    });

    describe('Customer Concentration Analysis', () => {
        it('should identify high concentration risks', () => {
            const transactions = [
                { type: 'deposit', amount: 50000, customer: 'Customer A' },
                { type: 'deposit', amount: 30000, customer: 'Customer B' },
                { type: 'deposit', amount: 20000, customer: 'Customer A' }
            ];

            const concentration = FinancialMetrics.analyzeCustomerConcentration(transactions);

            expect(concentration[0].customer).toBe('Customer A');
            expect(concentration[0].percentage).toBe(0.7); // 70k out of 100k
            expect(concentration).toHaveLength(2);
        });
    });

    describe('Gross Revenue Analysis', () => {
        it('should calculate revenue metrics correctly', () => {
            const mockTransactions = [
                { date: '2025-01-15', type: 'deposit', amount: 50000, isTransfer: false },
                { date: '2025-01-20', type: 'deposit', amount: 30000, isTransfer: false }, // Jan: 80k
                { date: '2025-02-15', type: 'deposit', amount: 45000, isTransfer: false },
                { date: '2025-02-28', type: 'deposit', amount: 25000, isTransfer: false }, // Feb: 70k
                { date: '2025-03-15', type: 'deposit', amount: 60000, isTransfer: false }, // Mar: 60k
                { date: '2025-03-20', type: 'transfer', amount: 20000, isTransfer: true }  // Excluded
            ];

            const analysis = FinancialMetrics.analyzeGrossRevenue(mockTransactions);

            expect(analysis.totalRevenue).toBe(210000); // Total excluding transfer
            expect(analysis.averageMonthlyRevenue).toBe(70000); // 210k/3
            expect(analysis.volatility).toBeDefined();
            expect(analysis.metrics.highest).toBe(80000); // January total
            expect(analysis.metrics.lowest).toBe(60000);  // March total
        });

        it('should handle empty transaction list', () => {
            const analysis = FinancialMetrics.analyzeGrossRevenue([]);
            
            expect(analysis.totalRevenue).toBe(0);
            expect(analysis.averageMonthlyRevenue).toBe(0);
            expect(analysis.metrics.highest).toBe(-Infinity);
            expect(analysis.metrics.lowest).toBe(Infinity);
        });
    });

    describe('Daily Balance Analysis', () => {
        it('should analyze daily balances correctly', () => {
            const mockTransactions = [
                { date: '2025-01-01', type: 'deposit', amount: 10000 },
                { date: '2025-01-02', type: 'withdrawal', amount: 3000 },
                { date: '2025-01-03', type: 'deposit', amount: 5000 },
                { date: '2025-01-04', type: 'withdrawal', amount: 15000 } // Creates overdraft
            ];

            const analysis = FinancialMetrics.analyzeDailyBalances(mockTransactions);

            expect(analysis.metrics.overdraftDays).toBe(1);
            expect(analysis.metrics.lowestBalance).toBe(-3000);
            expect(analysis.metrics.highestBalance).toBe(12000);
            expect(analysis.dailyBalances).toHaveLength(4);
        });
    });

    describe('Deposit Pattern Analysis', () => {
        it('should analyze deposit patterns correctly', () => {
            const mockTransactions = [
                { date: '2025-01-01', type: 'deposit', amount: 5000, isTransfer: false },
                { date: '2025-01-15', type: 'deposit', amount: 6000, isTransfer: false },
                { date: '2025-02-01', type: 'deposit', amount: 5500, isTransfer: false },
                { date: '2025-02-15', type: 'deposit', amount: 5800, isTransfer: false },
                { date: '2025-02-15', type: 'deposit', amount: 10000, isTransfer: true } // Transfer should be excluded
            ];

            const patterns = FinancialMetrics.analyzeDepositPatterns(mockTransactions);

            expect(patterns.averageDeposit).toBeCloseTo(5575);
            expect(patterns.largestDeposit).toBe(6000);
            expect(patterns.depositDays).toBe(2); // 1st and 15th
            expect(patterns.frequency.averageInterval).toBe(15); // 15 days between deposits
        });

        it('should handle irregular deposit patterns', () => {
            const mockTransactions = [
                { date: '2025-01-01', type: 'deposit', amount: 5000, isTransfer: false },
                { date: '2025-01-03', type: 'deposit', amount: 1000, isTransfer: false },
                { date: '2025-01-20', type: 'deposit', amount: 3000, isTransfer: false }
            ];

            const patterns = FinancialMetrics.analyzeDepositPatterns(mockTransactions);

            expect(patterns.frequency.maxInterval).toBe(17); // Jan 3 to Jan 20
            expect(patterns.frequency.minInterval).toBe(2);  // Jan 1 to Jan 3
            expect(patterns.depositDays).toBe(3);
        });
    });

    describe('Working Capital Analysis', () => {
        it('should calculate working capital metrics', () => {
            const financials = {
                currentAssets: 500000,
                currentLiabilities: 200000,
                inventory: 150000,
                accountsReceivable: 175000,
                accountsPayable: 125000
            };

            const analysis = FinancialMetrics.analyzeWorkingCapital(financials);

            expect(analysis.workingCapital).toBe(300000); // 500k - 200k
            expect(analysis.currentRatio).toBe(2.5); // 500k / 200k
            expect(analysis.quickRatio).toBe(1.75); // (500k - 150k) / 200k
            expect(analysis.daysReceivables).toBeDefined();
            expect(analysis.daysPayables).toBeDefined();
        });
    });

    describe('Debt Service Analysis', () => {
        it('should calculate debt service coverage ratio', () => {
            const cashFlow = {
                operatingIncome: 250000,
                depreciation: 50000,
                interest: 30000,
                principalPayments: 100000
            };

            const dscr = FinancialMetrics.calculateDSCR(cashFlow);

            expect(dscr.ratio).toBe(2.31); // (250k + 50k) / (30k + 100k)
            expect(dscr.modified).toBe(1.92); // (250k) / (30k + 100k)
            expect(dscr.coverage).toBe('Strong'); // > 1.5x is strong
        });
    });

    describe('Cash Flow Quality Analysis', () => {
        it('should analyze cash flow consistency', () => {
            const monthlyDeposits = [
                { month: '2025-01', deposits: 80000 },
                { month: '2025-02', deposits: 75000 },
                { month: '2025-03', deposits: 85000 }
            ];

            const quality = FinancialMetrics.analyzeCashFlowQuality(monthlyDeposits);

            expect(quality.consistency).toBeGreaterThan(0.8); // High consistency
            expect(quality.trend).toBe('Stable');
            expect(quality.seasonalityFactor).toBeDefined();
            expect(quality.qualityScore).toBeGreaterThan(50); // Above average score
        });

        it('should handle growth rate calculations', () => {
            const values = [100, 110, 121]; // 10% growth each period
            const growthRate = FinancialMetrics.calculateGrowthRate(values);
            expect(growthRate).toBeCloseTo(0.10, 2); // About 10% growth
        });
    });

    describe('Lending Risk Analysis', () => {
        it('should generate comprehensive risk assessment', () => {
            const data = {
                monthlyDeposits: [
                    { month: '2025-01', deposits: 80000 },
                    { month: '2025-02', deposits: 75000 },
                    { month: '2025-03', deposits: 85000 }
                ],
                financials: {
                    currentAssets: 500000,
                    currentLiabilities: 200000,
                    totalAssets: 800000,
                    totalLiabilities: 300000
                },
                cashFlow: {
                    operatingIncome: 250000,
                    depreciation: 50000,
                    interest: 30000,
                    principalPayments: 100000
                },
                industry: {
                    sic: '7371',
                    description: 'Computer Programming Services',
                    riskTier: 2
                }
            };

            const riskAnalysis = FinancialMetrics.analyzeLendingRisk(data);

            expect(riskAnalysis.creditMetrics).toBeDefined();
            expect(riskAnalysis.industryRisk).toBeDefined();
            expect(riskAnalysis.scorecard.totalScore).toBeGreaterThan(60);
            expect(riskAnalysis.collateralCoverage).toBeGreaterThan(1.5);
        });
    });

    describe('Risk Component Scoring', () => {
        it('should calculate leverage ratio correctly', () => {
            const financials = {
                totalAssets: 1000000,
                totalLiabilities: 600000
            };

            const ratio = FinancialMetrics.calculateLeverageRatio(financials);
            expect(ratio).toBe(0.60);
        });

        it('should score cash flow strength appropriately', () => {
            const data = {
                cashFlow: {
                    operatingIncome: 250000,
                    depreciation: 50000,
                    interest: 30000,
                    principalPayments: 100000
                },
                monthlyDeposits: [
                    { month: '2025-01', deposits: 80000 },
                    { month: '2025-02', deposits: 75000 },
                    { month: '2025-03', deposits: 85000 }
                ]
            };

            const score = FinancialMetrics.scoreCashFlowStrength(data);
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
        });
    });

    describe('Industry Cycle Analysis', () => {
        it('should determine correct industry cycle phase', () => {
            expect(FinancialMetrics.determineCyclePhase('7371')).toBe('Growth');
            expect(FinancialMetrics.determineCyclePhase('5812')).toBe('Mature');
            expect(FinancialMetrics.determineCyclePhase('8011')).toBe('Stable');
        });

        it('should assess industry cyclicality correctly', () => {
            const assessment = FinancialMetrics.assessIndustryCyclicality('7371');
            
            expect(assessment.isCyclical).toBe(true);
            expect(assessment.cyclePhase).toBe('Growth');
            expect(assessment.volatilityFactor).toBe(1.2);
            expect(assessment.riskAdjustment).toBe(-0.1);
        });

        it('should handle unknown SIC codes gracefully', () => {
            const assessment = FinancialMetrics.assessIndustryCyclicality('9999');
            
            expect(assessment.isCyclical).toBe(false);
            expect(assessment.cyclePhase).toBe('Stable');
            expect(assessment.volatilityFactor).toBe(0.8);
            expect(assessment.riskAdjustment).toBe(-0.15);
        });
    });

    describe('Industry-Specific Adjustments', () => {
        it('should apply correct industry benchmarks', () => {
            const metrics = {
                dscr: 1.5,
                leverageRatio: 0.6,
                quickRatio: 1.2,
                operatingMargin: 0.12
            };

            const adjusted = FinancialMetrics.applyIndustryAdjustments(metrics, '7371');
            
            expect(adjusted.adjustedDSCR).toBeCloseTo(1.11, 2); // 1.5/1.35
            expect(adjusted.industryComparison.quickRatio).toBeCloseTo(0.8, 2); // 1.2/1.5
        });

        it('should handle economic cycle adjustments', () => {
            const metrics = {
                score: 75,
                reserves: 100000
            };

            const adjusted = FinancialMetrics.applyEconomicCycleAdjustments(metrics, 'Peak');

            expect(adjusted.adjustedScore).toBe(82.5); // 75 * 1.1
            expect(adjusted.requiredReserves).toBe(120000); // 100k * 1.2
            expect(adjusted.cyclicalAdjustments.confidence).toBeGreaterThan(0);
        });
    });

    describe('Advanced Industry Analysis', () => {
        it('should apply detailed industry benchmarks', () => {
            const metrics = {
                quickRatio: 1.3,
                dscr: 1.4,
                operatingMargin: 0.14
            };

            const assessment = FinancialMetrics.applyDetailedBenchmarks(metrics, '73');
            
            expect(assessment.quickRatio.status).toBe('Above Min');
            expect(assessment.dscr.status).toBe('Above Target');
            expect(assessment.operatingMargin.percentile).toBeGreaterThan(50);
        });

        it('should calculate regional adjustments correctly', () => {
            const baseMetrics = {
                risk: 1.0,
                growth: 1.0,
                sic: '7371'
            };

            const adjusted = FinancialMetrics.applyRegionalAdjustments(baseMetrics, 'Boston');

            expect(adjusted.adjustedRisk).toBe(0.95);
            expect(adjusted.growthPotential).toBe(1.1);
            expect(adjusted.regionalFactors.economicStrength).toBeDefined();
        });

        it('should provide detailed confidence scoring', () => {
            const data = {
                financials: {
                    asOf: '2025-03-31',
                    // ... financial data
                },
                monthlyDeposits: [
                    // ... deposit data
                ],
                taxReturns: {
                    // ... tax return data
                }
            };

            const confidence = FinancialMetrics.calculateConfidenceScore(data);

            expect(confidence.score).toBeGreaterThanOrEqual(0);
            expect(confidence.score).toBeLessThanOrEqual(100);
            expect(confidence.factors.dataQuality.score).toBeGreaterThan(70);
            expect(confidence.reliability).toBeDefined();
        });
    });

    describe('Enhanced Financial Metrics', () => {
        describe('Healthcare Industry Metrics', () => {
            it('should evaluate healthcare-specific metrics', () => {
                const metrics = {
                    quickRatio: 1.3,
                    dscr: 1.5,
                    operatingMargin: 0.16,
                    payor_mix: {
                        private: 0.65,
                        medicare: 0.25,
                        other: 0.10
                    }
                };

                const analysis = FinancialMetrics.applyDetailedBenchmarks(metrics, '8011');
                
                expect(analysis.quickRatio.status).toBe('Above Min');
                expect(analysis.dscr.status).toBe('Above Target');
                expect(analysis.payor_mix.risk).toBe('Low');
            });
        });

        describe('Enhanced Confidence Scoring', () => {
            it('should calculate time-weighted confidence scores', () => {
                const factors = {
                    financials: {
                        score: 85,
                        timestamp: new Date('2025-03-01')
                    },
                    bankStatements: {
                        score: 90,
                        timestamp: new Date('2025-05-15')
                    },
                    taxReturns: {
                        score: 95,
                        timestamp: new Date('2024-12-31')
                    }
                };

                const score = FinancialMetrics.computeWeightedConfidence(factors);
                expect(parseFloat(score)).toBeGreaterThan(80);
                expect(parseFloat(score)).toBeLessThan(95);
            });
        });

        describe('Regional Economic Analysis', () => {
            it('should assess regional economic conditions', () => {
                const region = {
                    name: 'Boston',
                    indicators: {
                        employment: {
                            growth: 0.035,
                            unemployment: 0.038
                        },
                        housing: {
                            appreciation: 0.12,
                            inventory: 1.8
                        },
                        business: {
                            newBusinesses: 0.18,
                            failures: 0.04
                        }
                    }
                };

                const assessment = FinancialMetrics.assessRegionalEconomy(region);
                
                expect(assessment.strength).toBe('Strong');
                expect(assessment.trends.employment).toBe('Growing');
                expect(assessment.risks.length).toBeLessThan(3);
            });
        });
    });
});