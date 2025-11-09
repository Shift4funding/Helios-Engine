import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { StatementController } from '../controllers/statement.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateApiKey } from '../middleware/apiKeyAuth.js';
import logger from '../utils/logger.js';
import enhancedAnalysisRoutes from './enhancedAnalysisRoutes.js';

// Initialize router and controller
const router = express.Router();
const controller = new StatementController();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

/**
 * @swagger
 * /api/statements:
 *   get:
 *     summary: Statements API health check
 *     tags: [Statements]
 *     responses:
 *       200:
 *         description: API health status
 */
const healthCheckHandler = (req, res) => {
  res.json({
    success: true,
    message: 'Statements API is operational',
    timestamp: new Date().toISOString()
  });
};

// Health check (no auth required)
router.get('/health', healthCheckHandler);

// Maintain backwards compatibility with legacy root endpoints
router.post('/', authenticateToken, upload.single('statement'), controller.uploadStatement);
router.get('/', authenticateToken, controller.getStatements);

// Core endpoints
router.post('/upload', authenticateToken, upload.single('statement'), controller.uploadStatement);
router.get('/list', authenticateToken, controller.getStatements);
router.get('/:id', authenticateToken, controller.getStatement);
router.delete('/:id', authenticateToken, controller.deleteStatement);
router.post('/:id/analyze', authenticateToken, controller.analyzeStatement);
router.post('/:id/analyze-enhanced', authenticateToken, controller.analyzeStatement);
router.post('/:id/retry-analysis', authenticateToken, controller.retryProcessing);
router.get('/:id/analytics', authenticateToken, controller.getAnalytics);
router.get('/:id/analysis-history', authenticateToken, controller.getAnalysisHistory);
router.get('/:id/analysis-status', authenticateToken, controller.getAnalysisStatus);
router.get('/:id/analysis-report', authenticateToken, controller.getAnalysisReport);
router.get('/:id/download', authenticateToken, controller.downloadStatement);
router.post('/veritas', authenticateToken, controller.analyzeStatement);
router.post('/risk', authenticateToken, controller.analyzeStatement);
router.post('/:id/categorize', authenticateToken, controller.analyzeStatement);
router.put('/:id', authenticateToken, controller.updateStatement);

// Public API endpoints
router.post('/:id/analyze-public', validateApiKey, controller.analyzeStatement);
router.get('/:id/analytics-public', validateApiKey, controller.getAnalytics);
router.post('/veritas-public', validateApiKey, controller.analyzeStatement);
router.post('/risk-public', validateApiKey, controller.analyzeStatement);

// Core endpoints
router.post(
  '/analyze',
  authenticateToken,
  upload.single('file'),
  (req, res, next) => controller.analyzeStatement(req, res, next)
);

// Include enhanced analysis routes
router.use('/', enhancedAnalysisRoutes);

export default router;
