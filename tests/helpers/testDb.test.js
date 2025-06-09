const mongoose = require('mongoose');
const { setupTestDatabase, cleanupTestDatabase } = require('./testDb');

describe('Database Setup', () => {
    // Clean up before tests to ensure no existing connections
    beforeAll(async () => {
        await cleanupTestDatabase();
        await setupTestDatabase();
    });

    // Clean up after tests
    afterAll(async () => {
        await cleanupTestDatabase();
    });

    it('should connect to the test database', async () => {
        expect(mongoose.connection.readyState).toBe(1);
    });

    it('should be able to perform operations', async () => {
        // Create a new model for testing
        const TestModel = mongoose.model('Test', new mongoose.Schema({ 
            name: String 
        }), 'tests');

        // Test CRUD operations
        const testDoc = new TestModel({ name: 'test' });
        await testDoc.save();

        const found = await TestModel.findOne({ name: 'test' });
        expect(found.name).toBe('test');

        // Clean up test data
        await TestModel.deleteMany({});
    });
});