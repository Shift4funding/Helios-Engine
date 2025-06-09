const express = require('express');
const queryController = require('../controllers/queryController');
const { validateRequest } = require('../middleware/validateRequest');
const { queryValidation } = require('../validations');
const { validateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/query:
 *   post:
 *     summary: Process a natural language query about a bank statement analysis
 *     tags: [Query]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - analysisId
 *               - question
 *             properties:
 *               analysisId:
 *                 type: string
 *                 description: ID of the analysis to query
 *               question:
 *                 type: string
 *                 description: Natural language question about the bank statement
 *     responses:
 *       200:
 *         description: Successful query response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized - invalid or missing API key
 *       404:
 *         description: Analysis not found
 *       500:
 *         description: Server error
 */
router.post('/query', validateToken, validateRequest(queryValidation.processQuery), queryController.processQuery);

/**
 * @swagger
 * /api/query/suggested/{analysisId}:
 *   get:
 *     summary: Get suggested questions for a specific analysis
 *     tags: [Query]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: analysisId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the analysis
 *     responses:
 *       200:
 *         description: List of suggested questions by category
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized - invalid or missing API key
 *       404:
 *         description: Analysis not found
 *       500:
 *         description: Server error
 */
router.get('/query/suggested/:analysisId', validateToken, queryController.getSuggestedQuestions);

/**
 * @swagger
 * /api/query/recent/{analysisId}:
 *   get:
 *     summary: Get recent queries for a specific analysis
 *     tags: [Query]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: analysisId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the analysis
 *     responses:
 *       200:
 *         description: List of recent queries for the analysis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized - invalid or missing API key
 *       404:
 *         description: Analysis not found
 *       500:
 *         description: Server error
 */
router.get('/query/recent/:analysisId', validateToken, queryController.getRecentQueries);

module.exports = router;
