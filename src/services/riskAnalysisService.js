import logger from '../utils/logger.js';
import { LLMCategorizationService } from './llmCategorizationService.js';
import TransactionCategory from '../models/TransactionCategory.js';

/**
 * Service for analyzing risk based on bank statements and transactions
 */
class RiskAnalysisService {
  constructor() {
    this.logger = logger;
    this.llmService = new LLMCategorizationService();
  }

  /**
   * Calculates the number of NSF (Non-Sufficient Funds) fees in the transactions
   * @param {Array} transactions The list of transactions to analyze
   * @returns {number} The count of NSF fees
   */
  calculateNSFCount(transactions) {
    if (!Array.isArray(transactions)) {
      throw new Error('Transactions must be an array');
    }
    return transactions.filter(t => {
      const description = t.description.toUpperCase();
      return description.includes('NSF') || 
             description.includes('INSUFFICIENT FUNDS') ||
             description.includes('OVERDRAFT');
    }).length;
  }

  /**
   * Calculates total deposits and withdrawals from a list of transactions
   * @param {Array} transactions The list of transactions to analyze
   * @returns {Object} Object containing totalDeposits, totalWithdrawals and counts
   * @throws {Error} If transactions parameter is not an array
   */
  calculateTotalDepositsAndWithdrawals(transactions) {
    if (!Array.isArray(transactions)) {
      throw new Error('Transactions must be an array');
    }
    return transactions.reduce((acc, transaction) => {
      if (transaction && typeof transaction.amount === 'number') {
        if (transaction.amount > 0) {
          acc.totalDeposits += transaction.amount;
          acc.depositCount++;
        } else {
          acc.totalWithdrawals += Math.abs(transaction.amount);
          acc.withdrawalCount++;
        }
      }
      return acc;
    }, {
      totalDeposits: 0,
      totalWithdrawals: 0,
      depositCount: 0,
      withdrawalCount: 0
    });
  }

  /**
   * Calculates NSF (Non-Sufficient Funds) related metrics
   * @param {Array} transactions The list of transactions to analyze
   * @returns {Object} Object containing NSF metrics
   * @throws {Error} If transactions parameter is not an array
   */
  calculateNSFMetrics(transactions) {
    if (!Array.isArray(transactions)) {
      throw new Error('Transactions must be an array');
    }

    const nsfKeywords = [
      'nsf', 'insufficient funds', 'overdraft', 'returned check',
      'returned item', 'bounce', 'non-sufficient', 'overdraw',
      'insufficient', 'returned deposit', 'reject', 'decline',
      'unavailable funds', 'return fee', 'chargeback', 'reversal',
      'dishonored', 'unpaid', 'refer to maker'
    ];

    const nsfTransactions = transactions.filter(transaction => {
      if (transaction && transaction.description) {
        const description = transaction.description.toLowerCase();
        return nsfKeywords.some(keyword => description.includes(keyword));
      }
      return false;
    });

    return {
      nsfCount: nsfTransactions.length,
      nsfTotal: nsfTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
      nsfTransactions
    };
  }

  /**
   * Calculates the average daily balance for a list of transactions
   * @param {Array} transactions The list of transactions to analyze
   * @param {number} openingBalance The opening balance before these transactions
   * @returns {Object} Object containing averageDailyBalance and other balance metrics
   * @throws {Error} If transactions parameter is not an array
   */
  calculateAverageDailyBalance(transactions, openingBalance = 0) {
    if (!Array.isArray(transactions)) {
      throw new Error('Transactions must be an array');
    }

    if (typeof openingBalance !== 'number' || isNaN(openingBalance)) {
      throw new Error('Opening balance must be a number');
    }

    if (transactions.length === 0) {
      return {
        averageDailyBalance: openingBalance,
        lowestBalance: openingBalance,
        highestBalance: openingBalance,
        periodDays: 0
      };
    }

    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    // Get date range
    const startDate = new Date(sortedTransactions[0].date);
    const endDate = new Date(sortedTransactions[sortedTransactions.length - 1].date);
    const daysCovered = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Track running balance and extremes
    let runningBalance = openingBalance;
    let totalBalance = openingBalance;
    let lowestBalance = openingBalance;
    let highestBalance = openingBalance;
    let currentDate = new Date(startDate);
    let daysTracked = 1;

    for (const transaction of sortedTransactions) {
      const transactionDate = new Date(transaction.date);
      
      // Add previous balance for days without transactions
      while (currentDate < transactionDate) {
        totalBalance += runningBalance;
        currentDate.setDate(currentDate.getDate() + 1);
        daysTracked++;
      }

      runningBalance += transaction.amount;
      totalBalance += runningBalance;
      lowestBalance = Math.min(lowestBalance, runningBalance);
      highestBalance = Math.max(highestBalance, runningBalance);
      daysTracked++;
    }

    return {
      averageDailyBalance: Math.round((totalBalance / daysCovered) * 100) / 100,
      lowestBalance: Math.round(lowestBalance * 100) / 100,
      highestBalance: Math.round(highestBalance * 100) / 100,
      periodDays: daysCovered
    };
  }

