import { jest } from '@jest/globals';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/testDb.js';
import TransactionAnalysisService from '../../src/services/transactionAnalysisService.js';
import Transaction from '../../src/models/Transaction.js';

describe('Transaction Analysis Service', () => {
  let service;
  let mockData;

  // Initialize test data and service
  beforeAll(async () => {
    await setupTestDatabase();

    service = new TransactionAnalysisService();
    mockData = {
      sampleTransactions: [
        {
          date: new Date('2025-01-01'),
          description: 'SALARY DEPOSIT',
          amount: 5000,
          category: 'income'
        },
        {
          date: new Date('2025-01-15'),
          description: 'RENT',
          amount: -2000,
          category: 'expense'
        }
      ]
    };
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  // Clean up after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Performance metrics tests with proper isolation
  describe('performance metrics', () => {
    let mocks;

    beforeEach(() => {
      // Setup all mocks in a controlled way
      mocks = {
        hrtime: jest.spyOn(process, 'hrtime')
          .mockImplementation((time) => time ? [1, 0] : [0, 0]),
        
        memoryUsage: jest.spyOn(process, 'memoryUsage')
          .mockReturnValue({ heapUsed: 1024 * 1024 }),
        
        countDocuments: jest.spyOn(Transaction, 'countDocuments')
          .mockResolvedValue(2)
      };
    });

    afterEach(() => {
      // Restore each mock individually
      Object.values(mocks).forEach(mock => mock.mockRestore());
    });

    it('should calculate performance metrics correctly', async () => {
      // Act
      const metrics = await service.calculatePerformanceMetrics();

      // Assert structure
      expect(metrics).toMatchObject({
        processingTime: expect.any(Number),
        memoryUsage: expect.any(Number),
        transactionsProcessed: expect.any(Number)
      });

      // Assert specific values
      expect(metrics).toEqual({
        processingTime: 1,
        memoryUsage: 1024 * 1024,
        transactionsProcessed: 2
      });

      // Verify mock calls
      expect(mocks.hrtime).toHaveBeenCalledTimes(2);
      expect(mocks.memoryUsage).toHaveBeenCalledTimes(1);
      expect(mocks.countDocuments).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors', async () => {
      // Arrange
      mocks.countDocuments.mockRejectedValueOnce(new Error('Database error'));

      // Act & Assert
      await expect(service.calculatePerformanceMetrics())
        .rejects.toThrow('Failed to calculate performance metrics');
    });

    it('should handle empty database', async () => {
      // Arrange
      mocks.countDocuments.mockResolvedValueOnce(0);

      // Act
      const metrics = await service.calculatePerformanceMetrics();

      // Assert
      expect(metrics.transactionsProcessed).toBe(0);
    });
  });
});