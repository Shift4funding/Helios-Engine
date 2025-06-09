import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Mock the dependencies
jest.mock('../../src/services/pdfParserService.js', () => ({
  parsePDF: jest.fn().mockResolvedValue({
    accountInfo: { accountNumber: '123456789', accountHolder: 'Test User' },
    transactions: [
      { date: '01/01/2023', description: 'Test Transaction', amount: 100 }
    ],
    metadata: { pageCount: 1 }
  }),
  __esModule: true,
  default: {
    parsePDF: jest.fn().mockResolvedValue({
      accountInfo: { accountNumber: '123456789', accountHolder: 'Test User' },
      transactions: [
        { date: '01/01/2023', description: 'Test Transaction', amount: 100 }
      ],
      metadata: { pageCount: 1 }
    })
  }
}));

jest.mock('../../src/services/transactionAnalysisService.js', () => ({
  analyzeTransactions: jest.fn().mockResolvedValue({
    categories: { revenue: 100, expense: 0 },
    summary: 'Test summary'
  }),
  __esModule: true,
  default: {
    analyzeTransactions: jest.fn().mockResolvedValue({
      categories: { revenue: 100, expense: 0 },
      summary: 'Test summary'
    })
  }
}));

// Dynamic import to avoid ESM/CJS issues
const getAnalysisService = async () => {
  return (await import('../../src/services/analysisService.js')).default;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Analysis Service', () => {
    let analysisService;
    let buffer;

    beforeEach(async () => {
        analysisService = await getAnalysisService();
        
        try {
            // Try to read the file, but handle the case if it doesn't exist
            buffer = await fs.readFile(
                path.join(__dirname, '../fixtures/sample-statement.pdf')
            );
        } catch (error) {
            // Create a mock buffer if file doesn't exist
            buffer = Buffer.from('%PDF-1.4\nTest content');
        }
    });

    test('should analyze bank statement PDF', async () => {
        const result = await analysisService.analyzeBankStatement(buffer);

        expect(result).toHaveProperty('totalPages');
        expect(result).toHaveProperty('analysis');
        expect(result).toHaveProperty('timestamp');
    });

    test('should handle errors gracefully', async () => {
        // Force an error
        const badBuffer = null;
        
        await expect(async () => {
            await analysisService.analyzeBankStatement(badBuffer);
        }).rejects.toThrow();
    });
});
