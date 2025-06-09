import express from 'express';
import multer from 'multer';
import { StatementController } from '../controllers/statementController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { validateStatementQuery } from '../schemas/statementSchema.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const statementController = new StatementController();

/**
 * @swagger
 * /api/statements/upload:
 *   post:
 *     summary: Upload a bank statement PDF
 *     description: Uploads and analyzes a bank statement PDF file
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: statement
 *         type: file
 *         required: true
 *         description: The bank statement PDF to upload
 *       - in: formData
 *         name: bankType
 *         type: string
 *         description: Type of bank statement (chase, wellsFargo, etc.)
 *     responses:
 *       200:
 *         description: Statement analyzed successfully
 *       400:
 *         description: Invalid input
 */
router.post('/upload',
    authenticate,
    upload.single('statement'),
    validate(validateStatementQuery),
    statementController.uploadAndAnalyze
);

router.get('/:id/analysis',
    authenticate,
    statementController.getAnalysis
);

router.get('/:id/query',
    authenticate,
    validate(validateStatementQuery),
    statementController.queryStatement
);

export default router;