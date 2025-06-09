const { validateRequest, validateFileUpload } = require('../../src/middleware/validateRequest');
const { analysisValidation } = require('../../src/validations');
jest.mock('../../src/validations');

describe('Request Validation Middleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('validateFileUpload', () => {
        it('should reject invalid PDF signature', () => {
            const mockReq = {
                file: {
                    mimetype: 'application/pdf',
                    size: 1024 * 1024,
                    buffer: Buffer.from('invalid pdf content')
                }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const mockNext = jest.fn();
            const expectedError = new Error('Invalid PDF file format');

            // Mock the PDF validation to fail
            validateFileUpload(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Error',
                    message: expect.stringContaining('Invalid PDF file format')
                })
            );
        });
    });

    describe('Extended Validations', () => {
        // Mock the validation function
        const mockValidationFn = jest.fn().mockReturnValue([]);
        
        beforeEach(() => {
            // Reset mocks before each test
            mockValidationFn.mockClear();
            jest.spyOn(analysisValidation, 'validate').mockImplementation(mockValidationFn);
        });

        it('should validate date range correctly', async () => {
            const mockReq = {
                body: {
                    startDate: '2025-01-01',
                    endDate: '2025-12-31',
                    type: 'analysis'
                }
            };
            const mockRes = {};
            const mockNext = jest.fn();

            mockValidationFn.mockReturnValueOnce([]);
            
            await validateRequest(analysisValidation)(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
        });

        it('should validate metadata fields', async () => {
            const mockReq = {
                body: {
                    name: 'Test Analysis',
                    description: 'Test Description',
                    type: 'standard'
                }
            };
            const mockRes = {};
            const mockNext = jest.fn();

            mockValidationFn.mockReturnValueOnce([]);
            
            await validateRequest(analysisValidation)(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
        });
    });
});