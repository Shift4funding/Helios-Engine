// This file contains the logic for handling requests to analyze bank statements, including parsing the PDF and calling external LLM APIs.

const { AppError } = require('../utils/errors');
const pdfParserService = require('../services/pdfParserService');
const llmService = require('../services/llmService');
const { metrics } = require('../utils/metrics');

class AnalysisController {
    /**
     * Get analysis result by ID
     */
    static async getAnalysisResult(req, res, next) {
        try {
            const { id } = req.params;
            
            // TODO: Implement actual analysis retrieval logic
            const analysis = {
                id,
                status: 'completed',
                timestamp: new Date(),
                results: {}
            };

            if (!analysis) {
                return next(new AppError(404, 'Analysis not found'));
            }

            res.status(200).json({
                status: 'success',
                data: analysis
            });
        } catch (error) {
            next(new AppError(500, 'Error retrieving analysis'));
        }
    }

    /**
     * Analyze bank statement
     */
    async analyzeBankStatement(req, res, next) {
        const timer = metrics.bankStatementAnalysis.startTimer();
        
        try {
            if (!req.file) {
                throw new AppError(400, 'No PDF file uploaded');
            }

            const parsedData = await pdfParserService.parsePDF(req.file.buffer);
            const analysis = await llmService.analyzeStatement(parsedData);

            timer({ status: 'success' });
            res.json(analysis);
        } catch (error) {
            timer({ status: 'error' });
            next(error instanceof AppError ? error : new AppError(500, 'Internal server error'));
        }
    }
}

module.exports = new AnalysisController();