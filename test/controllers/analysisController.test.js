const { AppError, PDFParseError, LLMError } = require('../../src/utils/errors');

// Mock services with their methods
jest.mock('../../src/services/pdfParserService', () => ({
    parsePDF: jest.fn()
}));

jest.mock('../../src/services/llmService', () => ({
    analyzeStatement: jest.fn()
}));

const pdfParserService = require('../../src/services/pdfParserService');
const llmService = require('../../src/services/llmService');
const analysisController = require('../../src/controllers/analysisController');

describe('Analysis Controller', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockReq = {
            file: {
                buffer: Buffer.from('test pdf content'),
                mimetype: 'application/pdf',
                size: 1024 * 1024
            }
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        mockNext = jest.fn();
    });

    it('should successfully analyze a bank statement', async () => {
        const mockParsedData = {
            transactions: [],
            accountInfo: {
                accountHolder: 'Test User',
                accountNumber: '****1234'
            }
        };

        const mockAnalysis = {
            success: true,
            data: {
                riskScore: 0.8,
                insights: ['Good cash flow']
            }
        };

        pdfParserService.parsePDF.mockResolvedValue(mockParsedData);
        llmService.analyzeStatement.mockResolvedValue(mockAnalysis);

        await analysisController.analyzeBankStatement(mockReq, mockRes, mockNext);

        expect(pdfParserService.parsePDF).toHaveBeenCalledWith(mockReq.file.buffer);
        expect(llmService.analyzeStatement).toHaveBeenCalledWith(mockParsedData);
        expect(mockRes.json).toHaveBeenCalledWith(mockAnalysis);
    });

    it('should handle missing PDF file', async () => {
        mockReq.file = undefined;

        await analysisController.analyzeBankStatement(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(
            expect.any(AppError)
        );
        expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
    });

    it('should handle PDF parsing errors', async () => {
        const parseError = new PDFParseError('Invalid PDF format');
        pdfParserService.parsePDF.mockRejectedValue(parseError);

        await analysisController.analyzeBankStatement(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(parseError);
        expect(llmService.analyzeStatement).not.toHaveBeenCalled();
    });

    it('should handle LLM service errors', async () => {
        const mockParsedData = { transactions: [] };
        const llmError = new LLMError('Analysis failed');

        pdfParserService.parsePDF.mockResolvedValue(mockParsedData);
        llmService.analyzeStatement.mockRejectedValue(llmError);

        await analysisController.analyzeBankStatement(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(llmError);
    });
});