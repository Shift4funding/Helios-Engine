import { jest } from '@jest/globals';
import { PDFParserService, pdfParserService } from '../../src/services/pdfParserService.js';
import { PDFParseError } from '../../src/utils/errors.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('PDFParserService', () => {
    let service;
    let mockBuffer;
    
    beforeEach(() => {
        service = new PDFParserService();
        mockBuffer = Buffer.from('mock PDF content');
        jest.clearAllMocks();
    });

    afterEach(() => {
        service.cleanup();
    });

    it('should successfully parse a PDF file', async () => {
        // Mock successful PDF parsing
        const mockParsedData = {
            Pages: [{
                Texts: [
                    { y: 750, R: [{ T: 'John' }] },
                    { y: 750, R: [{ T: 'Doe' }] },
                    { R: [{ T: 'Account: *1234' }] }
                ]
            }]
        };

        jest.spyOn(service, '_parsePDFBuffer').mockResolvedValue(mockParsedData);

        const result = await service.parsePDF(mockBuffer);

        expect(result).toEqual(expect.objectContaining({
            accountHolder: 'John Doe',
            accountNumber: expect.stringContaining('1234')
        }));
    });

    it('should handle parsing errors', async () => {
        jest.spyOn(pdfParserService, 'parsePDF').mockRejectedValue(
            new PDFParseError('Parse failed')
        );

        await expect(pdfParserService.parsePDF('test.pdf'))
            .rejects
            .toThrow(PDFParseError);

        expect(pdfParserService.parsePDF).toHaveBeenCalled();
    });

    it('should extract account information correctly', async () => {
        const mockPdfData = {
            Pages: [{
                Texts: [
                    { y: 750, R: [{ T: 'Test' }] },
                    { y: 750, R: [{ T: 'User' }] },
                    { R: [{ T: '*5678' }] }
                ]
            }]
        };

        const accountInfo = service._extractAccountInfo(mockPdfData);

        expect(accountInfo).toEqual({
            accountHolder: 'Test User',
            accountNumber: '*5678',
            period: { from: '', to: '' }
        });
    });

    it('should handle missing account information', async () => {
        const mockPdfData = { Pages: [{ Texts: [] }] };
        const accountInfo = service._extractAccountInfo(mockPdfData);

        expect(accountInfo).toEqual({
            accountHolder: 'Unknown',
            accountNumber: 'Unknown',
            period: { from: '', to: '' }
        });
    });
});