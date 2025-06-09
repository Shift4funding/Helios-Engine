const bankStatementQueryService = require('../../src/services/bankStatementQueryService');
const llmService = require('../../src/services/llmService');
const analysisService = require('../../src/services/analysisService');
const { AnalysisNotFoundError } = require('../../src/utils/errors');

// Mock dependencies
jest.mock('../../src/services/llmService');
jest.mock('../../src/services/analysisService');
jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

describe('Bank Statement Query Service', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
  });

  describe('queryBankStatements', () => {
    const mockAnalysisId = 'analysis123';
    const mockQuestion = 'What is the average daily balance?';
    const mockAnalysis = {
      _id: mockAnalysisId,
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      accountInfo: {
        accountNumber: '****1234',
        bankName: 'Test Bank'
      },
      transactions: [
        { 
          date: '2025-01-05', 
          amount: 1000, 
          type: 'deposit', 
          description: 'Payroll' 
        },
        { 
          date: '2025-01-10', 
          amount: -200, 
          type: 'withdrawal', 
          description: 'ATM Withdrawal' 
        },
        { 
          date: '2025-01-15', 
          amount: -300, 
          type: 'withdrawal', 
          description: 'Rent Payment' 
        }
      ],
      summary: {
        totalDeposits: 1000,
        totalWithdrawals: 500,
        netCashFlow: 500
      }
    };

    const mockLLMResponse = {
      success: true,
      data: {
        answer: 'The average daily balance is $750.00.',
        confidence: 0.92,
        model: 'gpt-4'
      }
    };

    it('should process a query and return a response', async () => {
      // Setup mocks
      analysisService.getAnalysisById = jest.fn().mockResolvedValue(mockAnalysis);
      llmService.processQuery = jest.fn().mockResolvedValue(mockLLMResponse);
      
      // Call the service
      const result = await bankStatementQueryService.queryBankStatements(
        mockAnalysisId, 
        mockQuestion
      );
      
      // Verify results
      expect(result.success).toBe(true);
      expect(result.question).toBe(mockQuestion);
      expect(result.answer).toBe(mockLLMResponse.data.answer);
      expect(result.analysisId).toBe(mockAnalysisId);
      
      // Verify correct service calls
      expect(analysisService.getAnalysisById).toHaveBeenCalledWith(mockAnalysisId);
      expect(llmService.processQuery).toHaveBeenCalled();
    });

    it('should identify question type correctly', () => {
      // Test different question types
      expect(bankStatementQueryService.identifyQuestionType('What is the average daily balance?'))
        .toBe('dailyBalance');
      
      expect(bankStatementQueryService.identifyQuestionType('How much was spent on payroll?'))
        .toBe('payroll');
      
      expect(bankStatementQueryService.identifyQuestionType('What are my top vendors?'))
        .toBe('vendors');
      
      expect(bankStatementQueryService.identifyQuestionType('What is my total revenue?'))
        .toBe('revenue');
      
      expect(bankStatementQueryService.identifyQuestionType('How much did I spend last month?'))
        .toBe('expenses');
      
      expect(bankStatementQueryService.identifyQuestionType('What is my cash flow?'))
        .toBe('cashFlow');
      
      expect(bankStatementQueryService.identifyQuestionType('Is this a good business?'))
        .toBe('general');
    });

    it('should handle analysis not found error', async () => {
      // Setup mocks for not found scenario
      analysisService.getAnalysisById = jest.fn().mockResolvedValue(null);
      
      // Call the service
      const result = await bankStatementQueryService.queryBankStatements(
        mockAnalysisId, 
        mockQuestion
      );
      
      // Verify error handling
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle LLM service errors', async () => {
      // Setup mocks
      analysisService.getAnalysisById = jest.fn().mockResolvedValue(mockAnalysis);
      llmService.processQuery = jest.fn().mockRejectedValue(new Error('LLM service error'));
      
      // Call the service
      const result = await bankStatementQueryService.queryBankStatements(
        mockAnalysisId, 
        mockQuestion
      );
      
      // Verify error handling
      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM service error');
    });
  });

  describe('data extraction methods', () => {
    const mockAnalysis = {
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      startingBalance: 1000,
      transactions: [
        { date: '2025-01-02', amount: 500, type: 'deposit', description: 'Client Payment' },
        { date: '2025-01-05', amount: -200, type: 'withdrawal', description: 'Office Supplies' },
        { date: '2025-01-10', amount: 1000, type: 'deposit', description: 'Client Payment' },
        { date: '2025-01-15', amount: -1500, type: 'withdrawal', description: 'Rent' },
        { date: '2025-01-20', amount: -100, type: 'withdrawal', description: 'Utilities' },
        { date: '2025-01-25', amount: 2000, type: 'deposit', description: 'Client Payment' },
        { date: '2025-01-28', amount: -800, type: 'withdrawal', description: 'Payroll' }
      ]
    };

    it('should extract balance data correctly', () => {
      const balanceData = bankStatementQueryService.extractBalanceData(mockAnalysis);
      
      expect(balanceData).toHaveProperty('dailyBalances');
      expect(balanceData).toHaveProperty('balanceMetrics');
      expect(balanceData.balanceMetrics).toHaveProperty('averageBalance');
      expect(balanceData.balanceMetrics).toHaveProperty('lowestBalance');
      expect(balanceData.balanceMetrics).toHaveProperty('highestBalance');
    });

    it('should extract cash flow data correctly', () => {
      const cashFlowData = bankStatementQueryService.extractCashFlowData(mockAnalysis);
      
      expect(cashFlowData).toHaveProperty('cashFlowMetrics');
      expect(cashFlowData.cashFlowMetrics).toHaveProperty('totalInflow');
      expect(cashFlowData.cashFlowMetrics).toHaveProperty('totalOutflow');
      expect(cashFlowData.cashFlowMetrics).toHaveProperty('netCashFlow');
      
      // Verify calculations
      expect(cashFlowData.cashFlowMetrics.totalInflow).toBe(3500); // Sum of deposits
      expect(cashFlowData.cashFlowMetrics.totalOutflow).toBe(2600); // Sum of withdrawals
      expect(cashFlowData.cashFlowMetrics.netCashFlow).toBe(900); // Net cash flow
    });

    it('should extract comprehensive context for general questions', () => {
      const context = bankStatementQueryService.createComprehensiveContext(mockAnalysis);
      
      expect(context).toHaveProperty('summary');
      expect(context).toHaveProperty('revenue');
      expect(context).toHaveProperty('expenses');
      expect(context).toHaveProperty('topVendors');
      expect(context).toHaveProperty('sampleTransactions');
      
      // Check that we limit the number of transactions to avoid context overload
      expect(context.sampleTransactions.length).toBeLessThanOrEqual(20);
    });
  });

  describe('payroll detection', () => {
    it('should detect weekly payroll frequency', () => {
      const payrollTransactions = [
        { date: '2025-01-01', amount: -1000, type: 'withdrawal', description: 'Payroll' },
        { date: '2025-01-08', amount: -1000, type: 'withdrawal', description: 'Payroll' },
        { date: '2025-01-15', amount: -1000, type: 'withdrawal', description: 'Payroll' },
        { date: '2025-01-22', amount: -1000, type: 'withdrawal', description: 'Payroll' },
        { date: '2025-01-29', amount: -1000, type: 'withdrawal', description: 'Payroll' }
      ];
      
      const frequency = bankStatementQueryService.detectPayrollFrequency(payrollTransactions);
      expect(frequency).toBe('Weekly');
    });

    it('should detect bi-weekly payroll frequency', () => {
      const payrollTransactions = [
        { date: '2025-01-01', amount: -2000, type: 'withdrawal', description: 'Payroll' },
        { date: '2025-01-15', amount: -2000, type: 'withdrawal', description: 'Payroll' },
        { date: '2025-01-29', amount: -2000, type: 'withdrawal', description: 'Payroll' }
      ];
      
      const frequency = bankStatementQueryService.detectPayrollFrequency(payrollTransactions);
      expect(frequency).toBe('Bi-Weekly');
    });

    it('should detect monthly payroll frequency', () => {
      const payrollTransactions = [
        { date: '2025-01-01', amount: -5000, type: 'withdrawal', description: 'Payroll' },
        { date: '2025-02-01', amount: -5000, type: 'withdrawal', description: 'Payroll' },
        { date: '2025-03-01', amount: -5000, type: 'withdrawal', description: 'Payroll' }
      ];
      
      const frequency = bankStatementQueryService.detectPayrollFrequency(payrollTransactions);
      expect(frequency).toBe('Monthly');
    });

    it('should handle unknown payroll frequency with insufficient data', () => {
      const payrollTransactions = [
        { date: '2025-01-01', amount: -1000, type: 'withdrawal', description: 'Payroll' }
      ];
      
      const frequency = bankStatementQueryService.detectPayrollFrequency(payrollTransactions);
      expect(frequency).toBe('Unknown');
    });
  });
});
