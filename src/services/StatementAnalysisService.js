import { PDFParserService } from './PDFParserService.js';
import { LLMService } from './LLMService.js';

export class StatementAnalysisService {
    constructor() {
        this.pdfParser = new PDFParserService();
        this.llmService = new LLMService();
    }

    async analyzeStatement(pdfBuffer) {
        const parsedData = await this.pdfParser.parse(pdfBuffer);
        const llmAnalysis = await this.llmService.analyzeStatementData(parsedData);

        return {
            ...parsedData,
            analysis: llmAnalysis
        };
    }
}