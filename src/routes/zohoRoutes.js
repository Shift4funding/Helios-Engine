import express from 'express';
import zohoCrmService from '../services/crm/zoho.service.js';
import { validateApiKey, validateZohoStartAnalysisApiKey } from '../middleware/apiKeyAuth.js';
import auth from '../middleware/auth.js';
import zohoController from '../controllers/zohoController.js';
import logger from '../utils/logger.js';
import { validateRequest, analysisRequestSchema } from '../validation/zodSchemas.js';

const router = express.Router();

// Middleware to pass the initialized CRM service to the request object
const provideCrmService = (req, res, next) => {
  req.crmService = zohoCrmService;
  next();
};

// ===== ANALYSIS ENDPOINTS =====

/**
 * @swagger
 * /api/zoho/start-analysis:
 *   post:
 *     summary: Start asynchronous analysis of bank statements for a Zoho deal
 *     tags: [Zoho]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dealId
 *             properties:
 *               dealId:
 *                 type: string
 *                 description: The Zoho CRM Deal ID
 *     responses:
 *       202:
 *         description: Analysis started successfully
 *       400:
 *         description: Deal ID is required
 *       500:
 *         description: Server error
 */
router.post(
    '/start-analysis', 
    validateZohoStartAnalysisApiKey, 
    validateRequest(analysisRequestSchema),
    provideCrmService, // Pass the service to the controller
    zohoController.startAnalysis
);

/**
 * @swagger
 * /api/zoho/analysis-status/{jobId}:
 *   get:
 *     summary: Get the status of an analysis job
 *     tags: [Zoho]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Analysis job ID
 *     responses:
 *       200:
 *         description: Job status retrieved successfully
 *       404:
 *         description: Job not found
 */
router.get(
    '/analysis-status/:jobId', 
    validateApiKey, 
    auth.authenticateToken, 
    zohoController.getAnalysisStatus
);

// ===== DEBUG & TEST ENDPOINTS =====

/**
 * @swagger
 * /api/zoho/test-attachments/{dealId}:
 *   get:
 *     summary: Test fetching attachments for a deal
 *     tags: [Zoho, Debug]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: dealId
 *         required: true
 *         schema:
 *           type: string
 *         description: The Zoho CRM Deal ID to test
 *     responses:
 *       200:
 *         description: Attachments fetched successfully
 *       500:
 *         description: Error fetching attachments
 */
router.get('/test-attachments/:dealId', provideCrmService, async (req, res) => {
    try {
        const { dealId } = req.params;
        logger.info(`Executing test attachment fetch for deal ID: ${dealId}`);
        const attachments = await req.crmService.getAttachmentsForDeal(dealId);
        res.status(200).json({
            success: true,
            message: `Found and processed ${attachments.length} attachments.`,
            data: attachments.map(a => ({
                id: a.id,
                fileName: a.File_Name,
                filePath: a.filePath,
                source: a.source,
                size: a.Size,
            })),
        });
    } catch (error) {
        logger.error(`Failed to test attachments for deal ${req.params.dealId}`, {
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch attachments',
            message: error.message,
        });
    }
});

export default router;