  /**
   * Calculates income stability metrics
   * @param {Array} transactions The list of transactions to analyze
   * @returns {Object} Object containing income stability metrics
   */
  calculateIncomeStability(transactions) {
    // Filter credit transactions (deposits)
    const deposits = transactions
      .filter(t => t.amount > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Group deposits by month
    const monthlyDeposits = deposits.reduce((acc, deposit) => {
      const month = new Date(deposit.date).toISOString().substring(0, 7);
      acc[month] = (acc[month] || 0) + deposit.amount;
      return acc;
    }, {});

    const monthlyAmounts = Object.values(monthlyDeposits);
    
    // Calculate metrics
    const averageMonthlyIncome = monthlyAmounts.reduce((sum, amount) => sum + amount, 0) / monthlyAmounts.length;
    const incomeVariance = monthlyAmounts.reduce((sum, amount) => {
      const diff = amount - averageMonthlyIncome;
      return sum + (diff * diff);
    }, 0) / monthlyAmounts.length;

    return {
      averageMonthlyIncome,
      incomeVariance,
      monthlyDeposits,
      stabilityScore: this._calculateStabilityScore(incomeVariance, averageMonthlyIncome)
    };
  }

  /**
   * Calculate business-related metrics
   * @param {Array} transactions The list of transactions to analyze
   * @returns {Object} Object containing business activity metrics
   */
  calculateBusinessMetrics(transactions) {
    const businessKeywords = ['PAYPAL', 'SQUARE', 'STRIPE', 'SHOPIFY', 'VENDOR', 'INVENTORY'];
    const businessTransactions = transactions.filter(transaction => {
      const description = transaction.description.toUpperCase();
      return businessKeywords.some(keyword => description.includes(keyword));
    });

    const businessDeposits = businessTransactions.filter(t => t.amount > 0);
    const businessExpenses = businessTransactions.filter(t => t.amount < 0);

    return {
      totalBusinessDeposits: businessDeposits.reduce((sum, t) => sum + t.amount, 0),
      totalBusinessExpenses: Math.abs(businessExpenses.reduce((sum, t) => sum + t.amount, 0)),
      businessTransactionCount: businessTransactions.length,
      hasBusinessActivity: businessTransactions.length > 0,
      businessTransactions
    };
  }

  /**
   * Calculate overall Veritas Score
   * @param {Object} data Analysis data including all metrics
   * @returns {Object} Object containing Veritas score and factor breakdown
   */
  async calculateVeritasScore(data) {
    const {
      transactions,
      nsfMetrics,
      balanceMetrics,
      incomeMetrics,
      businessMetrics
    } = data;

    // Base score starts at 700
    let score = 700;

    // NSF Impact (-50 points per NSF, max -150)
    score -= Math.min(nsfMetrics.nsfCount * 50, 150);

    // Balance Impact (max +/- 100)
    const balanceImpact = this._calculateBalanceImpact(balanceMetrics);
    score += balanceImpact;

    // Income Stability Impact (max +/- 100)
    const stabilityImpact = this._calculateStabilityImpact(incomeMetrics);
    score += stabilityImpact;

    // Transaction Volume and Pattern Impact (max +50)
    const transactionImpact = this._calculateTransactionImpact(transactions);
    score += transactionImpact;

    // Business Activity Impact (max +50)
    if (businessMetrics.hasBusinessActivity) {
      const businessImpact = this._calculateBusinessImpact(businessMetrics);
      score += businessImpact;
    }

    // Ensure score stays within bounds (300-850)
    score = Math.max(300, Math.min(850, score));

    return {
      score,
      factors: {
        nsfImpact: -Math.min(nsfMetrics.nsfCount * 50, 150),
        balanceImpact,
        stabilityImpact,
        transactionImpact,
        businessImpact: businessMetrics.hasBusinessActivity ? 
          this._calculateBusinessImpact(businessMetrics) : 0
      }
    };
  }

  /**
   * Helper method to calculate stability score
   */
  _calculateStabilityScore(variance, averageIncome) {
    if (averageIncome === 0) return 0;
    const coefficientOfVariation = Math.sqrt(variance) / averageIncome;
    return Math.max(0, 100 * (1 - coefficientOfVariation));
  }

  /**
   * Helper method to calculate balance impact on score
   */
  _calculateBalanceImpact(balanceMetrics) {
    const { averageDailyBalance, lowestBalance } = balanceMetrics;
    if (averageDailyBalance <= 0) return -100;
    if (lowestBalance < 0) return -50;
    
    const balanceScore = Math.min(100, (averageDailyBalance / 5000) * 100);
    return Math.floor(balanceScore);
  }

  /**
   * Helper method to calculate stability impact on score
   */
  _calculateStabilityImpact(incomeMetrics) {
    const { stabilityScore, averageMonthlyIncome } = incomeMetrics;
    if (averageMonthlyIncome === 0) return -100;
    return Math.floor(stabilityScore - 50);
  }

  /**
   * Helper method to calculate transaction impact on score
   */
  _calculateTransactionImpact(transactions) {
    if (transactions.length < 5) return 0;
    return Math.min(50, Math.floor(transactions.length / 2));
  }

  /**
   * Helper method to calculate business impact on score
   */
  _calculateBusinessImpact(businessMetrics) {
    const { totalBusinessDeposits, totalBusinessExpenses } = businessMetrics;
    if (totalBusinessDeposits === 0) return 0;
    
    const profitRatio = (totalBusinessDeposits - totalBusinessExpenses) / totalBusinessDeposits;
    return Math.floor(Math.min(50, profitRatio * 100));
  }

  /**
   * Analyze overall risk and generate comprehensive report
   * @param {Array} transactions The list of transactions to analyze
   * @param {Object} statement The bank statement data
   * @returns {Object} Comprehensive risk analysis report
   */
  async analyzeRisk(transactions, statement) {
    try {
      // Calculate all metrics
      const nsfMetrics = this.calculateNSFMetrics(transactions);
      const balanceMetrics = this.calculateAverageDailyBalance(
        transactions, 
        statement.openingBalance
      );
      const incomeMetrics = this.calculateIncomeStability(transactions);
      const businessMetrics = this.calculateBusinessMetrics(transactions);
      
      // Calculate Veritas Score
      const veritasScore = await this.calculateVeritasScore({
        transactions,
        nsfMetrics,
        balanceMetrics,
        incomeMetrics,
        businessMetrics
      });

      // Categorize transactions
      const categorizedTransactions = await this._categorizeTransactions(transactions);

      return {
        score: veritasScore.score,
        factors: veritasScore.factors,
        metrics: {
          nsf: nsfMetrics,
          balance: balanceMetrics,
          income: incomeMetrics,
          business: businessMetrics
        },
        categorizedTransactions,
        riskLevel: this._determineRiskLevel(veritasScore.score)
      };
    } catch (error) {
      this.logger.error('Error in analyzeRisk:', error);
      throw error;
    }
  }

  /**
   * Analyze transaction data for risk factors.
   * This is an alias for analyzeRisk to maintain compatibility.
   * @param {Array} transactions - The list of transactions to analyze.
   * @param {number} [openingBalance=0] - The opening balance.
   * @returns {Promise<Object>} A risk analysis object.
   */
  async analyzeTransactions(transactions, openingBalance = 0) {
    this.logger.info('analyzeTransactions called, delegating to analyzeRisk.');
    return this.analyzeRisk(transactions, openingBalance);
  }

  /**
   * Helper method to categorize transactions using LLM service and caching
   */
  async _categorizeTransactions(transactions) {
    const categorized = [];

    for (const transaction of transactions) {
      try {
        // Check cache first
        const cached = await TransactionCategory.findCachedCategory(transaction.description);
        
        if (cached) {
          categorized.push({
            ...transaction,
            category: cached.category,
            confidence: cached.confidence,
            source: 'cache'
          });
          continue;
        }

        // Use LLM service for uncached transactions
        const { category, confidence } = await this.llmService.categorizeTransaction(transaction);
        
        // Cache the result
        await TransactionCategory.cacheCategory(
          transaction.description,
          category,
          confidence,
          'LLM'
        );

        categorized.push({
          ...transaction,
          category,
          confidence,
          source: 'llm'
        });
      } catch (error) {
        this.logger.error('Error categorizing transaction:', error);
        categorized.push({
          ...transaction,
          category: 'Uncategorized',
          confidence: 0,
          source: 'error'
        });
      }
    }

    return categorized;
  }

  /**
   * Helper method to determine risk level from score
   */
  _determineRiskLevel(score) {
    if (score >= 750) return 'LOW';
    if (score >= 650) return 'MODERATE';
    if (score >= 550) return 'MEDIUM';
    if (score >= 450) return 'HIGH';
    return 'VERY_HIGH';
  }
}

// Create singleton instance
const riskAnalysisService = new RiskAnalysisService();

export { riskAnalysisService as default, RiskAnalysisService };
