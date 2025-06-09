import { isDeepStrictEqual } from 'node:util';
import { PDFParserService } from './pdfParserService.js';
import { cacheService } from '../utils/index.js';

class AnalysisService {
    async analyzeStatement(filePath, bankType) {
        try {
            // Generate unique analysis ID
            const analysisId = `analysis_${Date.now()}`;
            
            // Parse PDF and extract transactions
            const parsedData = await PDFParserService.parsePDF(filePath, bankType);
            
            // Perform analysis
            const analysis = {
                id: analysisId,
                summary: this.generateSummary(parsedData?.transactions ?? []),
                categories: await PDFParserService.categorizeTransactions(parsedData?.transactions),
                trends: this.analyzeTrends(parsedData?.transactions ?? []),
                timestamp: new Date().toISOString()
            };

            // Cache results
            await cacheService.set(`analysis:${analysisId}`, analysis);
            
            return analysis;
        } catch (error) {
            throw new Error(`Analysis failed: ${error.message}`);
        }
    }

    generateSummary(transactions) {
        return {
            totalIncome: transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
            totalExpenses: Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)),
            transactionCount: transactions.length,
            dateRange: {
                start: new Date(Math.min(...transactions.map(t => new Date(t.date)))),
                end: new Date(Math.max(...transactions.map(t => new Date(t.date))))
            }
        };
    }

    analyzeTrends(transactions) {
        // Group by month
        const monthly = transactions.reduce((acc, trans) => {
            const date = new Date(trans.date);
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
            
            acc[monthKey] = acc[monthKey] || { income: 0, expenses: 0 };
            if (trans.amount > 0) {
                acc[monthKey].income += trans.amount;
            } else {
                acc[monthKey].expenses += Math.abs(trans.amount);
            }
            
            return acc;
        }, {});

        return {
            monthly,
            averageMonthlyIncome: Object.values(monthly).reduce((sum, m) => sum + m.income, 0) / Object.keys(monthly).length,
            averageMonthlyExpenses: Object.values(monthly).reduce((sum, m) => sum + m.expenses, 0) / Object.keys(monthly).length
        };
    }

    async generateZohoReport(transactions) {
        return {
            financialMetrics: {
                totalIncome: this.calculateTotalIncome(transactions),
                totalExpenses: this.calculateTotalExpenses(transactions),
                netCashFlow: this.calculateNetCashFlow(transactions),
                categoryBreakdown: this.getCategoryBreakdown(transactions)
            },
            trends: {
                monthly: this.getMonthlyTrends(transactions),
                recurring: this.findRecurringTransactions(transactions)
            },
            insights: await this.generateInsights(transactions)
        };
    }

    findRecurringTransactions(transactions) {
        const transactionGroups = new Map();
        
        for (const trans of transactions) {
            const key = `${Math.abs(trans.amount)}_${trans.description}`;
            if (!transactionGroups.has(key)) {
                transactionGroups.set(key, []);
            }
            transactionGroups.get(key).push(trans);
        }

        return Array.from(transactionGroups.entries())
            .filter(([_, group]) => group.length > 1)
            .map(([key, group]) => ({
                amount: Math.abs(group[0].amount),
                description: group[0].description,
                frequency: this.calculateFrequency(group),
                occurrences: group.length
            }));
    }

    async analyzeData(data) {
        // Replace _.get with optional chaining
        const value = data?.nested?.property;
        
        // Replace _.isEqual with isDeepStrictEqual
        if (isDeepStrictEqual(objA, objB)) {
            // ...existing code...
        }
        
        // Replace _.merge with Object.assign or spread
        const merged = { ...defaultOptions, ...userOptions };
    }
}

export const analysisService = new AnalysisService();

// Replace lodash.get with optional chaining
const result = data?.analysis?.details;

// Replace lodash.isEqual with isDeepStrictEqual
if (isDeepStrictEqual(objA, objB)) {
    // ...existing code...
}