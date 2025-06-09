import { PDFParserService } from '../services/PDFParserService.js';
import { LLMService } from '../services/llmService.js';
import { ZohoCRMService } from '../services/zohoCRMService.js';
import { StatementRepository } from '../repositories/statementRepository.js';
import { logger } from '../utils/logger.js';
import { cache } from '../utils/cache.js';

export class StatementController {
    constructor() {
        this.pdfParser = new PDFParserService();
        this.llmService = new LLMService();
        this.zohoService = new ZohoCRMService();
        this.repository = new StatementRepository();
    }

    uploadAndAnalyze = async (req, res, next) => {
        try {
            const { applicationId } = req.body;
            const pdfBuffer = req.file.buffer;

            // Parse PDF
            const parsedData = await this.pdfParser.parse(pdfBuffer);
            
            // Analyze with LLM
            const analysis = await this.llmService.analyzeStatementData(parsedData);

            // Store results
            const result = await this.repository.create({
                applicationId,
                parsedData,
                analysis,
                userId: req.user.id
            });

            // Update Zoho CRM
            await this.zohoService.updateApplication({
                applicationId,
                ...analysis
            });

            // Cache analysis results
            await cache.set(`analysis:${result._id}`, analysis);

            res.status(201).json({
                id: result._id,
                status: 'success',
                analysis
            });
        } catch (error) {
            logger.error('Statement analysis failed:', error);
            next(error);
        }
    };

    getAnalysis = async (req, res, next) => {
        try {
            const { id } = req.params;

            // Check cache first
            const cached = await cache.get(`analysis:${id}`);
            if (cached) {
                return res.json(cached);
            }

            const analysis = await this.repository.findById(id);
            if (!analysis) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Analysis not found'
                });
            }

            res.json(analysis);
        } catch (error) {
            next(error);
        }
    };
}