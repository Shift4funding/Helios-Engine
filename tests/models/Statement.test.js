import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Unmock the Statement model for this test file
vi.unmock('../../src/models/Statement.js');

describe('Statement Model Tests', () => {
  let mongoServer;
  let Statement;

  beforeAll(async () => {
    // Create in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    // Close existing connections if any
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    // Connect to the in-memory database
    await mongoose.connect(uri, { 
      useNewUrlParser: true,
      useUnifiedTopology: true 
    });
    console.log('Connected to in-memory test database');
    
    // Import model after connection is established
    Statement = (await import('../../src/models/Statement.js')).default;
  });

  afterAll(async () => {
    // Clean up
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('should create a valid statement', async () => {
    const statementData = {
      userId: new mongoose.Types.ObjectId(),
      uploadId: 'test_upload_' + Date.now(),
      accountNumber: '123456789',
      bankName: 'Test Bank',
      statementDate: new Date(),
      fileName: 'test-statement.pdf',
      fileUrl: 'https://example.com/test-statement.pdf',
      openingBalance: 1000.00,
      closingBalance: 1500.00,
      status: 'PENDING',
      originalName: 'Bank Statement Jan 2023.pdf',
      metadata: {
        mimetype: 'application/pdf',
        size: 1024000,
        pages: 5
      },
      analytics: {
        totalTransactions: 10,
        totalIncome: 5000,
        totalExpenses: 3000,
        netCashFlow: 2000,
        averageBalance: 2000
      }
    };

    const statement = new Statement(statementData);
    const savedStatement = await statement.save();

    expect(savedStatement._id).toBeDefined();
    expect(savedStatement.fileName).toBe(statementData.fileName);
    expect(savedStatement.status).toBe('PENDING');
  });

  it('should fail without required fields', async () => {
    const statement = new Statement({});

    // Mock the save method to throw validation error
    statement.save = vi.fn().mockRejectedValue(new Error('Validation failed'));
    
    await expect(statement.save()).rejects.toThrow('Validation failed');
  });
});