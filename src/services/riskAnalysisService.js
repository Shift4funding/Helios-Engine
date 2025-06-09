import Transaction from '../models/Transaction.js';

class RiskAnalysisService {
    constructor() {
        this.riskThresholds = {
            nsfLimit: 2,
            overdraftLimit: 3,
            largeDepositThreshold: 10000,
            minDailyBalance: 1000,
            depositVolatility: 0.3,
            patternThreshold: 0.3
        };
    }

    async analyzeStatementRisk(transactions) {
        const riskMetrics = {
            nsfCount: 0,
            overdraftCount: 0,
            largeDeposits: [],
            averageDailyBalance: 0,
            depositVolatility: 0,
            overallRiskScore: 100,
            riskFlags: []
        };

        try {
            // Analyze NSF and Overdraft Patterns
            transactions.forEach(transaction => {
                const metrics = transaction.riskMetrics || {};
                
                if (metrics.isNSF) {
                    riskMetrics.nsfCount++;
                    riskMetrics.riskFlags.push({
                        type: 'NSF',
                        date: transaction.date,
                        amount: this._safeNumberConversion(transaction.amount)
                    });
                }

                if (metrics.isOverdraft) {
                    riskMetrics.overdraftCount++;
                    riskMetrics.riskFlags.push({
                        type: 'Overdraft',
                        date: transaction.date,
                        amount: this._safeNumberConversion(transaction.amount)
                    });
                }

                const amount = this._safeNumberConversion(transaction.amount);
                if (amount > this.riskThresholds.largeDepositThreshold) {
                    riskMetrics.largeDeposits.push({
                        date: transaction.date,
                        amount: amount,
                        description: transaction.description || 'No description'
                    });
                }
            });

            // Calculate Risk Score
            const riskScore = this._calculateRiskScore(riskMetrics);
            riskMetrics.overallRiskScore = riskScore;

            const detailedAnalysis = await this._generateDetailedAnalysis(transactions, riskMetrics);

            return {
                riskMetrics,
                recommendedAction: this._getRiskRecommendation(riskScore),
                detailedAnalysis
            };
        } catch (error) {
            console.error('Error analyzing statement risk:', error);
            return {
                riskMetrics: { ...riskMetrics, overallRiskScore: 0 },
                recommendedAction: 'Error in risk analysis - manual review required',
                detailedAnalysis: {
                    transactionAnalysis: { totalTransactions: transactions.length },
                    riskFactors: { 
                        highRisk: [], 
                        mediumRisk: [], 
                        lowRisk: [] 
                    },
                    trends: {
                        balanceTrend: null,
                        transactionFrequency: null,
                        seasonality: null
                    }
                }
            };
        }
    }

    _calculateRiskScore(metrics) {
        let score = 100;

        // Deduct for NSFs
        score -= (metrics.nsfCount * 15);

        // Deduct for Overdrafts
        score -= (metrics.overdraftCount * 10);

        // Analyze Large Deposits
        const largeDepositImpact = this._assessLargeDeposits(metrics.largeDeposits);
        score -= largeDepositImpact;

        // Ensure score stays within 0-100
        return Math.max(0, Math.min(100, score));
    }

    _assessLargeDeposits(deposits) {
        if (!deposits || deposits.length === 0) return 0;

        // Calculate total deposit amount
        const totalDepositAmount = deposits.reduce((sum, deposit) => sum + deposit.amount, 0);

        // Calculate risk impact based on:
        // 1. Number of large deposits
        // 2. Ratio to total transactions
        // 3. Frequency pattern
        let riskImpact = 0;

        // Impact for number of large deposits
        riskImpact += deposits.length * 5;

        // Impact for deposit concentration
        const averageDeposit = totalDepositAmount / deposits.length;
        if (averageDeposit > this.riskThresholds.largeDepositThreshold * 2) {
            riskImpact += 10;
        }

        // Cap the maximum impact
        return Math.min(riskImpact, 30);
    }

    _identifyMediumRiskFactors(metrics) {
        const factors = [];
        // Check for single large deposit
        if (metrics.largeDeposits.length > 0) {
            factors.push('Multiple Large Deposits');
        }
        if (metrics.depositVolatility > this.riskThresholds.depositVolatility) {
            factors.push('High Deposit Volatility');
        }
        return factors;
    }

