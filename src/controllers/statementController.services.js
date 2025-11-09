import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs/promises';
import Statement from '../models/Statement.js';
import Transaction from '../models/Transaction.js';
import { AppError } from '../utils/errors.js';
import PDFParserService from '../services/PDFParserService.js';
import { service as riskAnalysisService } from '../services/riskAnalysisService.js';
import NotificationService from '../services/NotificationService.js';
import logger from '../utils/logger.js';

class StatementController {
  constructor() {
    this.pdfParser = new PDFParserService();
    this.riskAnalyzer = riskAnalysisService;
    
    // Bind methods to ensure 'this' context is preserved
    this.uploadStatement = this.uploadStatement.bind(this);
    this.getStatements = this.getStatements.bind(this);
    this.getStatementById = this.getStatementById.bind(this);
    this.analyzeStatement = this.analyzeStatement.bind(this);
    this.deleteStatement = this.deleteStatement.bind(this);
  }

  async uploadStatement(req, res, next) {
    try {
      const userId = req.user.id;
      const { statementDate, accountNumber, bankName, uploadId } = req.body;
      
      logger.info('Upload request received', { userId, body: req.body, file: req.file });
      
      if (!req.file) {
        throw new AppError('No file uploaded', 400);
      }

      // Generate uploadId if not provided
      const finalUploadId = uploadId || `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create upload directory
      const uploadDir = path.join(process.cwd(), 'uploads', finalUploadId);
      await fs.mkdir(uploadDir, { recursive: true });

      // Save file
      const fileName = `statement_${Date.now()}.pdf`;
      const filePath = path.join(uploadDir, fileName);
      await fs.writeFile(filePath, req.file.buffer);

      // Create statement document
      const newStatement = await Statement.create({
        userId: new mongoose.Types.ObjectId(userId),
        uploadId: finalUploadId,
        statementDate: new Date(statementDate || Date.now()),
        fileName: req.file.originalname,
        fileUrl: `/uploads/${finalUploadId}/${fileName}`,
        bankName: bankName || 'Unknown Bank',
        accountNumber: accountNumber || 'Unknown',
        openingBalance: 0,
        closingBalance: 0,
        status: 'processing',
        metadata: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });

      logger.info('Statement created successfully', { statementId: newStatement._id });

      // Notify user of upload
      await NotificationService.notifyStatementUploaded(userId, newStatement._id, req.file.originalname);

      // Trigger async processing
      this.processStatementAsync(newStatement._id, filePath, userId).catch(error => {
        logger.error('Async processing failed', error);
      });

      res.status(201).json({ 
        success: true, 
        data: { 
          statement: newStatement,
          message: 'Statement uploaded successfully. Processing will begin shortly.'
        } 
      });

    } catch (error) {
      logger.error('Error uploading statement:', error);
      next(error);
    }
  }

  async processStatementAsync(statementId, filePath, userId) {
    try {
      logger.info('Starting async statement processing', { statementId });
      
      // Update status to processing
      await Statement.findByIdAndUpdate(statementId, { 
        status: 'processing',
        processingStartedAt: new Date()
      });

      // Extract transactions from PDF
      const transactions = await this.pdfParser.extractTransactions(filePath);
      
      // Get statement for analysis
      const statement = await Statement.findById(statementId);
      
      // Perform risk analysis
      const analysis = this.riskAnalyzer.analyze(transactions, statement);
      
      // Save transactions if any
      if (transactions && transactions.length > 0) {
        const transactionDocs = transactions.map(t => ({
          ...t,
          statementId: statement._id,
          userId: statement.userId
        }));
        
        await Transaction.insertMany(transactionDocs);
      }
      
      // Update statement with results
      await Statement.findByIdAndUpdate(statementId, {
        status: 'completed',
        processingCompletedAt: new Date(),
        transactionCount: transactions.length,
        analysis: analysis
      });

      logger.info('Statement processing completed', { statementId });

      // Notify user of completion
      await NotificationService.notifyStatementProcessed(userId, statementId, 'completed');

      // If high risk, send alert
      if (analysis.riskScore === 'High') {
        await NotificationService.notifyRiskAlert(userId, statementId, analysis);
      }

    } catch (error) {
      logger.error('Error processing statement:', error);
      
      await Statement.findByIdAndUpdate(statementId, { 
        status: 'failed',
        error: error.message 
      });

      await NotificationService.notifyStatementProcessed(userId, statementId, 'failed');
    }
  }

  async getStatements(req, res, next) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 }
      };
      
      const result = await Statement.paginate({ userId: new mongoose.Types.ObjectId(userId) }, options);
      
      res.status(200).json({ 
        success: true, 
        data: { 
          statements: result.docs
        },
        pagination: {
          total: result.totalDocs,
          page: result.page,
          pages: result.totalPages,
          limit: result.limit
        }
      });
    } catch (error) {
      logger.error('Error getting statements:', error);
      next(error);
    }
  }

  async getStatementById(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const statement = await Statement.findOne({
        _id: id,
        userId: new mongoose.Types.ObjectId(userId)
      });

      if (!statement) {
        return res.status(404).json({ error: 'Statement not found' });
      }

      res.status(200).json({ success: true, data: { statement } });
    } catch (error) {
      logger.error('Error getting statement:', error);
      next(error);
    }
  }

  async analyzeStatement(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Find the statement
      const statement = await Statement.findOne({
        _id: id,
        userId: new mongoose.Types.ObjectId(userId)
      });

      if (!statement) {
        return res.status(404).json({ error: 'Statement not found' });
      }

      // Get transactions for this statement
      const transactions = await Transaction.find({ statementId: statement._id });

      // Perform risk analysis
      const analysis = this.riskAnalyzer.analyze(transactions, statement);

      // Update statement with analysis
      await Statement.findByIdAndUpdate(statement._id, {
        analysis: analysis,
        lastAnalyzedAt: new Date()
      });

      res.status(200).json({ 
        success: true, 
        data: { 
          analysis,
          statement: {
            id: statement._id,
            fileName: statement.fileName,
            bankName: statement.bankName,
            statementDate: statement.statementDate
          }
        } 
      });
    } catch (error) {
      logger.error('Error analyzing statement:', error);
      next(error);
    }
  }

  async deleteStatement(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const statement = await Statement.findOneAndDelete({
        _id: id,
        userId: new mongoose.Types.ObjectId(userId)
      });

      if (!statement) {
        return res.status(404).json({ error: 'Statement not found' });
      }

      // Delete associated transactions
      await Transaction.deleteMany({ statementId: statement._id });

      // Try to delete the file (don't fail if file doesn't exist)
      if (statement.fileUrl) {
        try {
          const filePath = path.join(process.cwd(), statement.fileUrl);
          await fs.unlink(filePath);
        } catch (error) {
          logger.warn('Failed to delete file', { error: error.message, fileUrl: statement.fileUrl });
        }
      }

      res.status(200).json({ 
        success: true, 
        message: 'Statement deleted successfully' 
      });
    } catch (error) {
      logger.error('Error deleting statement:', error);
      next(error);
    }
  }
}

export default StatementController;
