// src/controllers/statementController.js
import mongoose from 'mongoose';
import Statement from '../models/Statement.js';
import Transaction from '../models/Transaction.js';
import PDFParserService from '../services/pdfParserService.js';
import riskAnalysisService from '../services/riskAnalysisService.minimal.js';
import { LLMCategorizationService } from '../services/llmCategorizationService.js';
import IncomeStabilityService from '../services/incomeStabilityService.js';
import AlertsEngineService from '../services/AlertsEngineService.js';
import ZohoCrmService from '../services/crm/zoho.service.js';
import { RedisStreamService } from '../services/redisStreamService.js';
import { PerplexityService } from '../services/perplexityService.js';
import { exportToPDF, exportToExcel } from '../services/exportService.js';
import { searchTransactions } from '../services/searchService.js';
import { setBudget, getBudget, analyzeBudget } from '../services/budgetService.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

/**
 * @class StatementController
 * @description Controller for handling bank statement operations
 */
class StatementController {
  /**
   * Upload and process a bank statement
   * @param {Request} req Express request object
   * @param {Response} res Express response object
   */
  static async uploadStatement(req, res) {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400);
      }

      if (req.file.mimetype !== 'application/pdf') {
        throw new AppError('Invalid file type. Only PDF files are supported.', 400);
      }

      const statement = new Statement({
        userId: req.user.id,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        status: 'pending',
        fileType: req.file.mimetype,
        fileSize: req.file.size
      });

      await statement.save();

      res.status(201).json({
        success: true,
        message: 'Statement uploaded successfully',
        data: {
          statementId: statement._id,
          fileName: statement.fileName,
          status: statement.status
        }
      });

    } catch (error) {
      logger.error('Error in uploadStatement:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error while uploading statement'
        });
      }
    }
  }
}

/**
 * Waterfall Analysis Criteria Configuration
 * Controls when expensive third-party API calls should be made
 */
export default StatementController;

const WATERFALL_CRITERIA = {
  // Minimum criteria to proceed to expensive third-party APIs
  minimumScore: 6.0,           // Minimum Helios Engine score (out of 10)
  minimumTransactions: 10,     // Minimum transaction count
  minimumDuration: 30,         // Minimum statement period in days
  maximumRiskLevel: 'HIGH',    // Maximum acceptable risk level
  minimumBalance: 1000,        // Minimum average daily balance
  
  // Cost thresholds for API calls
  apiCosts: {
    middesk: 25.00,            // Cost per Middesk API call
    isoftpull: 15.00,          // Cost per iSoftpull API call
    sos: 5.00                  // Cost per SOS verification
  },
  
  // Budget limits
  maxDailyBudget: 200.00,      // Maximum daily API spend
  maxPerAnalysisBudget: 50.00, // Maximum spend per statement analysis
  
  // Progressive criteria for API selection
  scoreThresholds: {
    middesk: 6.5,              // Score needed for Middesk verification
    isoftpull: 7.5,            // Score needed for credit check
    sos: 6.0                   // Score needed for SOS verification
  }
};

// In-memory storage for statements
const statements = new Map();

// Initialize services with async import for PDFParserService to bypass mocking issues
let pdfParserService = null;
async function initializePDFParserService() {
  if (!pdfParserService) {
    const { default: PDFParserService } = await import('../services/pdfParserService.js');
    pdfParserService = new PDFParserService();
  }
  return pdfParserService;
}

const incomeStabilityService = new IncomeStabilityService();

// Initialize enhanced services
const llmCategorizationService = new LLMCategorizationService();
const redisStreamService = new RedisStreamService();

// Initialize external API services (mock implementations for Middesk and iSoftpull)
const mockMiddeskService = {
  async businessVerification(companyData) {
    logger.info('🏢 Middesk Business Verification called');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API delay
    return {
      verified: true,
      businessName: companyData.businessName,
      taxId: companyData.taxId,
      address: companyData.address,
      verificationScore: 0.95,
      riskLevel: 'LOW'
    };
  }
};

const mockiSoftpullService = {
  async creditCheck(personalData) {
    logger.info('💳 iSoftpull Credit Check called');
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay
    return {
      creditScore: 720,
      riskGrade: 'B',
      tradelines: 12,
      inquiries: 2,
      riskFactors: ['High credit utilization on revolving accounts']
    };
  }
};

// Initialize Zoho CRM service with configuration
let zohoCrmService = null;
const initializeZohoCrmService = () => {
  if (!zohoCrmService) {
    const config = {
      clientId: process.env.ZOHO_CLIENT_ID,
      clientSecret: process.env.ZOHO_CLIENT_SECRET,
      refreshToken: process.env.ZOHO_REFRESH_TOKEN,
      apiDomain: process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com',
      apiVersion: 'v2',
      accountsUrl: process.env.ZOHO_AUTH_URL || process.env.ZOHO_ACCOUNTS_URL
    };
    
    if (config.clientId && config.clientSecret && config.refreshToken) {
      zohoCrmService = new ZohoCrmService(config);
      logger.info('Zoho CRM service initialized successfully');
    } else {
      logger.warn('Zoho CRM service not initialized - missing required environment variables');
    }
  }
  return zohoCrmService;
};

// Utility functions for security and logging
const hashForLogging = (str) => crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
const sanitizeTransaction = (transaction) => ({ ...transaction });

// Mock implementations for optional services
const mockSecureFileProcessor = {
  processFile: async (file, userId) => ({ fileId: Date.now().toString(), sessionKey: 'mock-key' }),
  retrieveFile: async (fileId, sessionKey) => null, // Will use direct buffer
  deleteFile: (fileId) => {}
};

const mockComplianceLogger = {
  logFileAccess: (userId, action, details) => logger.info(`File access: ${action}`, details),
  logDataProcessing: (userId, process, success) => logger.info(`Data processing: ${process} - ${success ? 'success' : 'failed'}`)
};

const mockRedisStream = {
  addTransaction: async (transaction) => ({ id: `stream_${Date.now()}` })
};

/**
 * Helper function to push critical alerts to Zoho CRM
 * @param {Array} alerts - Array of all alerts
 * @param {string} dealId - Zoho deal ID (optional)
 * @param {string} userId - User ID for logging
 */
const pushCriticalAlertsToZoho = async (alerts, dealId, userId) => {
  try {
    // Filter alerts to only HIGH and CRITICAL severity
    const criticalAlerts = alerts.filter(alert => 
      alert.severity === 'HIGH' || alert.severity === 'CRITICAL'
    );
    
    // Skip if no critical alerts or no deal ID provided
    if (criticalAlerts.length === 0) {
      logger.info(`No critical alerts found for user ${userId} - skipping Zoho CRM update`);
      return;
    }
    
    if (!dealId) {
      logger.info(`No dealId provided for user ${userId} - skipping Zoho CRM update (${criticalAlerts.length} critical alerts available)`);
      return;
    }
    
    // Initialize Zoho CRM service
    const zohoCrm = initializeZohoCrmService();
    if (!zohoCrm) {
      logger.warn(`Zoho CRM service not available for user ${userId} - skipping critical alerts update`);
      return;
    }
    
    // Format the critical alerts summary
    const alertsSummary = formatCriticalAlertsForZoho(criticalAlerts);
    
    // Step 1: Add note to deal in Zoho CRM
    logger.info(`Pushing ${criticalAlerts.length} critical alerts to Zoho CRM for deal ${dealId}`);
    const noteResult = await zohoCrm.addNoteToDeal(dealId, alertsSummary);
    
    logger.info(`✅ Successfully added critical alerts note to Zoho deal ${dealId}:`, {
      noteId: noteResult.id,
      alertCount: criticalAlerts.length,
      userId: userId
    });
    
    // Step 2: Create follow-up tasks for each critical alert
    const taskResults = [];
    logger.info(`Creating ${criticalAlerts.length} follow-up tasks for critical alerts...`);
    
    for (const alert of criticalAlerts) {
      try {
        const taskDetails = generateTaskFromAlert(alert);
        const taskResult = await zohoCrm.createTaskInDeal(
          dealId,
          taskDetails.subject,
          taskDetails.description,
          taskDetails.priority,
          taskDetails.dueDate
        );
        
        taskResults.push({
          alertCode: alert.code,
          taskId: taskResult.id,
          subject: taskDetails.subject,
          success: true
        });
        
        logger.info(`✅ Created task for alert ${alert.code}: ${taskResult.id}`);
      } catch (taskError) {
        logger.error(`❌ Failed to create task for alert ${alert.code}:`, taskError.message);
        taskResults.push({
          alertCode: alert.code,
          success: false,
          error: taskError.message
        });
      }
    }
    
    const successfulTasks = taskResults.filter(t => t.success).length;
    logger.info(`✅ Successfully pushed critical alerts to Zoho CRM:`, {
      dealId: dealId,
      noteCreated: true,
      tasksCreated: successfulTasks,
      totalTasks: taskResults.length,
      userId: userId
    });
    
    return {
      noteId: noteResult.id,
      taskResults: taskResults,
      successfulTasks: successfulTasks,
      totalAlerts: criticalAlerts.length
    };
    
  } catch (error) {
    // Log error but don't fail the main analysis process
    logger.error(`❌ Failed to push critical alerts to Zoho CRM for user ${userId}:`, {
      error: error.message,
      dealId: dealId,
      alertCount: alerts.filter(a => a.severity === 'HIGH' || a.severity === 'CRITICAL').length
    });
  }
};

/**
 * Helper function to generate task details from an alert
 * @param {Object} alert - The alert object
 * @returns {Object} Task details for Zoho CRM
 */
const generateTaskFromAlert = (alert) => {
  const baseSubject = getTaskSubjectForAlert(alert.code);
  const priority = alert.severity === 'CRITICAL' ? 'High' : 'Normal';
  
  // Set due date based on severity
  const dueDate = new Date();
  if (alert.severity === 'CRITICAL') {
    dueDate.setDate(dueDate.getDate() + 1); // Next business day for critical
  } else {
    dueDate.setDate(dueDate.getDate() + 3); // 3 days for high priority
  }
  
  let description = `BANK STATEMENT ANALYSIS ALERT\n`;
  description += `Alert Code: ${alert.code}\n`;
  description += `Severity: ${alert.severity}\n`;
  description += `Message: ${alert.message}\n\n`;
  
  // Add specific data based on alert type
  if (alert.data) {
    description += `Additional Details:\n`;
    
    if (alert.data.accountIndex) {
      description += `• Account Number: #${alert.data.accountIndex}\n`;
    }
    if (alert.data.nsfCount) {
      description += `• NSF Count: ${alert.data.nsfCount}\n`;
    }
    if (alert.data.averageDailyBalance !== undefined) {
      description += `• Average Daily Balance: $${alert.data.averageDailyBalance.toLocaleString()}\n`;
    }
    if (alert.data.negativeDayCount) {
      description += `• Days with Negative Balance: ${alert.data.negativeDayCount}\n`;
    }
    if (alert.data.discrepancyPercentage) {
      description += `• Revenue Discrepancy: ${alert.data.discrepancyPercentage}%\n`;
      description += `• Stated Annual Revenue: $${alert.data.statedAnnualRevenue?.toLocaleString()}\n`;
      description += `• Annualized Deposits: $${alert.data.annualizedDeposits?.toLocaleString()}\n`;
    }
    if (alert.data.discrepancyMonths) {
      description += `• Time Discrepancy: ${alert.data.discrepancyMonths} months\n`;
      description += `• Stated Start Date: ${alert.data.statedStartDate}\n`;
      description += `• Official Registration Date: ${alert.data.officialRegistrationDate}\n`;
    }
    if (alert.data.amount) {
      description += `• Amount: $${alert.data.amount.toLocaleString()}\n`;
    }
  }
  
  description += `\n⚠️ ACTION REQUIRED: Please review this alert and take appropriate underwriting action.\n`;
  description += `Generated: ${new Date().toLocaleString()}\n`;
  description += `Source: Bank Statement Analyzer v2.0.0`;
  
  return {
    subject: baseSubject,
    description: description,
    priority: priority,
    dueDate: dueDate
  };
};

/**
 * Helper function to get task subject based on alert code
 * @param {string} alertCode - The alert code
 * @returns {string} Task subject
 */
const getTaskSubjectForAlert = (alertCode) => {
  const taskMap = {
    'HIGH_NSF_COUNT': 'Task: Review High NSF Activity',
    'LOW_AVERAGE_BALANCE': 'Task: Analyze Low Account Balance',
    'NEGATIVE_BALANCE_DAYS': 'Task: Review Negative Balance Days',
    'GROSS_ANNUAL_REVENUE_MISMATCH': 'Task: Manually Review Revenue Discrepancy',
    'TIME_IN_BUSINESS_DISCREPANCY': 'Task: Verify Business Start Date',
    'NSF_TRANSACTION_ALERT': 'Task: Review NSF Transaction Pattern',
    'NEGATIVE_BALANCE_ALERT': 'Task: Investigate Negative Balance',
    'OVERDRAFT_ALERT': 'Task: Review Overdraft Activity',
    'UNUSUAL_DEPOSIT_PATTERN': 'Task: Analyze Deposit Irregularities',
    'CASH_FLOW_IRREGULARITY': 'Task: Investigate Cash Flow Issues',
    'VELOCITY_ALERT': 'Task: Review Transaction Velocity',
    'BUSINESS_VERIFICATION_FAILED': 'Task: Verify Business Registration',
    'CREDIT_INQUIRY_ALERT': 'Task: Review Credit Inquiry History'
  };
  
  return taskMap[alertCode] || `Task: Review ${alertCode} Alert`;
};

/**
 * Helper function to format critical alerts for Zoho CRM note
 * @param {Array} criticalAlerts - Array of HIGH/CRITICAL alerts
 * @returns {string} Formatted alert summary
 */
