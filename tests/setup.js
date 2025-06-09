require('dotenv').config({ path: '.env.test' });
const mongoose = require('mongoose');
const { setupTestDatabase, cleanupTestDatabase } = require('./helpers/testDb');

beforeAll(async () => {
    jest.setTimeout(30000); // Increase timeout for slower CI environments
    await setupTestDatabase();
});

afterAll(async () => {
    await cleanupTestDatabase();
});

// Silence console during tests
console.log = jest.fn();