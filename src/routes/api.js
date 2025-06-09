import express from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import PDFParserService from '../services/pdfParserService';
import TransactionAnalysisService from '../services/transactionAnalysisService';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/analyze', auth, upload.single('statement'), async (req, res, next) => {
    try {
        const { bankType } = req.body;
        const parsedData = await PDFParserService.parseStatement(
            req.file.buffer, 
            bankType
        );
        const analysis = await TransactionAnalysisService.analyzeStatementData(
            parsedData.transactions
        );
        res.json(analysis);
    } catch (error) {
        next(error);
    }
});

router.get('/analysis/:id', auth, async (req, res, next) => {
    try {
        const analysis = await TransactionAnalysisService.getAnalysis(req.params.id);
        if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
        res.json(analysis);
    } catch (error) {
        next(error);
    }
});

router.get('/categories', auth, async (req, res, next) => {
    try {
        const categories = await TransactionAnalysisService.getCategories();
        res.json(categories);
    } catch (error) {
        next(error);
    }
});

router.get('/transactions/recurring', auth, async (req, res, next) => {
    try {
        const recurring = await TransactionAnalysisService.getRecurringTransactions(req.user.id);
        res.json(recurring);
    } catch (error) {
        next(error);
    }
});

router.get('/analysis/trends', auth, async (req, res, next) => {
    try {
        const trends = await TransactionAnalysisService.getTrends(req.user.id);
        res.json(trends);
    } catch (error) {
        next(error);
    }
});

export default router;