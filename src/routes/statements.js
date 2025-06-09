const express = require('express');
const router = express.Router();
const pdfParserService = require('../services/pdfParserService');

router.post('/analyze', async (req, res) => {
    try {
        const result = await pdfParserService.parsePDF(req.files.statement.data);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;