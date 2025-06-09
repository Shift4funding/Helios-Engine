const mongoose = require('mongoose');
const Transaction = require('../../src/models/Transaction');
const { setupTestDatabase, cleanupTestDatabase } = require('../helpers/testDb');

describe('Transaction Model', () => {
    beforeAll(async () => {
        await setupTestDatabase();
    });

    afterAll(async () => {
        await cleanupTestDatabase();
        // Ensure mongoose connection is closed
        await mongoose.disconnect();
    });

    afterEach(async () => {
        await Transaction.deleteMany({});
    });

    it('should create a transaction with required fields', async () => {
        const transaction = new Transaction({
            date: new Date(),
            description: 'Salary deposit',
            amount: 5000,
            category: 'income'
        });

        const saved = await transaction.save();
        expect(saved._id).toBeDefined();
        expect(saved.category).toBe('income');
        expect(saved.type).toBe('uncategorized');
    });

    it('should fail validation without required fields', async () => {
        const transaction = new Transaction({});
        await expect(transaction.save()).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('should validate amount is a number', async () => {
        const transaction = new Transaction({
            date: new Date(),
            description: 'Invalid amount',
            amount: 'not-a-number'
        });

        await expect(transaction.save()).rejects.toThrow(mongoose.Error.ValidationError);
    });

    it('should enforce category enum values', async () => {
        const transaction = new Transaction({
            date: new Date(),
            description: 'Test transaction',
            amount: 100,
            category: 'invalid-category'
        });

        await expect(transaction.save()).rejects.toThrow(mongoose.Error.ValidationError);
    });
});