const formatCriticalAlertsForZoho = (criticalAlerts) => {
  const timestamp = new Date().toLocaleString();
  const criticalCount = criticalAlerts.filter(a => a.severity === 'CRITICAL').length;
  const highCount = criticalAlerts.filter(a => a.severity === 'HIGH').length;
  
  let summary = `🚨 BANK STATEMENT ANALYSIS - CRITICAL ALERTS DETECTED\n`;
  summary += `Generated: ${timestamp}\n\n`;
  summary += `ALERT SUMMARY:\n`;
  summary += `• Critical Alerts: ${criticalCount}\n`;
  summary += `• High Priority Alerts: ${highCount}\n`;
  summary += `• Total Critical Issues: ${criticalAlerts.length}\n\n`;
  
  summary += `DETAILED ALERTS:\n`;
  summary += `${'='.repeat(50)}\n\n`;
  
  criticalAlerts.forEach((alert, index) => {
    summary += `${index + 1}. [${alert.severity}] ${alert.code}\n`;
    summary += `   Message: ${alert.message}\n`;
    
    if (alert.data) {
      if (alert.data.accountIndex) {
        summary += `   Account: #${alert.data.accountIndex}\n`;
      }
      if (alert.data.amount) {
        summary += `   Amount: $${alert.data.amount.toLocaleString()}\n`;
      }
      if (alert.data.count !== undefined) {
        summary += `   Count: ${alert.data.count}\n`;
      }
      if (alert.data.percentage) {
        summary += `   Percentage: ${alert.data.percentage}%\n`;
      }
    }
    summary += `\n`;
  });
  
  summary += `${'='.repeat(50)}\n`;
  summary += `⚠️ RECOMMENDED ACTION: Immediate review required for this application.\n`;
  summary += `Please analyze these alerts before proceeding with underwriting decisions.\n\n`;
  summary += `Generated by: Bank Statement Analyzer v2.0.0`;
  
  return summary;
};

// Helper method to get date range from transactions
const getDateRange = (transactions) => {
  if (!transactions || transactions.length === 0) {
    return { start: null, end: null, days: 0 };
  }
  
  const dates = transactions
    .map(t => new Date(t.date))
    .filter(date => !isNaN(date.getTime()))
    .sort((a, b) => a - b);
  
  if (dates.length === 0) {
    return { start: null, end: null, days: 0 };
  }
  
  const start = dates[0];
  const end = dates[dates.length - 1];
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    days: days
  };
};

class StatementController {
  
  /**
   * WATERFALL PHASE 1: Enhanced Helios Engine Analysis
   * Runs comprehensive internal analysis before considering external APIs
   */
  static runHeliosEngineAnalysis = async (statement, transactions, openingBalance = 0) => {
    const phaseStart = Date.now();
    logger.info('🚀 PHASE 1: Starting Enhanced Helios Engine Analysis');
    
    try {
      // Core risk analysis
      const riskAnalysis = riskAnalysisService.analyzeRisk(transactions, openingBalance);
      const depositsAndWithdrawals = riskAnalysisService.calculateTotalDepositsAndWithdrawals(transactions);
      const nsfAnalysis = riskAnalysisService.calculateNSFCount(transactions);
      const balanceAnalysis = riskAnalysisService.calculateAverageDailyBalance(transactions, openingBalance);
      
      // Income stability analysis
      const incomeStabilityService = new IncomeStabilityService();
      const incomeStabilityAnalysis = incomeStabilityService.analyze(transactions);
      
      // Prepare analysis results for Veritas Score calculation
      const analysisResults = {
        nsfCount: nsfAnalysis.nsfCount,
        averageBalance: balanceAnalysis.averageBalance,
        riskAnalysis: riskAnalysis,
        incomeStability: incomeStabilityAnalysis,
        depositsAndWithdrawals: depositsAndWithdrawals,
        nsfAnalysis: nsfAnalysis,
        balanceAnalysis: balanceAnalysis,
        transactionSummary: {
          totalTransactions: transactions.length,
          creditTransactions: transactions.filter(t => t.type === 'credit').length,
          debitTransactions: transactions.filter(t => t.type === 'debit').length,
          dateRange: getDateRange(transactions)
        }
      };
      
      // Calculate Veritas Score
      const veritasScore = riskAnalysisService.calculateVeritasScore(analysisResults, transactions);
      
      // Prepare comprehensive Helios Engine analysis
      const heliosAnalysis = {
        veritasScore: veritasScore,
        riskAnalysis: riskAnalysis,
        incomeStabilityAnalysis: incomeStabilityAnalysis,
        financialSummary: {
          totalDeposits: depositsAndWithdrawals.totalDeposits,
          totalWithdrawals: depositsAndWithdrawals.totalWithdrawals,
          netChange: Math.round((depositsAndWithdrawals.totalDeposits - depositsAndWithdrawals.totalWithdrawals) * 100) / 100,
          openingBalance: openingBalance,
          estimatedClosingBalance: Math.round((openingBalance + depositsAndWithdrawals.totalDeposits - depositsAndWithdrawals.totalWithdrawals) * 100) / 100
        },
        balanceAnalysis: {
          averageDailyBalance: balanceAnalysis.averageBalance,
          periodDays: balanceAnalysis.periodDays,
          startDate: balanceAnalysis.startDate,
          endDate: balanceAnalysis.endDate
        },
        nsfAnalysis: {
          nsfCount: nsfAnalysis.nsfCount,
          nsfTransactions: nsfAnalysis.nsfTransactions
        },
        transactionSummary: analysisResults.transactionSummary,
        // Waterfall metadata
        waterfallMetadata: {
          phase: 'helios_engine',
          duration: Date.now() - phaseStart,
          cost: 0, // Internal analysis is free
          timestamp: new Date()
        }
      };
      
      const phaseDuration = Date.now() - phaseStart;
      logger.info(`✅ PHASE 1 Complete: Helios Engine Analysis (${phaseDuration}ms)`, {
        veritasScore: veritasScore.score,
        riskLevel: riskAnalysis.riskLevel,
        transactionCount: transactions.length,
        averageBalance: balanceAnalysis.averageBalance
      });
      
      return {
        success: true,
        data: heliosAnalysis,
        metrics: {
          duration: phaseDuration,
          cost: 0,
          transactionsAnalyzed: transactions.length
        }
      };
      
    } catch (error) {
      logger.error('❌ PHASE 1 Failed: Helios Engine Analysis', {
        error: error.message,
        duration: Date.now() - phaseStart
      });
      
      return {
        success: false,
        error: error.message,
        phase: 'helios_engine'
      };
    }
  };

  /**
   * WATERFALL PHASE 2: Enhanced Criteria Evaluation
   * Determines if third-party APIs should be called based on comprehensive criteria
   */
  static evaluateWaterfallCriteria = async (heliosAnalysis) => {
    const phaseStart = Date.now();
    logger.info('⚖️ PHASE 2: Starting Enhanced Waterfall Criteria Evaluation');
    
    try {
      const {
        veritasScore,
        riskAnalysis,
        incomeStabilityAnalysis,
        balanceAnalysis,
        nsfAnalysis,
        financialSummary,
        transactionSummary
      } = heliosAnalysis;
      
      // Enhanced criteria evaluation
      const criteriaChecks = {
        // Core financial health checks
        scoreCheck: {
          name: 'Minimum Veritas Score',
          required: WATERFALL_CRITERIA.minimumScore * 100, // Convert to Veritas scale (0-850)
          actual: veritasScore.score,
          passed: veritasScore.score >= (WATERFALL_CRITERIA.minimumScore * 100),
          weight: 0.3
        },
        
        transactionCheck: {
          name: 'Minimum Transaction Count',
          required: WATERFALL_CRITERIA.minimumTransactions,
          actual: transactionSummary.totalTransactions,
          passed: transactionSummary.totalTransactions >= WATERFALL_CRITERIA.minimumTransactions,
          weight: 0.15
        },
        
        durationCheck: {
          name: 'Minimum Statement Duration',
          required: WATERFALL_CRITERIA.minimumDuration,
          actual: balanceAnalysis.periodDays,
          passed: balanceAnalysis.periodDays >= WATERFALL_CRITERIA.minimumDuration,
          weight: 0.1
        },
        
        balanceCheck: {
          name: 'Minimum Average Balance',
          required: WATERFALL_CRITERIA.minimumBalance,
          actual: balanceAnalysis.averageDailyBalance,
          passed: balanceAnalysis.averageDailyBalance >= WATERFALL_CRITERIA.minimumBalance,
          weight: 0.2
        },
        
        riskCheck: {
          name: 'Maximum Risk Level',
          required: WATERFALL_CRITERIA.maximumRiskLevel,
          actual: riskAnalysis.riskLevel,
          passed: this._isAcceptableRiskLevel(riskAnalysis.riskLevel, WATERFALL_CRITERIA.maximumRiskLevel),
          weight: 0.15
        },
        
        nsfCheck: {
          name: 'NSF Violation Check',
          required: 'Max 3 NSF incidents',
          actual: nsfAnalysis.nsfCount,
          passed: nsfAnalysis.nsfCount <= 3,
          weight: 0.1
        }
      };
      
      // Calculate weighted score
      let weightedScore = 0;
      let totalWeight = 0;
      Object.values(criteriaChecks).forEach(check => {
        if (check.passed) {
          weightedScore += check.weight;
        }
        totalWeight += check.weight;
      });
      
      const criteriaScore = (weightedScore / totalWeight) * 100;
      const shouldProceed = criteriaScore >= 70; // 70% threshold for proceeding
      
      // Budget constraint check
      const budgetCheck = await this._checkBudgetConstraints();
      
      // Determine which APIs to call based on score tiers
      const apiPlan = this._determineApiCallPlan(veritasScore.score, criteriaScore, budgetCheck);
      
      const evaluation = {
        shouldProceed: shouldProceed && budgetCheck.passed,
        criteriaScore: Math.round(criteriaScore),
        passedChecks: Object.values(criteriaChecks).filter(c => c.passed).length,
        totalChecks: Object.keys(criteriaChecks).length,
        detailedChecks: criteriaChecks,
        budgetCheck: budgetCheck,
        apiPlan: apiPlan,
        reason: shouldProceed 
          ? (budgetCheck.passed ? 'All criteria met - proceeding to external APIs' : 'Criteria met but budget constraints')
          : `Criteria not met - score ${Math.round(criteriaScore)}% (need 70%+)`,
        costSaved: shouldProceed ? 0 : (WATERFALL_CRITERIA.apiCosts.middesk + WATERFALL_CRITERIA.apiCosts.isoftpull + WATERFALL_CRITERIA.apiCosts.sos),
        metadata: {
          phase: 'criteria_evaluation',
          duration: Date.now() - phaseStart,
          timestamp: new Date()
        }
      };
      
      const phaseDuration = Date.now() - phaseStart;
      logger.info(`⚖️ PHASE 2 Complete: Criteria Evaluation (${phaseDuration}ms)`, {
        shouldProceed: evaluation.shouldProceed,
        criteriaScore: evaluation.criteriaScore,
        passedChecks: evaluation.passedChecks,
        apiPlan: apiPlan
      });
      
      return evaluation;
      
    } catch (error) {
      logger.error('❌ PHASE 2 Failed: Criteria Evaluation', {
        error: error.message,
        duration: Date.now() - phaseStart
      });
      
      return {
        shouldProceed: false,
        reason: 'Criteria evaluation failed',
        error: error.message,
        costSaved: WATERFALL_CRITERIA.apiCosts.middesk + WATERFALL_CRITERIA.apiCosts.isoftpull + WATERFALL_CRITERIA.apiCosts.sos
      };
    }
  };

  /**
   * WATERFALL PHASE 3: Conditional External API Execution
   * Only calls expensive third-party APIs if criteria are met
   */
  static executeConditionalExternalApis = async (heliosAnalysis, userContext, apiPlan) => {
    const phaseStart = Date.now();
    logger.info('💰 PHASE 3: Starting Conditional External API Execution');
    
    try {
      const results = {
        middesk: null,
        isoftpull: null,
        sos: null,
        errors: [],
        executionOrder: [],
        totalCost: 0,
        executionTimes: {}
      };
      
      // Execute APIs based on plan and score tiers
      if (apiPlan.middesk) {
        try {
          const middeskStart = Date.now();
          logger.info('🏢 Executing Middesk Business Verification');
          
          results.middesk = await mockMiddeskService.businessVerification({
            businessName: userContext.businessName,
            taxId: userContext.taxId,
            address: userContext.address
          });
          
          results.executionOrder.push('middesk');
          results.totalCost += WATERFALL_CRITERIA.apiCosts.middesk;
          results.executionTimes.middesk = Date.now() - middeskStart;
          
          logger.info('✅ Middesk verification completed', {
            verified: results.middesk.verified,
            cost: WATERFALL_CRITERIA.apiCosts.middesk,
            duration: results.executionTimes.middesk
          });
          
        } catch (error) {
          logger.warn('⚠️ Middesk API call failed', { error: error.message });
          results.errors.push({
            service: 'middesk',
            error: error.message,
            impact: 'Business verification not available'
          });
        }
      }
      
      if (apiPlan.isoftpull) {
        try {
          const isoftpullStart = Date.now();
          logger.info('💳 Executing iSoftpull Credit Check');
          
          results.isoftpull = await mockiSoftpullService.creditCheck({
            ssn: userContext.ssn,
            firstName: userContext.firstName,
            lastName: userContext.lastName
          });
          
          results.executionOrder.push('isoftpull');
          results.totalCost += WATERFALL_CRITERIA.apiCosts.isoftpull;
          results.executionTimes.isoftpull = Date.now() - isoftpullStart;
          
          logger.info('✅ iSoftpull credit check completed', {
            creditScore: results.isoftpull.creditScore,
            cost: WATERFALL_CRITERIA.apiCosts.isoftpull,
            duration: results.executionTimes.isoftpull
          });
          
        } catch (error) {
          logger.warn('⚠️ iSoftpull API call failed', { error: error.message });
          results.errors.push({
            service: 'isoftpull',
            error: error.message,
            impact: 'Credit check not available'
          });
        }
      }
      
      if (apiPlan.sos) {
        try {
          const sosStart = Date.now();
          logger.info('🏛️ Executing SOS Business Registration Check');
          
          // Mock SOS verification
          results.sos = {
            businessName: userContext.businessName,
            registrationStatus: 'ACTIVE',
            registrationDate: '2020-01-15',
            state: 'CA',
            verified: true
          };
          
          results.executionOrder.push('sos');
          results.totalCost += WATERFALL_CRITERIA.apiCosts.sos;
          results.executionTimes.sos = Date.now() - sosStart;
          
          logger.info('✅ SOS verification completed', {
            status: results.sos.registrationStatus,
            cost: WATERFALL_CRITERIA.apiCosts.sos,
            duration: results.executionTimes.sos
          });
          
        } catch (error) {
          logger.warn('⚠️ SOS API call failed', { error: error.message });
          results.errors.push({
            service: 'sos',
            error: error.message,
            impact: 'Business registration check not available'
          });
        }
      }
      
      const phaseDuration = Date.now() - phaseStart;
      logger.info(`💰 PHASE 3 Complete: External API Execution (${phaseDuration}ms)`, {
        servicesExecuted: results.executionOrder.length,
        totalCost: results.totalCost,
        errors: results.errors.length
      });
      
      return {
        success: true,
        executed: results.executionOrder.length > 0,
        results: results,
        metadata: {
          phase: 'external_apis',
          duration: phaseDuration,
          totalCost: results.totalCost,
          timestamp: new Date()
        }
      };
      
    } catch (error) {
      logger.error('❌ PHASE 3 Failed: External API Execution', {
        error: error.message,
        duration: Date.now() - phaseStart
      });
      
      return {
        success: false,
        executed: false,
        error: error.message,
        results: { middesk: null, isoftpull: null, sos: null, errors: [{ service: 'general', error: error.message }] }
      };
    }
  };

