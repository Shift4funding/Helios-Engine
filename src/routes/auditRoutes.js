const express = require('express');
const { getAnalysisHistory } = require('../controllers/analysisController');
const router = express.Router();

router.get('/history', getAnalysisHistory);

module.exports = router;