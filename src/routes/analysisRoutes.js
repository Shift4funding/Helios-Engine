// File: /bank-statement-analyzer-api/src/routes/analysisRoutes.js

const express = require('express');
const router = express.Router();
const fileUpload = require('../middleware/fileUpload');
const AnalysisController = require('../controllers/analysisController');
const security = require('../middleware/security');
const { validateRequest } = require('../middleware/validateRequest');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * /api/analysis/statement:
 *   post:
 *     summary: Upload and analyze bank statement
 *     description: Upload and analyze a PDF bank statement
 *     tags: [Analysis]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               bankStatement:
 *                 type: string
 *                 format: binary
 *                 description: PDF bank statement file (max 10MB)
 *     responses:
 *       200:
 *         description: Analysis completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 analysisId:
 *                   type: string
 *                   description: Unique identifier for the analysis
 *                 status:
 *                   type: string
 *                   enum: [completed, processing, failed]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 *                 details:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       413:
 *         description: File too large
 *       415:
 *         description: Unsupported file type
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /api/analysis/{id}:
 *   get:
 *     summary: Get analysis details by ID
 *     description: Retrieve the results of a specific bank statement analysis
 *     tags: [Analysis]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Analysis ID
 *     responses:
 *       200:
 *         description: Analysis details retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Analysis not found
 *       500:
 *         description: Server error
 */
router.get('/:id', AnalysisController.getAnalysisById);

router.post('/statement',
    fileUpload.handleUpload('bankStatement'),
    security.validatePDF,
    AnalysisController.analyzeBankStatement
);

router.post('/analyze', authenticateToken, async (req, res) => {
    // ...existing code...
});

module.exports = router;