  /**
   * WATERFALL PHASE 4: Enhanced Result Consolidation
   * Combines internal Helios analysis with external API results for final assessment
   */
  static consolidateWaterfallResults = (heliosAnalysis, externalResults, evaluation) => {
    const phaseStart = Date.now();
    logger.info('🔄 PHASE 4: Starting Enhanced Result Consolidation');
    
    try {
      // Calculate enhanced scores combining internal and external data
      let enhancedVeritasScore = heliosAnalysis.veritasScore.score;
      const scoreAdjustments = [];
      
      // Apply external verification bonuses/penalties
      if (externalResults.executed && externalResults.results) {
        // Middesk business verification impact
        if (externalResults.results.middesk) {
          if (externalResults.results.middesk.verified) {
            enhancedVeritasScore += 25;
            scoreAdjustments.push('Business verification confirmed (+25 points)');
          } else {
            enhancedVeritasScore -= 50;
            scoreAdjustments.push('Business verification failed (-50 points)');
          }
        }
        
        // iSoftpull credit score impact
        if (externalResults.results.isoftpull) {
          const creditScore = externalResults.results.isoftpull.creditScore;
          if (creditScore >= 750) {
            enhancedVeritasScore += 40;
            scoreAdjustments.push(`Excellent credit score ${creditScore} (+40 points)`);
          } else if (creditScore >= 700) {
            enhancedVeritasScore += 20;
            scoreAdjustments.push(`Good credit score ${creditScore} (+20 points)`);
          } else if (creditScore >= 650) {
            enhancedVeritasScore += 10;
            scoreAdjustments.push(`Fair credit score ${creditScore} (+10 points)`);
          } else if (creditScore < 600) {
            enhancedVeritasScore -= 30;
            scoreAdjustments.push(`Poor credit score ${creditScore} (-30 points)`);
          }
        }
        
        // SOS registration status impact
        if (externalResults.results.sos && externalResults.results.sos.registrationStatus === 'ACTIVE') {
          enhancedVeritasScore += 15;
          scoreAdjustments.push('Active business registration (+15 points)');
        }
      }
      
      // Ensure score stays within valid range
      enhancedVeritasScore = Math.max(300, Math.min(850, enhancedVeritasScore));
      
      // Calculate enhanced grade
      const enhancedGrade = this._calculateVeritasGrade(enhancedVeritasScore);
      
      // Create comprehensive consolidated analysis
      const consolidatedAnalysis = {
        // Executive Summary
        executiveSummary: {
          finalVeritasScore: enhancedVeritasScore,
          finalGrade: enhancedGrade,
          originalScore: heliosAnalysis.veritasScore.score,
          scoreImprovement: enhancedVeritasScore - heliosAnalysis.veritasScore.score,
          analysisType: externalResults.executed ? 'comprehensive_waterfall' : 'basic_helios',
          confidence: externalResults.executed ? 'HIGH' : 'MEDIUM',
          recommendation: this._generateRecommendation(enhancedVeritasScore, externalResults)
        },
        
        // Detailed Analysis Components
        heliosEngine: {
          ...heliosAnalysis,
          enhancementApplied: externalResults.executed
        },
        
        externalVerification: externalResults.executed ? {
          businessVerification: externalResults.results.middesk,
          creditAssessment: externalResults.results.isoftpull,
          registrationStatus: externalResults.results.sos,
          verificationCost: externalResults.results.totalCost,
          verificationTime: Object.values(externalResults.results.executionTimes || {}).reduce((a, b) => a + b, 0)
        } : {
          executed: false,
          reason: evaluation.reason,
          costSaved: evaluation.costSaved
        },
        
        // Enhanced Risk Assessment
        enhancedRiskAssessment: {
          finalScore: enhancedVeritasScore,
          finalGrade: enhancedGrade,
          riskLevel: this._calculateRiskLevel(enhancedVeritasScore),
          scoreAdjustments: scoreAdjustments,
          confidenceLevel: externalResults.executed ? 'HIGH' : 'MEDIUM',
          dataSourcesUsed: this._getDataSources(heliosAnalysis, externalResults)
        },
        
        // Waterfall Analysis Metadata
        waterfallAnalysis: {
          methodology: 'Enhanced Helios Engine + Conditional External APIs',
          phasesExecuted: 4,
          criteriaEvaluation: evaluation,
          totalAnalysisCost: externalResults.executed ? externalResults.results.totalCost : 0,
          costSavings: evaluation.costSaved || 0,
          analysisDate: new Date(),
          processingTime: {
            heliosEngine: heliosAnalysis.waterfallMetadata?.duration || 0,
            criteriaEvaluation: evaluation.metadata?.duration || 0,
            externalApis: externalResults.metadata?.duration || 0,
            consolidation: Date.now() - phaseStart,
            total: Date.now() - (heliosAnalysis.waterfallMetadata?.timestamp?.getTime() || Date.now())
          }
        }
      };
      
      const phaseDuration = Date.now() - phaseStart;
      logger.info(`🔄 PHASE 4 Complete: Result Consolidation (${phaseDuration}ms)`, {
        finalScore: enhancedVeritasScore,
        finalGrade: enhancedGrade,
        scoreImprovement: enhancedVeritasScore - heliosAnalysis.veritasScore.score,
        confidence: consolidatedAnalysis.executiveSummary.confidence
      });
      
      return consolidatedAnalysis;
      
    } catch (error) {
      logger.error('❌ PHASE 4 Failed: Result Consolidation', {
        error: error.message,
        duration: Date.now() - phaseStart
      });
      
      // Return basic analysis if consolidation fails
      return {
        executiveSummary: {
          finalVeritasScore: heliosAnalysis.veritasScore.score,
          finalGrade: heliosAnalysis.veritasScore.grade,
          analysisType: 'basic_helios_fallback',
          confidence: 'LOW',
          error: 'Consolidation failed - using basic results'
        },
        heliosEngine: heliosAnalysis,
        consolidationError: error.message
      };
    }
  };

  // Helper methods for waterfall implementation
  static _isAcceptableRiskLevel = (actualRisk, maxAcceptableRisk) => {
    const riskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const actualIndex = riskLevels.indexOf(actualRisk);
    const maxIndex = riskLevels.indexOf(maxAcceptableRisk);
    return actualIndex <= maxIndex;
  };

  static _checkBudgetConstraints = async () => {
    // Mock budget check - in production, this would check actual usage
    const dailyUsage = 0; // Get from tracking system
    const estimatedCost = WATERFALL_CRITERIA.apiCosts.middesk + WATERFALL_CRITERIA.apiCosts.isoftpull + WATERFALL_CRITERIA.apiCosts.sos;
    
    return {
      passed: (dailyUsage + estimatedCost) <= WATERFALL_CRITERIA.maxDailyBudget && estimatedCost <= WATERFALL_CRITERIA.maxPerAnalysisBudget,
      dailyBudgetOk: (dailyUsage + estimatedCost) <= WATERFALL_CRITERIA.maxDailyBudget,
      perAnalysisBudgetOk: estimatedCost <= WATERFALL_CRITERIA.maxPerAnalysisBudget,
      estimatedCost: estimatedCost,
      dailyUsage: dailyUsage,
      remainingBudget: WATERFALL_CRITERIA.maxDailyBudget - dailyUsage
    };
  };

  static _determineApiCallPlan = (veritasScore, criteriaScore, budgetCheck) => {
    if (!budgetCheck.passed) {
      return { middesk: false, isoftpull: false, sos: false, reason: 'Budget constraints' };
    }
    
    // Progressive API calling based on score tiers
    const normalizedScore = veritasScore / 100; // Convert to 0-10 scale for comparison with thresholds
    
    return {
      middesk: normalizedScore >= WATERFALL_CRITERIA.scoreThresholds.middesk,
      isoftpull: normalizedScore >= WATERFALL_CRITERIA.scoreThresholds.isoftpull,
      sos: normalizedScore >= WATERFALL_CRITERIA.scoreThresholds.sos,
      reason: `Score-based API selection (Veritas: ${veritasScore}, Criteria: ${criteriaScore}%)`
    };
  };

  static _calculateVeritasGrade = (score) => {
    if (score >= 800) return 'A+';
    if (score >= 750) return 'A';
    if (score >= 700) return 'B+';
    if (score >= 650) return 'B';
    if (score >= 600) return 'C+';
    if (score >= 550) return 'C';
    if (score >= 500) return 'D+';
    return 'D';
  };

  static _calculateRiskLevel = (score) => {
    if (score >= 750) return 'LOW';
    if (score >= 650) return 'MEDIUM';
    if (score >= 550) return 'HIGH';
    return 'CRITICAL';
  };

  static _generateRecommendation = (score, externalResults) => {
    if (score >= 750) {
      return 'APPROVE - Excellent financial profile with strong creditworthiness';
    } else if (score >= 650) {
      return 'APPROVE with conditions - Good financial profile, consider terms adjustment';
    } else if (score >= 550) {
      return 'REVIEW - Moderate risk profile, manual underwriting recommended';
    } else {
      return 'DECLINE - High risk profile, does not meet lending criteria';
    }
  };

  static _getDataSources = (heliosAnalysis, externalResults) => {
    const sources = ['Bank Statement Analysis', 'Helios Engine', 'Risk Analysis', 'Income Stability Analysis'];
    
    if (externalResults.executed) {
      if (externalResults.results.middesk) sources.push('Middesk Business Verification');
      if (externalResults.results.isoftpull) sources.push('iSoftpull Credit Check');
      if (externalResults.results.sos) sources.push('SOS Business Registration');
    }
    
    return sources;
  };

  /**
   * Determine if analysis meets minimum criteria for external API calls
   * This implements the "waterfall" decision logic for the Helios Engine
   */
  static evaluateHeliosEngineResults = (heliosAnalysis) => {
    const {
      veritasScore,
      riskAnalysis,
      incomeStabilityAnalysis,
      nsfAnalysis,
      balanceAnalysis,
      financialSummary
    } = heliosAnalysis;
    
    // Define minimum criteria thresholds
    const minCriteria = {
      veritasScore: 600,        // Minimum Veritas Score
      averageBalance: 5000,     // Minimum average daily balance
      maxNsfCount: 3,           // Maximum NSF violations
      minStabilityScore: 60,    // Minimum income stability score
      minNetIncome: 1000        // Minimum net income flow
    };
    
    // Evaluate each criterion
    const evaluation = {
      veritasScorePassed: veritasScore.score >= minCriteria.veritasScore,
      balancePassed: balanceAnalysis.averageDailyBalance >= minCriteria.averageBalance,
      nsfPassed: nsfAnalysis.nsfCount <= minCriteria.maxNsfCount,
      stabilityPassed: incomeStabilityAnalysis.stabilityScore >= minCriteria.minStabilityScore,
      netIncomePassed: financialSummary.netChange >= minCriteria.minNetIncome,
      
      // Overall risk assessment
      lowRisk: riskAnalysis.riskLevel === 'LOW' || riskAnalysis.riskLevel === 'MEDIUM'
    };
    
    // Count passed criteria
    const passedCount = Object.values(evaluation).filter(Boolean).length;
    const totalCriteria = Object.keys(evaluation).length;
    const passRate = passedCount / totalCriteria;
    
    // Decision logic for external API calls
    const shouldCallExternalAPIs = passRate >= 0.67; // At least 67% criteria passed
    
    logger.info(`🎯 Helios Engine Evaluation Results:`, {
      passedCriteria: `${passedCount}/${totalCriteria}`,
      passRate: `${Math.round(passRate * 100)}%`,
      shouldCallExternalAPIs,
      details: evaluation
    });
    
    return {
      passed: shouldCallExternalAPIs,
      score: passRate,
      details: evaluation,
      criteria: minCriteria,
      recommendation: shouldCallExternalAPIs 
        ? 'PROCEED_TO_EXTERNAL_APIS' 
        : 'STOP_AT_INTERNAL_ANALYSIS'
    };
  };
  
  /**
   * Execute external API calls if Helios Engine criteria are met
   */
  static executeExternalApiCalls = async (heliosAnalysis, userContext) => {
    logger.info('🌐 Starting external API waterfall...');
    
    const externalResults = {
      timestamp: new Date(),
      executionOrder: [],
      results: {},
      totalCost: 0,
      success: false
    };
    
    try {
      // Step 1: Business Verification (Middesk) - if business context available
      if (userContext.businessName || userContext.taxId) {
        logger.info('📋 Executing Middesk Business Verification...');
        externalResults.executionOrder.push('middesk');
        
        const businessData = {
          businessName: userContext.businessName,
          taxId: userContext.taxId,
          address: userContext.address
        };
        
        const middeskResult = await mockMiddeskService.businessVerification(businessData);
        externalResults.results.middesk = {
          ...middeskResult,
          cost: 25.00,
          executedAt: new Date()
        };
        externalResults.totalCost += 25.00;
        
        logger.info(`✅ Middesk verification completed: ${middeskResult.verified ? 'VERIFIED' : 'NOT_VERIFIED'}`);
      }
      
      // Step 2: Credit Check (iSoftpull) - if personal data available and business verification passed
      const businessVerified = externalResults.results.middesk?.verified !== false;
      if (businessVerified && (userContext.ssn || userContext.personalInfo)) {
        logger.info('💳 Executing iSoftpull Credit Check...');
        externalResults.executionOrder.push('isoftpull');
        
        const personalData = {
          ssn: userContext.ssn,
          firstName: userContext.firstName,
          lastName: userContext.lastName,
          address: userContext.address
        };
        
        const creditResult = await mockiSoftpullService.creditCheck(personalData);
        externalResults.results.isoftpull = {
          ...creditResult,
          cost: 15.00,
          executedAt: new Date()
        };
        externalResults.totalCost += 15.00;
        
        logger.info(`✅ iSoftpull credit check completed: Score ${creditResult.creditScore}, Grade ${creditResult.riskGrade}`);
      }
      
      externalResults.success = true;
      logger.info(`🎉 External API waterfall completed successfully. Total cost: $${externalResults.totalCost}`);
      
    } catch (error) {
      logger.error('❌ External API waterfall failed:', error);
      externalResults.error = error.message;
      externalResults.success = false;
    }
    
    return externalResults;
  };
  
