import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('PDF Parser Service', () => {
    let PDFParserService;
    let validPdfBuffer;

    beforeEach(async () => {
        const { PDFParserService: Service } = await import('../../src/services/PDFParserService.js');
        PDFParserService = Service;
        const testPdfPath = path.join(__dirname, '../data/05-versions-space.pdf');
        validPdfBuffer = await fs.readFile(testPdfPath);
    });

    describe('Basic Parsing', () => {
        it('should parse a valid PDF file', async () => {
            const parser = new PDFParserService();
            const result = await parser.parse(validPdfBuffer);

            expect(result).toBeDefined();
            expect(result.accountInfo).toEqual(expect.objectContaining({
                accountNumber: expect.stringContaining('1234'),
                period: expect.objectContaining({
                    start: '05/01/2025',
                    end: '05/31/2025'
                })
            }));
            expect(result.transactions).toHaveLength(2);
        });

        it('should handle empty PDF files', async () => {
            const emptyPdfPath = path.join(__dirname, '../data/empty.pdf');
            const emptyBuffer = await fs.readFile(emptyPdfPath);
            
            const parser = new PDFParserService();
            await expect(parser.parse(emptyBuffer))
                .rejects
                .toThrow('Failed to parse bank statement');
        });
    });

    describe('Transaction Parsing', () => {
        it('should correctly parse transaction amounts', async () => {
            const parser = new PDFParserService();
            const result = await parser.parse(validPdfBuffer);

            expect(result.transactions[0]).toEqual(expect.objectContaining({
                amount: 3000.00,
                date: '05/01',
                description: expect.stringContaining('EMPLOYER')
            }));
        });

        it('should handle negative amounts', async () => {
            const parser = new PDFParserService();
            const result = await parser.parse(validPdfBuffer);

            expect(result.transactions[1]).toEqual(expect.objectContaining({
                amount: -150.00,
                date: '05/02',
                description: expect.stringContaining('GROCERY')
            }));
        });
    });

    describe('Bank Detection', () => {
        it('should detect Chase bank statements', async () => {
            const parser = new PDFParserService();
            const result = await parser.parse(validPdfBuffer);
            expect(result.metadata.bankName).toBe('Chase');
        });

        it('should reject unsupported bank formats', async () => {
            // Create an invalid PDF buffer
            const invalidPdfBuffer = Buffer.from([
                '%PDF-1.7',
                'UNKNOWN BANK Statement'
            ].join('\n'));

            const parser = new PDFParserService();
            await expect(parser.parse(invalidPdfBuffer))
                .rejects
                .toThrow('Failed to parse bank statement');
        });
    });
});
