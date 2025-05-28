// File: /bank-statement-analyzer-api/src/routes/analysisRoutes.js

const express = require('express');
const multer = require('multer');
const analysisController = require('../controllers/analysisController');

const router = express.Router();
const upload = multer({ dest: 'uploads/' }); // Configure multer for file uploads

// Route for uploading and analyzing bank statement PDFs
router.post('/analyze', upload.single('statement'), analysisController.analyzeStatement);

// Future routes can be added here

module.exports = router;