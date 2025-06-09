const express = require('express');
const multer = require('multer');
const router = express.Router();
const TransactionAnalysisService = require('../services/transactionAnalysisService');
const PDFProcessingService = require('../services/pdfProcessingService');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

router.post('/upload', upload.single('statement'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file provided' });
        }

        const pdfService = new PDFProcessingService();
        const analysisService = new TransactionAnalysisService();

        const transactions = await pdfService.extractTransactions(req.file.buffer);
        const analysis = await analysisService.analyzeBusinessMetrics(transactions);

        res.json(analysis);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const analysis = await TransactionAnalysisService.getAnalysisById(req.params.id);
        if (!analysis) {
            return res.status(404).json({ error: 'Analysis not found' });
        }
        res.json(analysis);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;