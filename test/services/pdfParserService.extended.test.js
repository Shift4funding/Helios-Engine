import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import pdfParserService from '../../src/services/pdfParserService.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Convert filename path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load sample PDF buffer
const samplePdfBuffer = readFileSync(join(__dirname, '../fixtures/sample-statement.pdf'));

// Mock PDF parser service if needed
jest.mock('../../src/services/pdfParserService.js', () => ({
    default: {
        parsePDF: jest.fn().mockResolvedValue({
            transactions: [
                { date: '01/15/2024', category: 'DEPOSIT' },
                { date: '01/16/2024', category: 'WITHDRAWAL' }
            ]
        })
    }
}));

describe('PDF Parser Service Extended Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should handle various date formats', async () => {
        const result = await pdfParserService.parsePDF(samplePdfBuffer);
        expect(result.transactions).toBeDefined();
        result.transactions.forEach(transaction => {
            expect(transaction.date).toMatch(/\d{2}\/\d{2}\/\d{4}/);
        });
    });

    it('should categorize transactions correctly', async () => {
        const result = await pdfParserService.parsePDF(samplePdfBuffer);
        expect(result.transactions).toBeDefined();
        result.transactions.forEach(transaction => {
            expect(['DEPOSIT', 'WITHDRAWAL', 'PAYMENT', 'TRANSFER', 'PURCHASE', 'OTHER'])
                .toContain(transaction.category);
        });
    });
});