  /**
   * Combine Helios Engine and External API results into final analysis
   */
  static generateFinalAnalysis = (heliosAnalysis, externalResults, evaluation) => {
    const finalAnalysis = {
      ...heliosAnalysis,
      
      // Enhanced analysis with external data
      enhancedVerification: {
        heliosEngine: {
          score: evaluation.score,
          passed: evaluation.passed,
          recommendation: evaluation.recommendation,
          details: evaluation.details
        },
        
        externalApis: externalResults.success ? {
          executed: true,
          totalCost: externalResults.totalCost,
          executionOrder: externalResults.executionOrder,
          results: externalResults.results
        } : {
          executed: false,
          reason: externalResults.error || 'Helios Engine criteria not met',
          costSaved: 40.00 // Estimated cost of full external verification
        }
      },
      
      // Final risk assessment combining all sources
      finalRiskAssessment: StatementController.calculateFinalRiskAssessment(heliosAnalysis, externalResults, evaluation)
    };
    
    return finalAnalysis;
  };
  
  /**
   * Calculate final risk assessment combining internal and external results
   */
  static calculateFinalRiskAssessment = (heliosAnalysis, externalResults, evaluation) => {
    let finalScore = heliosAnalysis.veritasScore.score;
    let riskAdjustments = [];
    
    // Apply adjustments based on external verification
    if (externalResults.success && externalResults.results.middesk) {
      const businessResult = externalResults.results.middesk;
      if (businessResult.verified && businessResult.verificationScore > 0.9) {
        finalScore += 50;
        riskAdjustments.push('Business verification positive (+50)');
      } else if (!businessResult.verified) {
        finalScore -= 100;
        riskAdjustments.push('Business verification failed (-100)');
      }
    }
    
    if (externalResults.success && externalResults.results.isoftpull) {
      const creditResult = externalResults.results.isoftpull;
      if (creditResult.creditScore >= 720) {
        finalScore += 75;
        riskAdjustments.push('Excellent credit score (+75)');
      } else if (creditResult.creditScore >= 650) {
        finalScore += 25;
        riskAdjustments.push('Good credit score (+25)');
      } else if (creditResult.creditScore < 600) {
        finalScore -= 50;
        riskAdjustments.push('Poor credit score (-50)');
      }
    }
    
    // Ensure score stays within bounds
    finalScore = Math.max(300, Math.min(850, finalScore));
    
    // Determine final grade
    let finalGrade;
    if (finalScore >= 750) finalGrade = 'A+';
    else if (finalScore >= 700) finalGrade = 'A';
    else if (finalScore >= 650) finalGrade = 'B+';
    else if (finalScore >= 600) finalGrade = 'B';
    else if (finalScore >= 550) finalGrade = 'C+';
    else if (finalScore >= 500) finalGrade = 'C';
    else finalGrade = 'D';
    
    return {
      finalScore,
      finalGrade,
      originalHeliosScore: heliosAnalysis.veritasScore.score,
      adjustments: riskAdjustments,
      methodology: 'Helios Engine + External API Waterfall',
      confidence: externalResults.success ? 'HIGH' : 'MEDIUM'
    };
  };

  /**
   * Upload and analyze a bank statement with waterfall analysis workflow
   * 
   * Waterfall Steps:
   * 1. Receive uploaded PDF file
   * 2. Parse PDF using pdfParserService.extractTransactions()
   * 3. Run Helios Engine internal analysis (Risk + Income + Veritas Score)
   * 4. Evaluate if results meet minimum criteria for external APIs
   * 5. If criteria met, call expensive external APIs (Middesk, iSoftpull)
   * 6. Combine internal and external results for final analysis
   * 7. Save complete analysis to database and return response
   */
  static uploadStatement = async (req, res, next) => {
    let fileId = null;
    
    try {
      // Debug logging
      console.log('📝 DEBUG - Upload request received');
      console.log('📝 DEBUG - req.file:', req.file ? 'EXISTS' : 'MISSING');
      console.log('📝 DEBUG - req.body:', req.body);
      console.log('📝 DEBUG - req.user:', req.user);
      
      // Step 1: Receive the uploaded PDF file
      if (!req.file) {
        console.log('📝 DEBUG - No file found, returning 400');
        return res.status(400).json({ 
          success: false, 
          error: 'No PDF file uploaded' 
        });
      }

      // Get user ID and optional parameters
      const userId = req.user?.id || 'anonymous';
      const openingBalance = parseFloat(req.body.openingBalance) || 0;
      
      logger.info(`🚀 Starting end-to-end statement analysis for user: ${userId}, file: ${req.file.originalname}`);
      
      // Log file upload attempt
      mockComplianceLogger.logFileAccess(userId, 'UPLOAD_ATTEMPT', {
        filename: hashForLogging(req.file.originalname),
        size: req.file.size
      });

      // Get file buffer (direct from multer or through secure processing)
      let buffer;
      if (req.file.buffer) {
        buffer = req.file.buffer;
        logger.info('✅ Using direct file buffer');
      } else {
        // Fallback to secure file processing if needed
        logger.info('🔒 Using secure file processing');
        const { fileId: processedFileId, sessionKey } = await mockSecureFileProcessor.processFile(req.file, userId);
        fileId = processedFileId;
        buffer = await mockSecureFileProcessor.retrieveFile(fileId, sessionKey) || req.file.buffer;
      }

      // Step 2: Enhanced PDF Parsing with comprehensive transaction extraction
      logger.info('📄 Step 2: Enhanced PDF Parsing with pdfParserService...');
      const parserService = await initializePDFParserService();
      const parseResult = await parserService.parseStatement(buffer);
      
      if (!parseResult.success || !parseResult.transactions || parseResult.transactions.length === 0) {
        throw new Error('No transactions found in the PDF. Please ensure this is a valid bank statement.');
      }
      
      const transactions = parseResult.transactions;
      const statementMetadata = parseResult.metadata;
      const statementSummary = parseResult.summary;
      
      logger.info(`✅ Enhanced PDFParserService extracted ${transactions.length} transactions`);
      logger.info(`📊 Statement metadata: ${statementMetadata.bankName}, Account: ${statementMetadata.accountNumber}`);

      // Step 2.5: Intelligent Transaction Categorization with Hybrid AI Caching
      logger.info('🤖 Step 2.5: Intelligent Transaction Categorization...');
      const categorizedTransactions = await llmCategorizationService.categorizeTransactions(transactions, {
        enableLLM: req.body.enableLLM !== false, // Enable LLM by default
        confidenceThreshold: 0.85,
        costOptimization: true
      });
      
      // Log categorization analytics
      const categorizationStats = {
        total: categorizedTransactions.length,
        llmCalls: categorizedTransactions.filter(t => t.method === 'llm').length,
        cacheHits: categorizedTransactions.filter(t => t.method === 'cache').length,
        rulesBased: categorizedTransactions.filter(t => t.method === 'rules').length,
        totalCostSavings: categorizedTransactions.reduce((sum, t) => sum + (t.costSavings || 0), 0)
      };
      
      logger.info('✅ Intelligent categorization completed:', categorizationStats);

      // Step 3: Enhanced Helios Engine Internal Analysis with Veritas Score
      logger.info('🔥 Step 3: Enhanced Helios Engine Analysis with Veritas Score...');
      
      // Use enhanced risk analysis service for comprehensive financial analysis
      const comprehensiveRiskAnalysis = await riskAnalysisService.analyzeFinancialRisk(
        categorizedTransactions, 
        statementMetadata, 
        { includeVeritasScore: true }
      );
      
      // Legacy compatibility - extract individual components
      const riskAnalysis = {
        riskScore: comprehensiveRiskAnalysis.veritasScore.overall / 85, // Convert back to 0-10 scale
        riskLevel: comprehensiveRiskAnalysis.summary.riskCategory,
        riskFactors: comprehensiveRiskAnalysis.riskFactors
      };
      
      const depositsAndWithdrawals = riskAnalysisService.calculateTotalDepositsAndWithdrawals(categorizedTransactions);
      const nsfAnalysis = comprehensiveRiskAnalysis.riskIndicators.nsf;
      const incomeStabilityAnalysis = incomeStabilityService.analyze(categorizedTransactions);
      
      // Enhanced analysis results with Veritas Score
      const analysisResults = {
        veritasScore: comprehensiveRiskAnalysis.veritasScore,
        comprehensiveAnalysis: comprehensiveRiskAnalysis,
        riskAnalysis: riskAnalysis,
        incomeStability: incomeStabilityAnalysis,
        depositsAndWithdrawals: depositsAndWithdrawals,
        nsfAnalysis: nsfAnalysis,
        balanceAnalysis: comprehensiveRiskAnalysis.liquidityAnalysis,
        categorizationStats: categorizationStats,
        statementMetadata: statementMetadata,
        transactionSummary: {
          totalTransactions: categorizedTransactions.length,
          creditTransactions: categorizedTransactions.filter(t => t.amount > 0).length,
          debitTransactions: categorizedTransactions.filter(t => t.amount < 0).length,
          dateRange: getDateRange(categorizedTransactions),
          categorization: categorizationStats
        }
      };
      
      logger.info(`✅ Enhanced Helios Engine Analysis completed. Veritas Score: ${comprehensiveRiskAnalysis.veritasScore.overall}`);
      
      // Step 4: ENHANCED WATERFALL ANALYSIS - Phase 1: Run Helios Engine Analysis
      logger.info('🚀 Step 4: Starting Enhanced Waterfall Analysis - Phase 1: Helios Engine');
      const heliosResult = await StatementController.runHeliosEngineAnalysis(statementMetadata, categorizedTransactions, openingBalance);
      
      if (!heliosResult.success) {
        logger.error('❌ Helios Engine analysis failed:', heliosResult.error);
        return res.status(500).json({
          success: false,
          error: 'Helios Engine analysis failed',
          details: heliosResult.error
        });
      }
      
      const heliosAnalysis = heliosResult.data;
      logger.info(`🔥 Helios Engine completed: Veritas Score ${heliosAnalysis.veritasScore.overall}, Risk Level ${heliosAnalysis.riskAnalysis.riskLevel}`);

      // Step 5: ENHANCED WATERFALL ANALYSIS - Phase 2: Evaluate Criteria
      logger.info('⚖️ Step 5: Enhanced Waterfall Analysis - Phase 2: Criteria Evaluation');
      const evaluation = await StatementController.evaluateWaterfallCriteria(heliosAnalysis);
      
      // Step 6: ENHANCED WATERFALL ANALYSIS - Phase 3: Conditional External APIs
      logger.info('💰 Step 6: Enhanced Waterfall Analysis - Phase 3: Conditional External APIs');
      
      // Extract user context for external APIs (from request body or user profile)
      const userContext = {
        businessName: req.body.businessName || req.user?.businessName,
        taxId: req.body.taxId || req.user?.taxId,
        address: req.body.address || req.user?.address,
        ssn: req.body.ssn || req.user?.ssn,
        firstName: req.body.firstName || req.user?.firstName,
        lastName: req.body.lastName || req.user?.lastName
      };
      
      let externalResults;
      if (evaluation.shouldProceed) {
        logger.info('✅ Waterfall criteria met - proceeding with external API calls...', {
          criteriaScore: evaluation.criteriaScore,
          apiPlan: evaluation.apiPlan
        });
        externalResults = await StatementController.executeConditionalExternalApis(heliosAnalysis, userContext, evaluation.apiPlan);
      } else {
        logger.info('⏹️ Waterfall criteria not met - skipping expensive external APIs', {
          reason: evaluation.reason,
          costSaved: evaluation.costSaved
        });
        externalResults = {
          success: true,
          executed: false,
          reason: evaluation.reason,
          results: { middesk: null, isoftpull: null, sos: null, errors: [], totalCost: 0 },
          metadata: {
            phase: 'external_apis_skipped',
            duration: 0,
            totalCost: 0,
            timestamp: new Date()
          }
        };
      }

      // Step 7: ENHANCED WATERFALL ANALYSIS - Phase 4: Result Consolidation
      logger.info('🔄 Step 7: Enhanced Waterfall Analysis - Phase 4: Result Consolidation');
      const completeAnalysis = StatementController.consolidateWaterfallResults(heliosAnalysis, externalResults, evaluation);
      
      
      // Add enhanced analysis metadata
      completeAnalysis.analysisMetadata = {
        analysisDate: new Date(),
        methodology: 'Enhanced Helios Engine + Conditional External API Waterfall',
        waterfallPhases: ['helios_engine', 'criteria_evaluation', 'conditional_external_apis', 'result_consolidation'],
        servicesUsed: ['pdfParserService', 'riskAnalysisService', 'incomeStabilityService'],
        externalServicesExecuted: externalResults.results?.executionOrder || [],
        transactionCount: transactions.length,
        fileInfo: {
          originalName: req.file.originalname,
          size: req.file.size,
          uploadDate: new Date()
        },
        costAnalysis: {
          heliosEngineCost: 0, // Internal analysis is free
          externalApiCost: externalResults.results?.totalCost || 0,
          costSaved: evaluation.costSaved || 0,
          totalPotentialCost: WATERFALL_CRITERIA.apiCosts.middesk + WATERFALL_CRITERIA.apiCosts.isoftpull + WATERFALL_CRITERIA.apiCosts.sos,
          budgetUtilization: ((externalResults.results?.totalCost || 0) / WATERFALL_CRITERIA.maxPerAnalysisBudget * 100).toFixed(1) + '%'
        },
        performanceMetrics: completeAnalysis.waterfallAnalysis?.processingTime || {}
      };

      logger.info('💾 Step 8: Saving enhanced waterfall analysis to database...');
      
      const statementData = {
        userId: new mongoose.Types.ObjectId(userId),
        fileName: req.file.originalname,
        uploadDate: new Date(),
        processedDate: new Date(),
        statementDate: StatementController.extractStatementDate(transactions),
        status: 'processed',
        
        // Complete enhanced waterfall analysis data
        analysis: completeAnalysis,
        
        // Transaction data (sanitized)
        transactions: transactions.map(t => sanitizeTransaction(t)),
        transactionCount: transactions.length,
        
        // Enhanced summary metrics for quick access
        summary: {
          // Final enhanced scores from waterfall analysis
          veritasScore: completeAnalysis.executiveSummary.finalVeritasScore,
          veritasGrade: completeAnalysis.executiveSummary.finalGrade,
          originalScore: completeAnalysis.heliosEngine.veritasScore.score,
          scoreImprovement: completeAnalysis.executiveSummary.scoreImprovement,
          
          // Core financial metrics from Helios Engine
          riskLevel: completeAnalysis.heliosEngine.riskAnalysis.riskLevel,
          riskScore: completeAnalysis.heliosEngine.riskAnalysis.riskScore,
          stabilityScore: completeAnalysis.heliosEngine.incomeStabilityAnalysis.stabilityScore,
          stabilityLevel: completeAnalysis.heliosEngine.incomeStabilityAnalysis.stabilityLevel,
          totalDeposits: completeAnalysis.heliosEngine.financialSummary.totalDeposits,
          totalWithdrawals: completeAnalysis.heliosEngine.financialSummary.totalWithdrawals,
          netChange: completeAnalysis.heliosEngine.financialSummary.netChange,
          nsfCount: completeAnalysis.heliosEngine.nsfAnalysis.nsfCount,
          averageDailyBalance: completeAnalysis.heliosEngine.balanceAnalysis.averageDailyBalance,
          
          // Enhanced waterfall metrics
          analysisType: completeAnalysis.executiveSummary.analysisType,
          confidence: completeAnalysis.executiveSummary.confidence,
          recommendation: completeAnalysis.executiveSummary.recommendation,
          criteriaScore: evaluation.criteriaScore,
          criteriasPassed: evaluation.passedChecks,
          totalCriterias: evaluation.totalChecks,
          externalApisExecuted: externalResults.executed,
          servicesUsed: externalResults.results?.executionOrder || [],
          totalAnalysisCost: externalResults.results?.totalCost || 0,
          costSaved: evaluation.costSaved || 0,
          budgetUtilization: completeAnalysis.analysisMetadata.costAnalysis.budgetUtilization
        }
      };

      // Create new Statement document
      const statement = new Statement(statementData);
      const savedStatement = await statement.save();
      
      logger.info(`✅ Statement saved to database with ID: ${savedStatement._id}`);

      // Store in memory cache as well
      statements.set(savedStatement._id.toString(), {
        id: savedStatement._id.toString(),
        filename: hashForLogging(req.file.originalname),
        uploadDate: savedStatement.uploadDate,
        analysis: completeAnalysis,
        summary: statementData.summary,
        transactionCount: transactions.length,
        userId: hashForLogging(userId)
      });

      // Log successful processing
      mockComplianceLogger.logDataProcessing(userId, 'COMPLETE_STATEMENT_ANALYSIS', true);
      
      // REDIS STREAMS INTEGRATION: Queue statement for async processing
      try {
        // Initialize Redis Streams connection if not already connected
        if (!redisStreamService.isConnected) {
          await redisStreamService.connect();
        }

        // Queue the uploaded statement for processing through Redis Streams
        await redisStreamService.addToStream(
          redisStreamService.streams.STATEMENT_PROCESSING,
          {
            type: 'PROCESS_UPLOADED_STATEMENT',
            payload: {
              statementId: savedStatement._id.toString(),
              filePath: req.file.path || 'buffer', // File path or buffer indicator
              userId: userId,
              uploadMetadata: {
                originalName: req.file.originalname,
                fileSize: req.file.size,
                mimetype: req.file.mimetype,
                openingBalance: openingBalance,
                uploadDate: new Date()
              }
            },
            correlationId: `upload-${savedStatement._id}-${Date.now()}`
          }
        );

        // Also queue for AI categorization with cache integration
        await redisStreamService.addToStream(
          redisStreamService.streams.TRANSACTION_CATEGORIZATION,
          {
            type: 'CATEGORIZE_STATEMENT_TRANSACTIONS',
            payload: {
              statementId: savedStatement._id.toString(),
              userId: userId,
              nextStage: 'ANALYSIS' // Queue for risk analysis after categorization
            },
            correlationId: `categorize-${savedStatement._id}-${Date.now()}`
          }
        );

        logger.info(`🚀 Statement ${savedStatement._id} queued for Redis Streams processing`);
        
      } catch (streamError) {
        logger.warn('Redis Streams integration failed, continuing without async processing:', streamError.message);
        
        // Fallback: Stream transactions to mock Redis for backward compatibility
        try {
          await StatementController.streamTransactions(transactions, savedStatement._id.toString());
        } catch (fallbackError) {
          logger.warn('Fallback streaming also failed:', fallbackError.message);
        }
      }
      
      // Clean up file if processed through secure processor
      if (fileId) {
        mockSecureFileProcessor.deleteFile(fileId);
      }
      
      // Step 9: Return 201 Created response with enhanced waterfall analysis results
      logger.info('🎉 Step 9: Returning enhanced waterfall analysis response');
      
      res.status(201).json({
        success: true,
        message: 'Statement processed with Enhanced Helios Engine + Conditional External API Waterfall successfully',
        data: {
          id: savedStatement._id,
          uploadDate: savedStatement.uploadDate,
          processedDate: savedStatement.processedDate,
          status: savedStatement.status,
          
          // Complete enhanced waterfall analysis object
          analysis: completeAnalysis,
          
          // Enhanced summary for dashboard
          summary: statementData.summary,
          
          // Enhanced waterfall execution details
          waterfallResults: {
            methodology: 'Enhanced Helios Engine + Conditional External API Waterfall',
            phasesExecuted: 4,
            
            phase1_heliosEngine: {
              status: 'success',
              score: completeAnalysis.heliosEngine.veritasScore.score,
              grade: completeAnalysis.heliosEngine.veritasScore.grade,
              riskLevel: completeAnalysis.heliosEngine.riskAnalysis.riskLevel,
              transactionsAnalyzed: transactions.length,
              cost: 0,
              duration: completeAnalysis.heliosEngine.waterfallMetadata?.duration || 0
            },
            
            phase2_criteriaEvaluation: {
              status: 'success',
              criteriaScore: evaluation.criteriaScore,
              passedChecks: evaluation.passedChecks,
              totalChecks: evaluation.totalChecks,
              shouldProceed: evaluation.shouldProceed,
              reason: evaluation.reason,
              apiPlan: evaluation.apiPlan,
              budgetCheck: evaluation.budgetCheck,
              duration: evaluation.metadata?.duration || 0
            },
            
            phase3_externalApis: {
              status: externalResults.executed ? 'executed' : 'skipped',
              executed: externalResults.executed,
              reason: externalResults.executed ? 'Criteria met - APIs executed' : evaluation.reason,
              servicesExecuted: externalResults.results?.executionOrder || [],
              totalCost: externalResults.results?.totalCost || 0,
              costSaved: evaluation.costSaved || 0,
              duration: externalResults.metadata?.duration || 0,
              results: {
                middesk: externalResults.results?.middesk,
                isoftpull: externalResults.results?.isoftpull,
                sos: externalResults.results?.sos
              },
              errors: externalResults.results?.errors || []
            },
            
            phase4_consolidation: {
              status: 'success',
              finalScore: completeAnalysis.executiveSummary.finalVeritasScore,
              finalGrade: completeAnalysis.executiveSummary.finalGrade,
              scoreImprovement: completeAnalysis.executiveSummary.scoreImprovement,
              confidence: completeAnalysis.executiveSummary.confidence,
              recommendation: completeAnalysis.executiveSummary.recommendation,
              duration: completeAnalysis.waterfallAnalysis?.processingTime?.consolidation || 0
            },
            
            totalProcessingTime: completeAnalysis.waterfallAnalysis?.processingTime?.total || 0,
            costAnalysis: {
              totalCost: externalResults.results?.totalCost || 0,
              costSaved: evaluation.costSaved || 0,
              budgetUtilization: completeAnalysis.analysisMetadata.costAnalysis.budgetUtilization,
              potentialMaxCost: completeAnalysis.analysisMetadata.costAnalysis.totalPotentialCost
            }
          },
          
          // Executive summary for quick decision making
          executiveSummary: completeAnalysis.executiveSummary,
          
          // Legacy service results for backward compatibility
          serviceResults: {
            pdfParserService: { 
              status: 'success', 
              transactionsExtracted: transactions.length 
            },
            heliosEngine: { 
              status: 'success', 
              riskScore: completeAnalysis.heliosEngine.riskAnalysis.riskScore,
              riskLevel: completeAnalysis.heliosEngine.riskAnalysis.riskLevel,
              stabilityScore: completeAnalysis.heliosEngine.incomeStabilityAnalysis.stabilityScore,
              veritasScore: completeAnalysis.heliosEngine.veritasScore.score,
              criteriaEvaluationPassed: evaluation.shouldProceed
            },
            riskAnalysisService: { 
              status: 'success', 
              riskScore: completeAnalysis.heliosEngine.riskAnalysis.riskScore,
              riskLevel: completeAnalysis.heliosEngine.riskAnalysis.riskLevel
            },
            incomeStabilityService: { 
              status: 'success', 
              stabilityScore: completeAnalysis.heliosEngine.incomeStabilityAnalysis.stabilityScore,
              stabilityLevel: completeAnalysis.heliosEngine.incomeStabilityAnalysis.stabilityLevel
            },
            veritasScoreCalculation: {
              status: 'success',
              originalScore: completeAnalysis.heliosEngine.veritasScore.score,
              enhancedScore: completeAnalysis.executiveSummary.finalVeritasScore,
              grade: completeAnalysis.executiveSummary.finalGrade
            },
            externalServices: externalResults.executed ? {
              middesk: externalResults.results.middesk ? 'success' : 'not_executed',
              isoftpull: externalResults.results.isoftpull ? 'success' : 'not_executed'
            } : {
              middesk: 'skipped',
              isoftpull: 'skipped'
            }
          },
          
          processingNote: `Waterfall analysis completed - Helios Engine ${evaluation.passed ? 'passed' : 'failed'} criteria, External APIs ${externalResults.executed ? 'executed' : 'skipped'}`
        }
      });
      
    } catch (error) {
      // Cleanup on error
      if (fileId) {
        mockSecureFileProcessor.deleteFile(fileId);
      }
      
      // Log failed processing
      mockComplianceLogger.logDataProcessing(req.user?.id || 'anonymous', 'COMPLETE_STATEMENT_ANALYSIS', false);
      
      logger.error('🚨 End-to-end statement analysis failed:', error);
      
      // Return detailed error information
      res.status(500).json({
        success: false,
        error: 'Failed to process and analyze statement',
        details: error.message,
        serviceStatus: {
          pdfParserService: error.message.includes('extract transactions') ? 'failed' : 'not_attempted',
          riskAnalysisService: error.message.includes('risk analysis') ? 'failed' : 'not_attempted',
          incomeStabilityService: error.message.includes('income stability') ? 'failed' : 'not_attempted',
          veritasScoreCalculation: error.message.includes('Veritas') ? 'failed' : 'not_attempted',
          databaseSave: error.message.includes('save') || error.message.includes('database') ? 'failed' : 'not_attempted'
        }
      });
    }
  };

