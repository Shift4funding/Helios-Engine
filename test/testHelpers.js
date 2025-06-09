import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getFixturePath = (filename) => path.join(__dirname, 'fixtures', filename);

let mongod;

export const setupTestDatabase = async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
};

export const cleanupTestDatabase = async () => {
    await mongoose.disconnect();
    await mongod?.stop();
};

export const generateTestPDF = async ({ bankName, accountNumber, transactions }) => {
    // Mock PDF generation for tests
    return Buffer.from('Mock PDF content');
};

export const mockService = (servicePath, mockImplementation) => {
    jest.mock(servicePath, () => mockImplementation);
};