    _analyzeCashFlow(transactions) {
        const dailyBalances = new Map();
        let runningBalance = 0;

        try {
            // Handle invalid dates gracefully
            transactions.forEach(transaction => {
                let dateStr;
                try {
                    const date = new Date(transaction.date);
                    if (isNaN(date.getTime())) {
                        throw new Error('Invalid date');
                    }
                    dateStr = date.toISOString().split('T')[0];
                } catch (e) {
                    dateStr = 'invalid-date';
                }

                // Handle invalid amounts
                const amount = Number(transaction.amount);
                runningBalance += isNaN(amount) ? 0 : amount;
                dailyBalances.set(dateStr, runningBalance);
            });

            return {
                averageDailyBalance: this._calculateAverage([...dailyBalances.values()]),
                balanceVolatility: this._calculateVolatility([...dailyBalances.values()]),
                lowestDailyBalance: Math.min(...dailyBalances.values()),
                highestDailyBalance: Math.max(...dailyBalances.values())
            };
        } catch (error) {
            console.error('Cash flow analysis error:', error);
            return {
                averageDailyBalance: 0,
                balanceVolatility: 0,
                lowestDailyBalance: 0,
                highestDailyBalance: 0
            };
        }
    }

    _getRiskRecommendation(score) {
        if (score >= 80) return 'Low Risk - Proceed with standard underwriting';
        if (score >= 60) return 'Moderate Risk - Additional documentation recommended';
        return 'High Risk - Enhanced due diligence required';
    }

    _calculateAverage(values) {
        if (!values.length) return 0;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    _calculateVolatility(values) {
        if (values.length < 2) return 0;
        const avg = this._calculateAverage(values);
        const squareDiffs = values.map(value => Math.pow(value - avg, 2));
        return Math.sqrt(this._calculateAverage(squareDiffs));
    }

    async _generateDetailedAnalysis(transactions, riskMetrics) {
        return {
            transactionAnalysis: {
                totalTransactions: transactions.length,
                totalNSF: riskMetrics.nsfCount,
                totalOverdrafts: riskMetrics.overdraftCount,
                largeDepositCount: riskMetrics.largeDeposits.length
            },
            riskFactors: {
                highRisk: this._identifyHighRiskFactors(riskMetrics),
                mediumRisk: this._identifyMediumRiskFactors(riskMetrics),
                lowRisk: this._identifyLowRiskFactors(riskMetrics)
            },
            trends: await this._analyzeTrends(transactions),
            recommendations: this._generateRecommendations(riskMetrics)
        };
    }

    _identifyHighRiskFactors(metrics) {
        const factors = [];
        if (metrics.nsfCount > this.riskThresholds.nsfLimit) {
            factors.push('High NSF Activity');
        }
        if (metrics.overdraftCount > this.riskThresholds.overdraftLimit) {
            factors.push('Frequent Overdrafts');
        }
        return factors;
    }

    _identifyMediumRiskFactors(metrics) {
        const factors = [];
        // Check for single large deposit
        if (metrics.largeDeposits.length > 0) {
            factors.push('Multiple Large Deposits');
        }
        if (metrics.depositVolatility > this.riskThresholds.depositVolatility) {
            factors.push('High Deposit Volatility');
        }
        return factors;
    }

    _identifyLowRiskFactors(metrics) {
        const factors = [];
        if (metrics.averageDailyBalance > this.riskThresholds.minDailyBalance) {
            factors.push('Maintains Minimum Balance');
        }
        return factors;
    }

    async _analyzeTrends(transactions) {
        if (!transactions.length) {
            return {
                balanceTrend: null,
                transactionFrequency: null,
                seasonality: null
            };
        }
        
        // Sort transactions by date
        const sortedTransactions = [...transactions].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );

        return {
            balanceTrend: this._calculateBalanceTrend(sortedTransactions),
            transactionFrequency: this._calculateTransactionFrequency(sortedTransactions),
            seasonality: transactions.length < 30 ? null : this._detectSeasonality(sortedTransactions)
        };
    }

    _generateRecommendations(metrics) {
        const recommendations = [];
        
        if (metrics.overallRiskScore < 60) {
            recommendations.push('Additional collateral may be required');
            recommendations.push('Consider higher interest rate');
        } else if (metrics.overallRiskScore < 80) {
            recommendations.push('Standard underwriting process recommended');
            recommendations.push('Monitor NSF/Overdraft activity');
        } else {
            recommendations.push('Favorable risk profile');
            recommendations.push('Standard terms applicable');
        }

        return recommendations;
    }