  // Utility method to get date range from transactions
  static getDateRange = (transactions) => {
    if (transactions.length === 0) {
      return { startDate: null, endDate: null, daysCovered: 0 };
    }
    
    const dates = transactions.map(t => new Date(t.date)).sort((a, b) => a - b);
    const startDate = dates[0].toISOString().split('T')[0];
    const endDate = dates[dates.length - 1].toISOString().split('T')[0];
    const daysCovered = Math.ceil((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24)) + 1;
    
    return { startDate, endDate, daysCovered };
  };

  // Utility method to extract statement date from transactions
  static extractStatementDate = (transactions) => {
    if (transactions.length === 0) {
      return new Date();
    }
    
    // Use the latest transaction date as the statement date
    const latestDate = transactions
      .map(t => new Date(t.date))
      .sort((a, b) => b - a)[0];
    
    return latestDate || new Date();
  };

  // Stream transactions to Redis (with fallback)
  static streamTransactions = async (transactions, statementId) => {
    try {
      const streamPromises = transactions.map(transaction => 
        mockRedisStream.addTransaction({
          ...transaction,
          statementId,
          id: `${statementId}_${transaction.date}_${Math.random()}`
        })
      );
      
      const results = await Promise.all(streamPromises);
      logger.info(`Streamed ${results.length} transactions for statement ${statementId}`);
      return results;
    } catch (error) {
      logger.warn('Redis streaming failed, continuing without streaming:', error.message);
      return [];
    }
  };

  // Get all statements
  static listStatements = async (req, res, next) => {
    try {
      // Query database for user's statements
      const userId = req.user?.id;
      const statements = await Statement.find({ userId })
        .select('_id fileName uploadDate processedDate status summary transactionCount')
        .sort({ uploadDate: -1 });
      
      const statementList = statements.map(s => ({
        id: s._id,
        fileName: s.fileName,
        uploadDate: s.uploadDate,
        processedDate: s.processedDate,
        status: s.status,
        transactionCount: s.transactionCount,
        veritasScore: s.summary?.veritasScore,
        veritasGrade: s.summary?.veritasGrade,
        riskLevel: s.summary?.riskLevel,
        stabilityLevel: s.summary?.stabilityLevel
      }));
      
      res.json({
        success: true,
        count: statementList.length,
        data: statementList
      });
    } catch (error) {
      logger.error('Error listing statements:', error);
      next(error);
    }
  };

