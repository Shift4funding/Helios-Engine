const bankStatementQueryService = require('../services/bankStatementQueryService');
const logger = require('../config/logger');
const { ValidationError } = require('../utils/errors');

/**
 * Controller for handling bank statement queries
 */
class QueryController {
  /**
   * Process a natural language query about a bank statement analysis
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async processQuery(req, res, next) {
    try {
      const { analysisId, question } = req.body;
      
      // Validate required fields
      if (!analysisId) {
        throw new ValidationError('Analysis ID is required');
      }
      
      if (!question || typeof question !== 'string' || question.trim() === '') {
        throw new ValidationError('A valid question is required');
      }
      
      logger.info(`Processing query for analysis ${analysisId}: "${question}"`);
      
      // Process the query
      const result = await bankStatementQueryService.queryBankStatements(analysisId, question);
      
      // Return the response
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Error in processQuery: ${error.message}`, { error });
      next(error);
    }
  }
  
  /**
   * Get suggested questions for a specific analysis
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getSuggestedQuestions(req, res, next) {
    try {
      const { analysisId } = req.params;
      
      if (!analysisId) {
        throw new ValidationError('Analysis ID is required');
      }
      
      // Suggested questions by category
      const suggestedQuestions = {
        basics: [
          "What is the average daily balance?",
          "What is the total income for the period?",
          "What is the total expenses for the period?",
          "What is the net cash flow for the period?"
        ],
        payroll: [
          "How much was spent on payroll?",
          "What is the payroll frequency?",
          "What was the largest payroll payment?"
        ],
        vendors: [
          "Who are the top 5 vendors by spend?",
          "What is the largest recurring expense?",
          "How much is spent on utilities monthly?"
        ],
        trends: [
          "What is the month-over-month revenue trend?",
          "Are there any unusual spending patterns?",
          "What day of the month typically has the highest deposits?"
        ],
        financial: [
          "What is the debt service coverage ratio?",
          "How many days had negative balances?",
          "What is the average transaction size?"
        ]
      };
      
      return res.status(200).json({
        success: true,
        data: suggestedQuestions
      });
    } catch (error) {
      logger.error(`Error in getSuggestedQuestions: ${error.message}`, { error });
      next(error);
    }
  }
  
  /**
   * Get recent queries for a specific analysis
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getRecentQueries(req, res, next) {
    try {
      const { analysisId } = req.params;
      
      if (!analysisId) {
        throw new ValidationError('Analysis ID is required');
      }
      
      // This would typically fetch from a database
      // For now, return a placeholder
      return res.status(200).json({
        success: true,
        data: {
          recentQueries: []
        }
      });
    } catch (error) {
      logger.error(`Error in getRecentQueries: ${error.message}`, { error });
      next(error);
    }
  }
}

module.exports = new QueryController();