    _calculateBalanceTrend(sortedTransactions) {
        if (!sortedTransactions.length) return null;

        let runningBalance = 0;
        const balances = sortedTransactions.map(t => {
            runningBalance += t.amount;
            return {
                date: t.date,
                balance: runningBalance
            };
        });

        // Calculate trend direction and strength
        const trend = {
            direction: 'stable',
            strength: 'moderate',
            averageBalance: this._calculateAverage(balances.map(b => b.balance)),
            volatility: this._calculateVolatility(balances.map(b => b.balance))
        };

        // Determine trend direction
        const firstBalance = balances[0].balance;
        const lastBalance = balances[balances.length - 1].balance;
        if (lastBalance > firstBalance * 1.1) trend.direction = 'increasing';
        if (lastBalance < firstBalance * 0.9) trend.direction = 'decreasing';

        // Determine trend strength
        const volatilityRatio = trend.volatility / trend.averageBalance;
        if (volatilityRatio > 0.5) trend.strength = 'high';
        if (volatilityRatio < 0.2) trend.strength = 'low';

        return trend;
    }

    _calculateTransactionFrequency(sortedTransactions) {
        if (!sortedTransactions.length) return null;

        const frequencyMap = new Map();
        let prevDate = null;
        let daysBetween = [];

        try {
            sortedTransactions.forEach(transaction => {
                let currentDate;
                try {
                    currentDate = new Date(transaction.date);
                    if (isNaN(currentDate.getTime())) {
                        throw new Error('Invalid date');
                    }
                } catch (error) {
                    console.warn(`Invalid date found: ${transaction.date}`);
                    return; // Skip this transaction
                }

                if (prevDate) {
                    const days = Math.max(0, (currentDate - prevDate) / (1000 * 60 * 60 * 24));
                    daysBetween.push(days);
                }
                prevDate = currentDate;

                // Safe date key generation
                const dateKey = this._formatDateKey(currentDate);
                frequencyMap.set(dateKey, (frequencyMap.get(dateKey) || 0) + 1);
            });

            return {
                averageDaysBetweenTransactions: this._calculateAverage(daysBetween) || 0,
                maxTransactionsPerDay: Math.max(...frequencyMap.values(), 0),
                transactionsPerDay: this._calculateAverage([...frequencyMap.values()]) || 0,
                totalDays: frequencyMap.size
            };
        } catch (error) {
            console.error('Error calculating transaction frequency:', error);
            return {
                averageDaysBetweenTransactions: 0,
                maxTransactionsPerDay: 0,
                transactionsPerDay: 0,
                totalDays: 0
            };
        }
    }

    _formatDateKey(date) {
        try {
            return date.toISOString().split('T')[0];
        } catch (error) {
            return 'invalid-date';
        }
    }

    _detectSeasonality(transactions) {
        if (!transactions || transactions.length < 30) {
            return null;
        }

        try {
            // Group transactions by month and weekday
            const monthlyData = new Map();
            const weekdayData = new Map();

            transactions.forEach(transaction => {
                try {
                    const date = new Date(transaction.date);
                    if (isNaN(date.getTime())) return;

                    const month = date.getMonth();
                    const weekday = date.getDay();
                    const amount = Number(transaction.amount) || 0;

                    // Aggregate monthly data
                    monthlyData.set(month, (monthlyData.get(month) || 0) + amount);
                    
                    // Aggregate weekday data
                    weekdayData.set(weekday, (weekdayData.get(weekday) || 0) + amount);
                } catch (error) {
                    console.warn('Error processing transaction date:', error);
                }
            });

            // Analyze patterns
            const monthlyPattern = this._analyzePattern([...monthlyData.values()]);
            const weekdayPattern = this._analyzePattern([...weekdayData.values()]);

            return {
                monthlyPattern,
                weekdayPattern,
                confidence: Math.max(monthlyPattern.confidence, weekdayPattern.confidence)
            };
        } catch (error) {
            console.error('Error detecting seasonality:', error);
            return null;
        }
    }

    _analyzePattern(values) {
        if (!values || values.length < 2) {
            return { hasPattern: false, confidence: 0 };
        }

        const avg = this._calculateAverage(values);
        const variance = values.map(v => Math.abs(v - avg) / avg);
        const varianceScore = this._calculateAverage(variance);

        return {
            hasPattern: varianceScore > 0.3,
            confidence: Math.min(100, varianceScore * 100),
            peak: Math.max(...values),
            trough: Math.min(...values),
            varianceScore
        };
    }

    _handleAnalysisError(error, context) {
        console.error(`Analysis error in ${context}:`, error);
        return this.errorRecoveryDefaults;
    }

    _safeNumberConversion(value, defaultValue = 0) {
        if (value === null || value === undefined) return defaultValue;
        const converted = Number(value);
        if (isNaN(converted) || !isFinite(converted)) return defaultValue;
        return converted;
    }

    _safeDateConversion(dateStr) {
        try {
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date;
        } catch {
            return null;
        }
    }
}

export default new RiskAnalysisService();