  // Get a specific statement by ID with complete analysis
  static getStatementById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      // Validate MongoDB ObjectId format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid statement ID format' 
        });
      }
      
      // Find statement with user authorization
      const statement = await Statement.findOne({ 
        _id: id, 
        userId: userId 
      });
      
      if (!statement) {
        return res.status(404).json({ 
          success: false, 
          error: 'Statement not found or access denied' 
        });
      }
      
      res.json({
        success: true,
        data: {
          id: statement._id,
          fileName: statement.fileName,
          uploadDate: statement.uploadDate,
          processedDate: statement.processedDate,
          status: statement.status,
          
          // Complete analysis object
          analysis: statement.analysis,
          
          // Summary for quick access
          summary: statement.summary,
          
          // Transaction data
          transactions: statement.transactions,
          transactionCount: statement.transactionCount
        }
      });
    } catch (error) {
      logger.error('Error getting statement by ID:', error);
      next(error);
    }
  };

  // Analyze a statement (legacy method for compatibility)
  getStatementAnalysis = async (req, res, next) => {
    try {
      const { id } = req.params;
      const statement = statements.get(id);
      
      if (!statement) {
        return res.status(404).json({ 
          success: false, 
          error: 'Statement not found' 
        });
      }
      
      const analysis = await analyzeStatement(statement.parsedData);
      
      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      next(error);
    }
  };

  // Search transactions
  searchStatementTransactions = async (req, res, next) => {
    try {
      const { id } = req.params;
      const filters = {
        searchTerm: req.query.q,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount) : undefined,
        type: req.query.type,
        categories: req.query.categories ? req.query.categories.split(',') : undefined,
        sortBy: req.query.sortBy
      };
      
      const statement = statements.get(id);
      if (!statement) {
        return res.status(404).json({ 
          success: false, 
          error: 'Statement not found' 
        });
      }
      
      const searchResults = searchTransactions(statement.parsedData.transactions, filters);
      
      res.json({
        success: true,
        data: searchResults
      });
    } catch (error) {
      next(error);
    }
  };

  // Search transactions method for testing
  static searchTransactions = async (req, res, next) => {
    try {
      const { id } = req.params;
      const filters = {
        searchTerm: req.query.q,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount) : undefined,
        type: req.query.type,
        categories: req.query.categories ? req.query.categories.split(',') : undefined,
        sortBy: req.query.sortBy
      };
      
      // Try to find statement in database
      const statement = await Statement.findById(id);
      if (!statement) {
        return res.status(404).json({ 
          success: false, 
          error: 'Statement not found' 
        });
      }
      
      // Search through transactions
      const transactions = statement.transactions || [];
      let filteredTransactions = transactions;
      
      if (filters.searchTerm) {
        filteredTransactions = filteredTransactions.filter(transaction => 
          transaction.description?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
          transaction.reference?.toLowerCase().includes(filters.searchTerm.toLowerCase())
        );
      }
      
      if (filters.startDate || filters.endDate) {
        filteredTransactions = filteredTransactions.filter(transaction => {
          const transactionDate = new Date(transaction.date);
          if (filters.startDate && transactionDate < new Date(filters.startDate)) return false;
          if (filters.endDate && transactionDate > new Date(filters.endDate)) return false;
          return true;
        });
      }
      
      res.json({
        success: true,
        data: {
          transactions: filteredTransactions,
          total: filteredTransactions.length
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Set budget
  setStatementBudget = async (req, res, next) => {
    try {
      const { id } = req.params;
      const budgetData = req.body;
      
      const statement = statements.get(id);
      if (!statement) {
        return res.status(404).json({ 
          success: false, 
          error: 'Statement not found' 
        });
      }
      
      const budget = setBudget(id, budgetData);
      
      res.json({
        success: true,
        message: 'Budget set successfully',
        data: budget
      });
    } catch (error) {
      next(error);
    }
  };

  // Analyze budget
  analyzeStatementBudget = async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const statement = statements.get(id);
      if (!statement) {
        return res.status(404).json({ 
          success: false, 
          error: 'Statement not found' 
        });
      }
      
      const analysis = await analyzeStatement(statement.parsedData);
      const budgetAnalysis = analyzeBudget(statement, analysis);
      
      res.json(budgetAnalysis);
    } catch (error) {
      next(error);
    }
  };

  // Export statement
  static exportStatement = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { format = 'pdf' } = req.query;
      
      const statement = statements.get(id);
      if (!statement) {
        return res.status(404).json({ 
          success: false, 
          error: 'Statement not found' 
        });
      }
      
      const analysis = await analyzeStatement(statement.parsedData);
      let buffer;
      let contentType;
      let filename;
      
      if (format === 'excel') {
        buffer = await exportToExcel(statement, analysis);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `statement-${id}.xlsx`;
      } else {
        buffer = await exportToPDF(statement, analysis);
        contentType = 'application/pdf';
        filename = `statement-${id}.pdf`;
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  // Get transactions
  getTransactions = async (req, res, next) => {
    try {
      const { id } = req.params;
      const statement = statements.get(id);
      
      if (!statement) {
        return res.status(404).json({ 
          success: false, 
          error: 'Statement not found' 
        });
      }
      
      res.json({
        success: true,
        data: statement.parsedData.transactions
      });
    } catch (error) {
      next(error);
    }
  };

  // Get summary
  getSummary = async (req, res, next) => {
    try {
      const { id } = req.params;
      const statement = statements.get(id);
      
      if (!statement) {
        return res.status(404).json({ 
          success: false, 
          error: 'Statement not found' 
        });
      }
      
      res.json({
        success: true,
        data: statement.summary
      });
    } catch (error) {
      next(error);
    }
  };

  // Get categories
  getCategories = async (req, res, next) => {
    try {
      const { id } = req.params;
      const statement = statements.get(id);
      
      if (!statement) {
        return res.status(404).json({ 
          success: false, 
          error: 'Statement not found' 
        });
      }
      
      const analysis = await analyzeStatement(statement.parsedData);
      
      res.json({
        success: true,
        data: analysis.categoryTotals || {}
      });
    } catch (error) {
      next(error);
    }
  };

  // Get insights
  getInsights = async (req, res, next) => {
    try {
      const { id } = req.params;
      const statement = statements.get(id);
      
      if (!statement) {
        return res.status(404).json({ 
          success: false, 
          error: 'Statement not found' 
        });
      }
      
      const analysis = await analyzeStatement(statement.parsedData);
      
      // Calculate savings rate properly
      const savingsAmount = analysis.totalDeposits - analysis.totalWithdrawals;
      const savingsRate = analysis.totalDeposits > 0 
        ? ((savingsAmount / analysis.totalDeposits) * 100).toFixed(2)
        : '0.00';
      
      res.json({
        success: true,
        data: {
          averageTransactionAmount: analysis.averageTransactionAmount || 0,
          totalTransactions: analysis.totalTransactions || statement.transactionCount,
          savingsRate: `${savingsRate}%`,
          monthlySpending: analysis.totalWithdrawals,
          monthlyIncome: analysis.totalDeposits,
          netSavings: savingsAmount
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Upload and analyze multiple bank statements (up to 4 PDF files) with AlertsEngine integration
   * 
   * Workflow Steps:
   * 1. Receive uploaded PDF files (array)
   * 2. Parse each PDF using PDFParserService.extractTransactions()
   * 3. Analyze each statement to create FinSight Reports
   * 4. Pass array of FinSight Reports to AlertsEngineService.generateAlerts()
   * 5. Save complete analysis to database
   * 6. Return consolidated analysis with alerts
   */
  uploadStatements = async (req, res, next) => {
    let processedFileIds = [];
    
    try {
      // Step 1: Validate uploaded files
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'No PDF files uploaded. Please upload at least one PDF file.' 
        });
      }

      if (req.files.length > 4) {
        return res.status(400).json({ 
          success: false, 
          error: 'Maximum 4 PDF files allowed per upload.' 
        });
      }

      // Get user ID and optional parameters
      const userId = req.user?.id || 'anonymous';
      const openingBalance = parseFloat(req.body.openingBalance) || 0;
      const applicationData = req.body.applicationData ? JSON.parse(req.body.applicationData) : {};
      
      logger.info(`🚀 Starting multi-statement analysis for user: ${userId}, files: ${req.files.length}`);
      req.files.forEach((file, index) => {
        logger.info(`  File ${index + 1}: ${file.originalname} (${file.size} bytes)`);
      });
      
      // Step 2: Process each PDF file and create FinSight Reports
      const finsightReportsArray = [];
      const processingResults = [];

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const fileIndex = i + 1;
        
        logger.info(`📄 Processing file ${fileIndex}/${req.files.length}: ${file.originalname}`);
        
        try {
          // Log file processing attempt
          mockComplianceLogger.logFileAccess(userId, 'PROCESS_ATTEMPT', {
            filename: hashForLogging(file.originalname),
            size: file.size,
            fileIndex: fileIndex
          });

          // Get file buffer
          const buffer = file.buffer;
          
          // Step 2a: Parse PDF to extract transactions
          logger.info(`  📊 Extracting transactions from file ${fileIndex}...`);
          const parserService = await initializePDFParserService();
          const transactions = await parserService.extractTransactions(buffer);
          
          if (!transactions || transactions.length === 0) {
            throw new Error(`No transactions found in file ${fileIndex}: ${file.originalname}`);
          }
          
          logger.info(`  ✅ Extracted ${transactions.length} transactions from file ${fileIndex}`);

          // Step 2b: Analyze risk for this statement
          logger.info(`  🔍 Analyzing risk for file ${fileIndex}...`);
          const riskAnalysis = riskAnalysisService.analyzeRisk(transactions, openingBalance);
          
          // Get additional detailed metrics
          const depositsAndWithdrawals = riskAnalysisService.calculateTotalDepositsAndWithdrawals(transactions);
          const nsfCount = riskAnalysisService.calculateNSFCount(transactions);
          const balanceAnalysis = riskAnalysisService.calculateAverageDailyBalance(transactions, openingBalance);
          
          // Step 2c: Analyze income stability
          logger.info(`  💼 Analyzing income stability for file ${fileIndex}...`);
          const incomeStabilityAnalysis = incomeStabilityService.analyze(transactions);
          
          // Step 2d: Calculate Veritas Score for this statement
          const analysisResults = {
            nsfCount: nsfCount,
            averageBalance: balanceAnalysis.averageDailyBalance,
            riskAnalysis: riskAnalysis,
            incomeStability: incomeStabilityAnalysis,
            depositsAndWithdrawals: depositsAndWithdrawals,
            balanceAnalysis: balanceAnalysis,
            transactionSummary: {
              totalTransactions: transactions.length,
              creditTransactions: transactions.filter(t => t.type === 'credit').length,
              debitTransactions: transactions.filter(t => t.type === 'debit').length,
              dateRange: this.getDateRange(transactions)
            }
          };
          
          const veritasScore = riskAnalysisService.calculateVeritasScore(analysisResults, transactions);
          
          // Step 2e: Create FinSight Report for this statement
          const finsightReport = {
            id: `statement_${fileIndex}`,
            fileName: file.originalname,
            fileSize: file.size,
            processedAt: new Date().toISOString(),
            
            // Core analysis results
            riskAnalysis: {
              ...riskAnalysis,
              nsfCount: nsfCount,
              avgDailyBalance: balanceAnalysis.averageDailyBalance,
              totalDeposits: depositsAndWithdrawals.totalDeposits,
              totalWithdrawals: depositsAndWithdrawals.totalWithdrawals,
              averageBalance: balanceAnalysis.averageDailyBalance,
              minimumBalance: Math.min(...transactions.map(t => t.balance || 0)),
              daysBelow100: 0 // This would need calculation based on daily balances
            },
            
            // Income stability
            incomeStability: incomeStabilityAnalysis,
            
            // Veritas Score
            veritasScore: veritasScore,
            
            // Transaction data
            transactions: transactions,
            transactionSummary: analysisResults.transactionSummary,
            
            // SOS data placeholder (if available from application data)
            sosData: applicationData.sosData || null
          };
          
          finsightReportsArray.push(finsightReport);
          
          processingResults.push({
            fileIndex: fileIndex,
            fileName: file.originalname,
            success: true,
            transactionCount: transactions.length,
            riskScore: riskAnalysis.riskScore,
            veritasScore: veritasScore.score
          });
          
          logger.info(`  ✅ File ${fileIndex} processed successfully: ${transactions.length} transactions, Risk Score: ${riskAnalysis.riskScore}, Veritas Score: ${veritasScore.score}`);
          
        } catch (fileError) {
          logger.error(`❌ Error processing file ${fileIndex} (${file.originalname}):`, fileError);
          
          processingResults.push({
            fileIndex: fileIndex,
            fileName: file.originalname,
            success: false,
            error: fileError.message
          });
          
          // Continue processing other files even if one fails
        }
      }
      
      // Check if any files were successfully processed
      if (finsightReportsArray.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files could be processed successfully',
          processingResults: processingResults
        });
      }
      
      // Step 3: Generate consolidated alerts using AlertsEngineService
      logger.info(`🚨 Step 3: Generating alerts for ${finsightReportsArray.length} FinSight reports...`);
      
      const alerts = AlertsEngineService.generateAlerts(applicationData, finsightReportsArray, applicationData.sosData || {});
      
      logger.info(`✅ Generated ${alerts.length} alerts across all statements`);
      
      // Step 4: Prepare consolidated response
      const consolidatedAnalysis = {
        // Summary statistics
        summary: {
          totalFiles: req.files.length,
          processedFiles: finsightReportsArray.length,
          failedFiles: req.files.length - finsightReportsArray.length,
          totalTransactions: finsightReportsArray.reduce((sum, report) => sum + report.transactions.length, 0),
          totalAlerts: alerts.length,
          alertSummary: {
            critical: alerts.filter(a => a.severity === 'CRITICAL').length,
            high: alerts.filter(a => a.severity === 'HIGH').length,
            medium: alerts.filter(a => a.severity === 'MEDIUM').length,
            low: alerts.filter(a => a.severity === 'LOW').length
          }
        },
        
        // Processing results for each file
        processingResults: processingResults,
        
        // Individual FinSight reports
        finsightReports: finsightReportsArray.map(report => ({
          id: report.id,
          fileName: report.fileName,
          riskScore: report.riskAnalysis.riskScore,
          riskLevel: report.riskAnalysis.riskLevel,
          veritasScore: report.veritasScore.score,
          veritasGrade: report.veritasScore.grade,
          transactionCount: report.transactions.length,
          avgDailyBalance: report.riskAnalysis.avgDailyBalance,
          nsfCount: report.riskAnalysis.nsfCount
        })),
        
        // Consolidated alerts
        alerts: alerts,
        
        // Overall risk assessment
        overallRisk: {
          averageRiskScore: Math.round(finsightReportsArray.reduce((sum, report) => sum + report.riskAnalysis.riskScore, 0) / finsightReportsArray.length),
          averageVeritasScore: Math.round(finsightReportsArray.reduce((sum, report) => sum + report.veritasScore.score, 0) / finsightReportsArray.length * 100) / 100,
          highestRiskScore: Math.max(...finsightReportsArray.map(report => report.riskAnalysis.riskScore)),
          lowestRiskScore: Math.min(...finsightReportsArray.map(report => report.riskAnalysis.riskScore))
        },
        
        // Metadata
        metadata: {
          userId: userId,
          uploadedAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
          version: '2.0.0'
        }
      };
      
      // Step 5: Log compliance and success
      mockComplianceLogger.logDataProcessing(userId, 'MULTI_STATEMENT_ANALYSIS', true);
      
      logger.info(`🎉 Multi-statement analysis completed successfully for user ${userId}`);
      logger.info(`   Files processed: ${finsightReportsArray.length}/${req.files.length}`);
      logger.info(`   Total alerts: ${alerts.length}`);
      logger.info(`   Average risk score: ${consolidatedAnalysis.overallRisk.averageRiskScore}`);
      
      // Step 6: Push critical alerts to Zoho CRM (if configured and dealId provided)
      await pushCriticalAlertsToZoho(alerts, req.body.dealId, userId);
      
      // Return 201 Created with complete consolidated analysis
      res.status(201).json({
        success: true,
        message: `Successfully analyzed ${finsightReportsArray.length} bank statement(s)`,
        data: consolidatedAnalysis
      });
      
    } catch (error) {
      logger.error('❌ Error in multi-statement analysis:', error);
      
      // Cleanup any processed files
      processedFileIds.forEach(fileId => {
        try {
          mockSecureFileProcessor.deleteFile(fileId);
        } catch (cleanupError) {
          logger.warn('Failed to cleanup file:', cleanupError);
        }
      });
      
      // Log compliance failure
      mockComplianceLogger.logDataProcessing(req.user?.id || 'anonymous', 'MULTI_STATEMENT_ANALYSIS', false);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error during multi-statement analysis',
        details: error.message
      });
    }
  };

  // Add missing getStatements method for route compatibility
  static getStatements = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }
      
      // Query database for user's statements
      const statements = await Statement.find({ userId })
        .select('_id fileName uploadDate processedDate status summary transactionCount')
        .sort({ uploadDate: -1 });
      
      const statementList = statements.map(s => ({
        id: s._id,
        fileName: s.fileName,
        uploadDate: s.uploadDate,
        processedDate: s.processedDate,
        status: s.status,
        transactionCount: s.transactionCount,
        veritasScore: s.summary?.veritasScore,
        veritasGrade: s.summary?.veritasGrade,
        riskLevel: s.summary?.riskLevel,
        stabilityLevel: s.summary?.stabilityLevel
      }));
      
      res.json({
        success: true,
        count: statementList.length,
        data: statementList
      });
    } catch (error) {
      logger.error('Error in getStatements:', error);
      next(error);
    }
  };

  // Add missing getStatementsByUser method for route compatibility
  static getStatementsByUser = async (req, res, next) => {
    try {
      const { userId } = req.params;
      
      // Validate that requesting user can access this data
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied - cannot view other user\'s statements'
        });
      }
      
      // Query database for specific user's statements
      const statements = await Statement.find({ userId })
        .select('_id fileName uploadDate processedDate status summary transactionCount')
        .sort({ uploadDate: -1 });
      
      const statementList = statements.map(s => ({
        id: s._id,
        fileName: s.fileName,
        uploadDate: s.uploadDate,
        processedDate: s.processedDate,
        status: s.status,
        transactionCount: s.transactionCount,
        veritasScore: s.summary?.veritasScore,
        veritasGrade: s.summary?.veritasGrade,
        riskLevel: s.summary?.riskLevel,
        stabilityLevel: s.summary?.stabilityLevel
      }));
      
      res.json({
        success: true,
        userId: userId,
        count: statementList.length,
        data: statementList
      });
    } catch (error) {
      logger.error('Error in getStatementsByUser:', error);
      next(error);
    }
  };

  // Add missing getMonthlyStatements method for route compatibility
  static getMonthlyStatements = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const { year, month } = req.query;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }
      
      // Build date filter
      let dateFilter = {};
      if (year && month) {
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0);
        dateFilter = {
          uploadDate: {
            $gte: startDate,
            $lte: endDate
          }
        };
      }
      
      // Query database for user's monthly statements
      const statements = await Statement.find({ 
        userId, 
        ...dateFilter 
      })
        .select('_id fileName uploadDate processedDate status summary transactionCount')
        .sort({ uploadDate: -1 });
      
      const statementList = statements.map(s => ({
        id: s._id,
        fileName: s.fileName,
        uploadDate: s.uploadDate,
        processedDate: s.processedDate,
        status: s.status,
        transactionCount: s.transactionCount,
        veritasScore: s.summary?.veritasScore,
        veritasGrade: s.summary?.veritasGrade,
        riskLevel: s.summary?.riskLevel,
        stabilityLevel: s.summary?.stabilityLevel
      }));
      
      res.json({
        success: true,
        period: year && month ? `${year}-${month.padStart(2, '0')}` : 'all',
        count: statementList.length,
        data: statementList
      });
    } catch (error) {
      logger.error('Error in getMonthlyStatements:', error);
      next(error);
    }
  };

  // Add missing updateStatement method for route compatibility
  static updateStatement = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const updateData = req.body;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }
      
      // Validate MongoDB ObjectId format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid statement ID format' 
        });
      }
      
      // Find and update statement with user authorization
      const statement = await Statement.findOneAndUpdate(
        { _id: id, userId: userId },
        { 
          ...updateData,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      );
      
      if (!statement) {
        return res.status(404).json({ 
          success: false, 
          error: 'Statement not found or access denied' 
        });
      }
      
      res.json({
        success: true,
        message: 'Statement updated successfully',
        data: {
          id: statement._id,
          fileName: statement.fileName,
          uploadDate: statement.uploadDate,
          processedDate: statement.processedDate,
          updatedAt: statement.updatedAt,
          status: statement.status
        }
      });
    } catch (error) {
      logger.error('Error updating statement:', error);
      next(error);
    }
  };

  // Add missing deleteStatement method for route compatibility
  static deleteStatement = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }
      
      // Validate MongoDB ObjectId format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid statement ID format' 
        });
      }
      
      // Find and delete statement with user authorization
      const statement = await Statement.findOneAndDelete({ 
        _id: id, 
        userId: userId 
      });
      
      if (!statement) {
        return res.status(404).json({ 
          success: false, 
          error: 'Statement not found or access denied' 
        });
      }
      
      // Log successful deletion
      logger.info(`Statement ${id} deleted by user ${userId}`);
      
      res.json({
        success: true,
        message: 'Statement deleted successfully',
        data: {
          id: statement._id,
          fileName: statement.fileName,
          deletedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Error deleting statement:', error);
      next(error);
    }
  };

  // ============================================================================
  // COMPREHENSIVE CRUD OPERATIONS
  // ============================================================================

  /**
   * Create a new statement
   * POST /api/statements
   */
  static createStatement = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const { 
        accountNumber, 
        bankName, 
        statementPeriod, 
        openingBalance, 
        closingBalance,
        statementDate 
      } = req.body;

      // Validate required fields
      if (!accountNumber || !bankName || !statementPeriod) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: accountNumber, bankName, statementPeriod'
        });
      }

      // Create new statement
      const statement = await Statement.create({
        userId: new mongoose.Types.ObjectId(userId),
        accountNumber,
        bankName,
        statementPeriod,
        openingBalance: openingBalance || 0,
        closingBalance: closingBalance || 0,
        statementDate: statementDate ? new Date(statementDate) : new Date(),
        status: 'created',
        uploadId: `manual_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
      });

      logger.info('Statement created manually', { statementId: statement._id, userId });

      res.status(201).json({
        success: true,
        data: { statement },
        message: 'Statement created successfully'
      });

    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: Object.values(error.errors).map(e => e.message)
        });
      }
      
      logger.error('Error creating statement:', error);
      next(error);
    }
  };

  /**
   * Update an existing statement
   * PUT /api/statements/:id
   */
  static updateStatement = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid statement ID format'
        });
      }

      const updateData = req.body;
      delete updateData._id; // Remove _id from update data
      delete updateData.userId; // Prevent userId modification

      const statement = await Statement.findOneAndUpdate(
        { 
          _id: id, 
          userId: new mongoose.Types.ObjectId(userId) 
        },
        { 
          ...updateData,
          updatedAt: new Date()
        },
        { 
          new: true, 
          runValidators: true 
        }
      );

      if (!statement) {
        return res.status(404).json({
          success: false,
          error: 'Statement not found or access denied'
        });
      }

      logger.info('Statement updated', { statementId: id, userId });

      res.status(200).json({
        success: true,
        data: { statement },
        message: 'Statement updated successfully'
      });

    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: Object.values(error.errors).map(e => e.message)
        });
      }

      logger.error('Error updating statement:', error);
      next(error);
    }
  };

  // ============================================================================
  // ANALYTICS ENDPOINTS
  // ============================================================================

  /**
   * Get comprehensive analytics for a statement
   * GET /api/statements/:id/analytics
   */
  static getAnalytics = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid statement ID format'
        });
      }

      // Find statement
      const statement = await Statement.findOne({
        _id: id,
        userId: new mongoose.Types.ObjectId(userId)
      });

      if (!statement) {
        return res.status(404).json({
          success: false,
          error: 'Statement not found'
        });
      }

      // Get transactions for analysis
      const transactions = await Transaction.find({ 
        statementId: statement._id 
      }).sort({ date: 1 });

      // Perform comprehensive analytics
      const analytics = {
        summary: {
          totalTransactions: transactions.length,
          openingBalance: statement.openingBalance || 0,
          closingBalance: statement.closingBalance || 0,
          netChange: (statement.closingBalance || 0) - (statement.openingBalance || 0),
          statementPeriod: statement.statementPeriod,
          accountNumber: statement.accountNumber,
          bankName: statement.bankName
        },
        
        transactionAnalysis: {
          totalCredits: transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
          totalDebits: Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)),
          averageTransaction: transactions.length > 0 ? 
            transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / transactions.length : 0,
          largestCredit: Math.max(...transactions.filter(t => t.amount > 0).map(t => t.amount), 0),
          largestDebit: Math.max(...transactions.filter(t => t.amount < 0).map(t => Math.abs(t.amount)), 0)
        },

        categoryBreakdown: this._analyzeTransactionCategories(transactions),
        
        cashFlowAnalysis: this._analyzeCashFlow(transactions),
        
        riskMetrics: this._calculateRiskMetrics(statement, transactions),
        
        incomeStability: this._analyzeIncomeStability(transactions),
        
        generatedAt: new Date()
      };

      // Store analytics in statement for caching
      await Statement.findByIdAndUpdate(statement._id, {
        analytics: analytics,
        lastAnalyticsAt: new Date()
      });

      res.status(200).json({
        success: true,
        data: { analytics, statement: { id: statement._id, fileName: statement.fileName } }
      });

    } catch (error) {
      logger.error('Error generating analytics:', error);
      next(error);
    }
  };

  /**
   * Categorize transactions using AI
   * POST /api/statements/:id/categorize
   */
  static categorizeTransactions = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { recategorize = false } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid statement ID format'
        });
      }

      const statement = await Statement.findOne({
        _id: id,
        userId: new mongoose.Types.ObjectId(userId)
      });

      if (!statement) {
        return res.status(404).json({
          success: false,
          error: 'Statement not found'
        });
      }

      // Get transactions
      const transactions = await Transaction.find({ 
        statementId: statement._id 
      });

      if (transactions.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No transactions found for categorization'
        });
      }

      // Filter transactions that need categorization
      const uncategorized = recategorize ? 
        transactions : 
        transactions.filter(t => !t.category || t.category === 'Uncategorized');

      if (uncategorized.length === 0) {
        return res.status(200).json({
          success: true,
          data: { 
            message: 'All transactions are already categorized',
            categorizedCount: 0,
            totalTransactions: transactions.length
          }
        });
      }

      // Initialize Perplexity service for AI categorization
      const perplexityService = new PerplexityService();
      let categorizedCount = 0;

      // Process transactions in batches
      const batchSize = 10;
      for (let i = 0; i < uncategorized.length; i += batchSize) {
        const batch = uncategorized.slice(i, i + batchSize);
        
        try {
          // Prepare transaction descriptions for analysis
          const descriptions = batch.map(t => ({
            id: t._id,
            description: t.description,
            amount: t.amount,
            date: t.date
          }));

          const analysisText = `Categorize these financial transactions:
            ${descriptions.map(d => `${d.description} - $${Math.abs(d.amount)}`).join('\n')}
            
            Return categories from: Income, Food & Dining, Transportation, Shopping, Bills & Utilities, 
            Healthcare, Entertainment, Travel, Business, Transfer, Investment, Fees & Charges, Other`;

          const analysis = await perplexityService.analyzeText(analysisText);
          
          // Parse categories from response (simplified logic)
          const categories = this._extractCategoriesFromAnalysis(analysis, batch);
          
          // Update transactions with categories
          for (let j = 0; j < batch.length; j++) {
            const transaction = batch[j];
            const category = categories[j] || 'Other';
            
            await Transaction.findByIdAndUpdate(transaction._id, {
              category,
              categorizedAt: new Date(),
              categorizedBy: 'AI'
            });
            
            categorizedCount++;
          }

        } catch (error) {
          logger.warn('Failed to categorize batch', { error: error.message, batchStart: i });
          
          // Fallback to rule-based categorization
          for (const transaction of batch) {
            const category = this._ruleBasedCategorization(transaction);
            await Transaction.findByIdAndUpdate(transaction._id, {
              category,
              categorizedAt: new Date(),
              categorizedBy: 'Rule-based'
            });
            categorizedCount++;
          }
        }
      }

      // Update statement categorization status
      await Statement.findByIdAndUpdate(statement._id, {
        categorizationStatus: 'completed',
        lastCategorizedAt: new Date(),
        categorizedTransactionCount: categorizedCount
      });

      res.status(200).json({
        success: true,
        data: {
          categorizedCount,
          totalTransactions: transactions.length,
          message: `Successfully categorized ${categorizedCount} transactions`
        }
      });

    } catch (error) {
      logger.error('Error categorizing transactions:', error);
      next(error);
    }
  };

  // ============================================================================
  // HELPER METHODS FOR ANALYTICS
  // ============================================================================

  static _analyzeTransactionCategories(transactions) {
    const categories = {};
    
    transactions.forEach(transaction => {
      const category = transaction.category || 'Uncategorized';
      if (!categories[category]) {
        categories[category] = { count: 0, totalAmount: 0 };
      }
      categories[category].count++;
      categories[category].totalAmount += Math.abs(transaction.amount);
    });

    return categories;
  }

  static _analyzeCashFlow(transactions) {
    const sortedTransactions = transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    const dailyBalances = {};
    
    sortedTransactions.forEach(transaction => {
      runningBalance += transaction.amount;
      const dateKey = new Date(transaction.date).toISOString().split('T')[0];
      dailyBalances[dateKey] = runningBalance;
    });

    const balances = Object.values(dailyBalances);
    
    return {
      averageBalance: balances.length > 0 ? balances.reduce((a, b) => a + b, 0) / balances.length : 0,
      minimumBalance: Math.min(...balances, 0),
      maximumBalance: Math.max(...balances, 0),
      volatility: this._calculateVolatility(balances),
      dailyBalances
    };
  }

  static _calculateRiskMetrics(statement, transactions) {
    const nsfTransactions = transactions.filter(t => 
      t.description && (
        t.description.toLowerCase().includes('nsf') ||
        t.description.toLowerCase().includes('insufficient') ||
        t.description.toLowerCase().includes('overdraft')
      )
    );

    const averageBalance = transactions.length > 0 ? 
      transactions.reduce((sum, t) => sum + t.amount, statement.openingBalance || 0) / transactions.length : 0;

    return {
      nsfCount: nsfTransactions.length,
      nsfAmount: nsfTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
      averageBalance,
      riskLevel: this._determineRiskLevel(nsfTransactions.length, averageBalance),
      highRiskTransactions: transactions.filter(t => Math.abs(t.amount) > 5000).length
    };
  }

  static _analyzeIncomeStability(transactions) {
    const incomeTransactions = transactions.filter(t => t.amount > 0 && t.amount > 500);
    
    if (incomeTransactions.length < 2) {
      return { stability: 'Insufficient data', variability: 0 };
    }

    const amounts = incomeTransactions.map(t => t.amount);
    const average = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - average, 2), 0) / amounts.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / average;

    return {
      averageIncome: average,
      incomeFrequency: incomeTransactions.length,
      variability: coefficientOfVariation,
      stability: coefficientOfVariation < 0.2 ? 'High' : coefficientOfVariation < 0.5 ? 'Medium' : 'Low'
    };
  }

  static _calculateVolatility(balances) {
    if (balances.length < 2) return 0;
    
    const average = balances.reduce((a, b) => a + b, 0) / balances.length;
    const variance = balances.reduce((sum, balance) => sum + Math.pow(balance - average, 2), 0) / balances.length;
    return Math.sqrt(variance);
  }

  static _determineRiskLevel(nsfCount, averageBalance) {
    if (nsfCount >= 3 || averageBalance < 500) return 'HIGH';
    if (nsfCount >= 1 || averageBalance < 2000) return 'MEDIUM';
    return 'LOW';
  }

  static _extractCategoriesFromAnalysis(analysis, transactions) {
    // Simplified category extraction - in production, this would use more sophisticated NLP
    const categories = [];
    const categoryKeywords = {
      'Food & Dining': ['restaurant', 'food', 'dining', 'cafe', 'mcdonalds', 'starbucks'],
      'Transportation': ['gas', 'fuel', 'uber', 'lyft', 'taxi', 'parking'],
      'Shopping': ['walmart', 'target', 'amazon', 'store', 'purchase'],
      'Bills & Utilities': ['electric', 'utility', 'phone', 'internet', 'bill'],
      'Healthcare': ['medical', 'doctor', 'pharmacy', 'hospital'],
      'Entertainment': ['netflix', 'spotify', 'movie', 'entertainment'],
      'Transfer': ['transfer', 'deposit', 'withdrawal'],
      'Fees & Charges': ['fee', 'charge', 'overdraft', 'nsf']
    };

    transactions.forEach(transaction => {
      const description = transaction.description.toLowerCase();
      let category = 'Other';
      
      for (const [cat, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => description.includes(keyword))) {
          category = cat;
          break;
        }
      }
      
      categories.push(category);
    });

    return categories;
  }

  static _ruleBasedCategorization(transaction) {
    const description = transaction.description.toLowerCase();
    const amount = transaction.amount;

    // Rule-based categorization logic
    if (amount > 0 && amount > 1000) return 'Income';
    if (description.includes('transfer')) return 'Transfer';
    if (description.includes('fee') || description.includes('charge')) return 'Fees & Charges';
    if (description.includes('food') || description.includes('restaurant')) return 'Food & Dining';
    if (description.includes('gas') || description.includes('fuel')) return 'Transportation';
    if (description.includes('medical') || description.includes('pharmacy')) return 'Healthcare';
    
    return 'Other';
  }

  // ============================================================================
  // ADDITIONAL MISSING METHODS
  // ============================================================================

  /**
   * Enhanced analysis with alerts
   * POST /api/statements/:id/analyze-enhanced
   */
  static analyzeStatementWithAlerts = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid statement ID format'
        });
      }

      const statement = await Statement.findOne({
        _id: id,
        userId: new mongoose.Types.ObjectId(userId)
      });

      if (!statement) {
        return res.status(404).json({
          success: false,
          error: 'Statement not found'
        });
      }

      const transactions = await Transaction.find({ statementId: statement._id });

      // Perform enhanced analysis with alerts
      const analysis = riskAnalysisService.analyze(transactions, statement);
      const alerts = AlertsEngineService ? await AlertsEngineService.generateAlerts(statement, transactions) : [];

      // Update statement with enhanced analysis
      await Statement.findByIdAndUpdate(statement._id, {
        enhancedAnalysis: {
          ...analysis,
          alerts,
          generatedAt: new Date()
        },
        lastEnhancedAnalysisAt: new Date()
      });

      res.status(200).json({
        success: true,
        data: {
          analysis,
          alerts,
          statement: {
            id: statement._id,
            fileName: statement.fileName,
            bankName: statement.bankName
          }
        }
      });

    } catch (error) {
      logger.error('Error performing enhanced analysis:', error);
      next(error);
    }
  };

  /**
   * Get analysis status
   * GET /api/statements/:id/analysis-status
   */
  static getAnalysisStatus = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const statement = await Statement.findOne({
        _id: id,
        userId: new mongoose.Types.ObjectId(userId)
      });

      if (!statement) {
        return res.status(404).json({
          success: false,
          error: 'Statement not found'
        });
      }

      const status = {
        statementId: statement._id,
        processingStatus: statement.status || 'unknown',
        analysisStatus: statement.analysis ? 'completed' : 'pending',
        enhancedAnalysisStatus: statement.enhancedAnalysis ? 'completed' : 'pending',
        categorizationStatus: statement.categorizationStatus || 'pending',
        lastUpdated: statement.updatedAt,
        createdAt: statement.createdAt
      };

      res.status(200).json({
        success: true,
        data: { status }
      });

    } catch (error) {
      logger.error('Error getting analysis status:', error);
      next(error);
    }
  };

  /**
   * Get analysis report
   * GET /api/statements/:id/analysis-report
   */
  static getAnalysisReport = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const statement = await Statement.findOne({
        _id: id,
        userId: new mongoose.Types.ObjectId(userId)
      });

      if (!statement) {
        return res.status(404).json({
          success: false,
          error: 'Statement not found'
        });
      }

      const transactions = await Transaction.find({ statementId: statement._id });

      const report = {
        statementInfo: {
          id: statement._id,
          accountNumber: statement.accountNumber,
          bankName: statement.bankName,
          statementPeriod: statement.statementPeriod,
          fileName: statement.fileName
        },
        analysis: statement.analysis || {},
        enhancedAnalysis: statement.enhancedAnalysis || {},
        analytics: statement.analytics || {},
        transactionSummary: {
          total: transactions.length,
          credits: transactions.filter(t => t.amount > 0).length,
          debits: transactions.filter(t => t.amount < 0).length,
          totalCredits: transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
          totalDebits: Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0))
        },
        generatedAt: new Date()
      };

      res.status(200).json({
        success: true,
        data: { report }
      });

    } catch (error) {
      logger.error('Error generating analysis report:', error);
      next(error);
    }
  };

  /**
   * Retry analysis
   * POST /api/statements/:id/retry-analysis
   */
  static retryAnalysis = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const statement = await Statement.findOne({
        _id: id,
        userId: new mongoose.Types.ObjectId(userId)
      });

      if (!statement) {
        return res.status(404).json({
          success: false,
          error: 'Statement not found'
        });
      }

      // Reset analysis status
      await Statement.findByIdAndUpdate(statement._id, {
        status: 'processing',
        analysis: null,
        enhancedAnalysis: null,
        analytics: null,
        processingStartedAt: new Date()
      });

      // Trigger re-analysis (in a real implementation, this would queue the job)
      const transactions = await Transaction.find({ statementId: statement._id });
      const analysis = riskAnalysisService.analyze(transactions, statement);

      await Statement.findByIdAndUpdate(statement._id, {
        status: 'completed',
        analysis,
        processingCompletedAt: new Date()
      });

      res.status(200).json({
        success: true,
        data: {
          message: 'Analysis retry initiated',
          analysis,
          statement: {
            id: statement._id,
            status: 'completed'
          }
        }
      });

    } catch (error) {
      logger.error('Error retrying analysis:', error);
      next(error);
    }
  };

  /**
   * Get analysis history
   * GET /api/statements/:id/analysis-history
   */
  static getAnalysisHistory = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const statement = await Statement.findOne({
        _id: id,
        userId: new mongoose.Types.ObjectId(userId)
      });

      if (!statement) {
        return res.status(404).json({
          success: false,
          error: 'Statement not found'
        });
      }

      // In a real implementation, this would query an analysis history table
      const history = [
        {
          analysisType: 'initial',
          performedAt: statement.createdAt,
          status: 'completed',
          results: statement.analysis || {}
        }
      ];

      if (statement.lastAnalyticsAt) {
        history.push({
          analysisType: 'analytics',
          performedAt: statement.lastAnalyticsAt,
          status: 'completed',
          results: statement.analytics || {}
        });
      }

      if (statement.lastEnhancedAnalysisAt) {
        history.push({
          analysisType: 'enhanced',
          performedAt: statement.lastEnhancedAnalysisAt,
          status: 'completed',
          results: statement.enhancedAnalysis || {}
        });
      }

      res.status(200).json({
        success: true,
        data: {
          history: history.sort((a, b) => new Date(b.performedAt) - new Date(a.performedAt)),
          total: history.length
        }
      });

    } catch (error) {
      logger.error('Error getting analysis history:', error);
      next(error);
    }
  };

  /**
   * Download statement file
   * GET /api/statements/:id/download
   */
  static downloadStatement = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const statement = await Statement.findOne({
        _id: id,
        userId: new mongoose.Types.ObjectId(userId)
      });

      if (!statement) {
        return res.status(404).json({
          success: false,
          error: 'Statement not found'
        });
      }

      if (!statement.fileUrl) {
        return res.status(404).json({
          success: false,
          error: 'File not found for this statement'
        });
      }

      // In a real implementation, this would serve the actual file
      res.status(200).json({
        success: true,
        data: {
          downloadUrl: statement.fileUrl,
          fileName: statement.fileName,
          message: 'Download link generated successfully'
        }
      });

    } catch (error) {
      logger.error('Error downloading statement:', error);
      next(error);
    }
  };

  /**
   * Export statement data
   * GET /api/statements/:id/export-data
   */
  static exportStatementData = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { format = 'json' } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const statement = await Statement.findOne({
        _id: id,
        userId: new mongoose.Types.ObjectId(userId)
      });

      if (!statement) {
        return res.status(404).json({
          success: false,
          error: 'Statement not found'
        });
      }

      const transactions = await Transaction.find({ statementId: statement._id });

      const exportData = {
        statement: {
          id: statement._id,
          accountNumber: statement.accountNumber,
          bankName: statement.bankName,
          statementPeriod: statement.statementPeriod,
          openingBalance: statement.openingBalance,
          closingBalance: statement.closingBalance
        },
        transactions: transactions.map(t => ({
          date: t.date,
          description: t.description,
          amount: t.amount,
          category: t.category
        })),
        analysis: statement.analysis || {},
        exportedAt: new Date()
      };

      // Set appropriate headers based on format
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="statement_${id}.csv"`);
        
        // Simple CSV conversion
        const csv = transactions.map(t => 
          `${t.date},${t.description},${t.amount},${t.category || ''}`
        ).join('\n');
        
        res.status(200).send(`Date,Description,Amount,Category\n${csv}`);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="statement_${id}.json"`);
        res.status(200).json(exportData);
      }

    } catch (error) {
      logger.error('Error exporting statement data:', error);
      next(error);
    }
  };

  /**
   * Calculate Veritas score
   * POST /api/statements/veritas
   */
  static calculateVeritasScore = async (req, res, next) => {
    try {
      const { nsfCount = 0, averageBalance = 0, transactions = [] } = req.body;

      if (typeof nsfCount !== 'number' || typeof averageBalance !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'nsfCount and averageBalance must be numbers'
        });
      }

      // Simple Veritas score calculation
      let score = 700; // Base score

      // NSF penalties
      score -= (nsfCount * 50);
      
      // Balance bonuses/penalties
      if (averageBalance > 5000) score += 50;
      else if (averageBalance > 2000) score += 25;
      else if (averageBalance < 500) score -= 75;
      
      // Transaction volume factor
      if (transactions.length > 50) score += 25;
      else if (transactions.length < 10) score -= 25;

      // Ensure score is within valid range
      score = Math.max(300, Math.min(850, score));

      const veritasData = {
        score,
        factors: {
          nsfCount,
          averageBalance,
          transactionCount: transactions.length,
          baseScore: 700
        },
        rating: score >= 750 ? 'Excellent' :
                score >= 700 ? 'Good' :
                score >= 650 ? 'Fair' :
                score >= 600 ? 'Poor' : 'Very Poor',
        calculatedAt: new Date()
      };

      res.status(200).json({
        success: true,
        data: veritasData
      });

    } catch (error) {
      logger.error('Error calculating Veritas score:', error);
      next(error);
    }
  };

  /**
   * Get risk analysis
   * POST /api/statements/risk
   */
  static getRiskAnalysis = async (req, res, next) => {
    try {
      const { transactions = [], statement = {}, options = {} } = req.body;

      // Perform risk analysis
      const riskAnalysis = riskAnalysisService.analyze(transactions, statement);
      const statementRisk = riskAnalysisService.analyzeStatementRisk(statement);

      const combinedAnalysis = {
        transactionRisk: riskAnalysis,
        statementRisk,
        overallRiskScore: (riskAnalysis.riskScore + statementRisk.riskScore) / 2,
        overallRiskLevel: riskAnalysis.riskScore > 7 || statementRisk.riskScore > 7 ? 'HIGH' :
                         riskAnalysis.riskScore > 5 || statementRisk.riskScore > 5 ? 'MEDIUM' : 'LOW',
        recommendations: [
          ...(riskAnalysis.recommendations || []),
          'Monitor account regularly',
          'Consider setting up account alerts'
        ],
        analyzedAt: new Date()
      };

      res.status(200).json({
        success: true,
        data: combinedAnalysis
      });

    } catch (error) {
      logger.error('Error performing risk analysis:', error);
      next(error);
    }
  };
}

// Export the class as default (for static method usage)
export default StatementController;

