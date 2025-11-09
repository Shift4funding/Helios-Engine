import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Import the actual Statement model directly
import Statement from '../../src/models/Statement.js';

describe('Statement Model Integration Tests', () => {
  let mongoServer;

  beforeAll(async () => {
    try {
      // Create in-memory MongoDB instance
      mongoServer = await MongoMemoryServer.create();
      const uri = mongoServer.getUri();
      
      // Disconnect any existing connections
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      
      // Connect to the in-memory database
      await mongoose.connect(uri);
      console.log('✅ Connected to in-memory test database');
    } catch (error) {
      console.error('❌ Failed to setup test database:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Clean up
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
      }
      if (mongoServer) {
        await mongoServer.stop();
      }
      console.log('✅ Test database cleaned up');
    } catch (error) {
      console.error('❌ Failed to cleanup test database:', error);
    }
  });

  it('should create a valid statement with all required fields', async () => {
    const statementData = {
      userId: new mongoose.Types.ObjectId(),
      uploadId: 'upload-test-1',
      fileUrl: 'https://storage.example.com/test-statement.pdf',
      fileName: 'test-statement.pdf',
      statementDate: new Date(),
      bankName: 'Test Bank',
      accountNumber: '1234567890',
      originalName: 'Bank Statement Jan 2023.pdf',
      metadata: {
        mimetype: 'application/pdf',
        size: 1024000
      },
      status: 'PENDING',
      openingBalance: 2500,
      closingBalance: 2000,
      uploadDate: new Date(),
      transactions: [],
      analytics: {
        totalTransactions: 10,
        totalIncome: 5000,
        totalExpenses: 3000,
        netCashFlow: 2000
      }
    };

    const statement = new Statement(statementData);
    const savedStatement = await statement.save();

    // Verify the document was saved correctly
    expect(savedStatement._id).toBeDefined();
    expect(savedStatement.userId.toString()).toBe(statementData.userId.toString());
    expect(savedStatement.fileName).toBe(statementData.fileName);
    expect(savedStatement.originalName).toBe(statementData.originalName);
    expect(savedStatement.status).toBe('PENDING');
  expect(savedStatement.metadata?.mimetype).toBe('application/pdf');
  expect(savedStatement.metadata?.size).toBe(1024000);
  expect(savedStatement.analytics.totalTransactions).toBe(10);
  expect(savedStatement.analytics.totalIncome).toBe(5000);
  expect(savedStatement.analytics.totalExpenses).toBe(3000);
    
    console.log('✅ Statement created successfully with ID:', savedStatement._id);
  });

  it('should fail validation without required userId field', async () => {
    const invalidData = {
      uploadId: 'upload-missing-user',
      fileUrl: 'https://storage.example.com/test-statement.pdf',
      fileName: 'test-statement.pdf',
      originalName: 'test-statement.pdf',
      statementDate: new Date(),
      bankName: 'Test Bank',
      accountNumber: '1234567890',
      status: 'PENDING',
      openingBalance: 1000,
      closingBalance: 900
      // Missing required userId
    };

    const statement = new Statement(invalidData);
    
    await expect(statement.save()).rejects.toThrow();
    console.log('✅ Validation correctly failed for missing userId');
  });

  it('should handle alerts array correctly', async () => {
    const statementData = {
      userId: new mongoose.Types.ObjectId(),
      uploadId: 'upload-alert-1',
      fileUrl: 'https://storage.example.com/alert-test.pdf',
      fileName: 'alert-test-statement.pdf',
      originalName: 'Alert Test Statement.pdf',
      fileType: 'application/pdf',
      fileSize: 512000,
      statementDate: new Date(),
      bankName: 'Test Bank',
      accountNumber: '1234567890',
      status: 'COMPLETED',
      openingBalance: 1200,
      closingBalance: 950,
      uploadDate: new Date(),
      transactions: [],
      alerts: [
        {
          code: 'NSF_TRANSACTION_ALERT',
          severity: 'high',
          message: 'Unusually high spending detected',
          data: { amount: 5000, category: 'Entertainment' },
          timestamp: new Date()
        },
        {
          code: 'LOW_AVERAGE_BALANCE',
          severity: 'medium',
          message: 'Account balance is running low',
          data: { balance: 100 },
          timestamp: new Date()
        }
      ]
    };

    const statement = new Statement(statementData);
    const savedStatement = await statement.save();

    expect(savedStatement.alerts).toHaveLength(2);
    expect(savedStatement.alerts[0].code).toBe('NSF_TRANSACTION_ALERT');
  expect(savedStatement.alerts[0].severity).toBe('HIGH');
    expect(savedStatement.alerts[1].code).toBe('LOW_AVERAGE_BALANCE');
  expect(savedStatement.alerts[1].severity).toBe('MEDIUM');
    
    console.log('✅ Alerts array handled correctly');
  });

  it('should handle mongoose schema types correctly', async () => {
    // Test that our mongoose import fixes work
    expect(mongoose.Schema.Types.ObjectId).toBeDefined();
    expect(mongoose.Schema.Types.Mixed).toBeDefined();
    expect(mongoose.Types.ObjectId).toBeDefined();
    
    // Test creating ObjectId
    const testId = new mongoose.Types.ObjectId();
    expect(testId).toBeDefined();
    expect(typeof testId.toString()).toBe('string');
    
    console.log('✅ Mongoose Schema.Types working correctly');
  });

  it('should maintain model singleton behavior', async () => {
    // Test that our idempotent export pattern works
    const Statement1 = mongoose.models.Statement;
    const Statement2 = mongoose.model('Statement');
    
    expect(Statement1).toBe(Statement2);
    expect(Statement1).toBe(Statement);
    
    console.log('✅ Model singleton behavior maintained');
  });
});
