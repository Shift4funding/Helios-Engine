/**
 * Statement Processing Worker
 * 
 * Handles the complete statement processing pipeline from upload
 * to final analysis using Redis Streams and AI categorization cache.
 */

import redisStreamService from '../services/redisStreamService.js';
import logger from '../utils/logger.js';
import Statement from '../models/Statement.js';
import Transaction from '../models/Transaction.js';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';

class StatementProcessingWorker {
  constructor() {
    this.workerName = `statement-processor-${process.pid}`;
    this.isRunning = false;
    this.processedCount = 0;
    this.errorCount = 0;
    
    // Bind methods to preserve context
    this.processStatementJob = this.processStatementJob.bind(this);
    this.handleShutdown = this.handleShutdown.bind(this);
    
    // Set up graceful shutdown
    process.on('SIGINT', this.handleShutdown);
    process.on('SIGTERM', this.handleShutdown);
  }

  async start() {
    try {
      logger.info(`Starting Statement Processing Worker: ${this.workerName}`);
      
      // Wait for Redis connection
      if (!redisStreamService.isConnected) {
        await new Promise((resolve) => {
          redisStreamService.once('connected', resolve);
        });
      }

      this.isRunning = true;
      
      // Start processing statement jobs
      await redisStreamService.startWorker(
        redisStreamService.streams.STATEMENT_PROCESSING,
        redisStreamService.consumerGroups.STATEMENT_WORKERS,
        this.workerName,
        this.processStatementJob,
        {
          batchSize: 1, // Process one statement at a time for resource management
          blockTime: 5000 // Wait 5 seconds for new messages
        }
      );
      
    } catch (error) {
      logger.error('Error starting statement processing worker:', error);
      throw error;
    }
  }

  async processStatementJob(data, messageId, context) {
    const startTime = Date.now();
    
    try {
      logger.info(`Processing statement job ${messageId}`, {
        type: data.type,
        correlationId: data.correlation_id,
        statementId: data.payload?.statementId
      });

      switch (data.type) {
        case 'PROCESS_UPLOADED_STATEMENT':
          return await this.processUploadedStatement(data.payload, messageId);
          
        case 'PARSE_STATEMENT_FILE':
          return await this.parseStatementFile(data.payload, messageId);
          
        case 'EXTRACT_TRANSACTIONS':
          return await this.extractTransactions(data.payload, messageId);
          
        case 'VALIDATE_STATEMENT_DATA':
          return await this.validateStatementData(data.payload, messageId);
          
        case 'FINALIZE_STATEMENT_PROCESSING':
          return await this.finalizeStatementProcessing(data.payload, messageId);
          
        default:
          throw new Error(`Unknown statement processing job type: ${data.type}`);
      }
      
    } catch (error) {
      logger.error(`Error processing statement job ${messageId}:`, error);
      throw error;
    } finally {
      const processingTime = Date.now() - startTime;
      logger.debug(`Statement job ${messageId} completed in ${processingTime}ms`);
    }
  }

  async processUploadedStatement(payload, messageId) {
    try {
      const { statementId, filePath, userId, uploadMetadata } = payload;
      
      // Update statement status to processing
      await Statement.findByIdAndUpdate(statementId, {
        'processing.status': 'PROCESSING',
        'processing.startedAt': new Date(),
        'processing.stages.upload': {
          status: 'COMPLETED',
          completedAt: new Date(),
          metadata: uploadMetadata
        }
      });

      logger.info(`Starting processing for statement ${statementId}`);

      // Queue file parsing
      await redisStreamService.addToStream(
        redisStreamService.streams.STATEMENT_PROCESSING,
        {
          type: 'PARSE_STATEMENT_FILE',
          payload: {
            statementId,
            filePath,
            userId
          },
          correlationId: payload.correlationId || messageId
        }
      );

      this.processedCount++;

      return {
        success: true,
        statementId,
        status: 'PROCESSING_STARTED',
        nextStage: 'PARSING'
      };

    } catch (error) {
      this.errorCount++;
      
      // Update statement with error status
      if (payload.statementId) {
        await Statement.findByIdAndUpdate(payload.statementId, {
          'processing.status': 'FAILED',
          'processing.error': {
            message: error.message,
            stage: 'UPLOAD_PROCESSING',
            timestamp: new Date()
          }
        });
      }
      
      logger.error('Error processing uploaded statement:', error);
      throw error;
    }
  }

  async parseStatementFile(payload, messageId) {
    try {
      const { statementId, filePath, userId } = payload;
      
      // Update statement status
      await Statement.findByIdAndUpdate(statementId, {
        'processing.stages.parsing': {
          status: 'PROCESSING',
          startedAt: new Date()
        }
      });

      logger.info(`Parsing statement file for ${statementId}: ${filePath}`);

      // Parse the statement file (this would use your existing parsing logic)
      const parseResult = await this.parseStatementFileContent(filePath);

      // Update statement with parsed data
      await Statement.findByIdAndUpdate(statementId, {
        'processing.stages.parsing': {
          status: 'COMPLETED',
          completedAt: new Date(),
          metadata: {
            lineCount: parseResult.lineCount,
            detectedFormat: parseResult.format,
            dateRange: parseResult.dateRange
          }
        },
        parsedData: parseResult.data,
        metadata: {
          ...parseResult.metadata,
          fileInfo: {
            originalName: path.basename(filePath),
            size: parseResult.fileSize,
            format: parseResult.format
          }
        }
      });

      // Queue transaction extraction
      await redisStreamService.addToStream(
        redisStreamService.streams.STATEMENT_PROCESSING,
        {
          type: 'EXTRACT_TRANSACTIONS',
          payload: {
            statementId,
            parsedData: parseResult.data,
            userId
          },
          correlationId: payload.correlationId || messageId
        }
      );

      return {
        success: true,
        statementId,
        parseResult: {
          lineCount: parseResult.lineCount,
          format: parseResult.format,
          transactionCount: parseResult.transactionCount
        }
      };

    } catch (error) {
      this.errorCount++;
      
      // Update statement with error
      await Statement.findByIdAndUpdate(payload.statementId, {
        'processing.stages.parsing': {
          status: 'FAILED',
          error: error.message,
          failedAt: new Date()
        }
      });
      
      logger.error('Error parsing statement file:', error);
      throw error;
    }
  }

  async extractTransactions(payload, messageId) {
    try {
      const { statementId, parsedData, userId } = payload;
      
      // Update statement status
      await Statement.findByIdAndUpdate(statementId, {
        'processing.stages.extraction': {
          status: 'PROCESSING',
          startedAt: new Date()
        }
      });

      logger.info(`Extracting transactions for statement ${statementId}`);

      // Extract transactions from parsed data
      const transactions = await this.extractTransactionsFromData(parsedData, statementId);

      // Save transactions to database
      const savedTransactions = await Transaction.insertMany(
        transactions.map(tx => ({
          ...tx,
          statementId: new mongoose.Types.ObjectId(statementId),
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: new Date()
        }))
      );

      // Update statement with extraction results
      await Statement.findByIdAndUpdate(statementId, {
        'processing.stages.extraction': {
          status: 'COMPLETED',
          completedAt: new Date(),
          metadata: {
            extractedTransactions: savedTransactions.length,
            totalAmount: transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
          }
        },
        transactionCount: savedTransactions.length
      });

      // Queue data validation
      await redisStreamService.addToStream(
        redisStreamService.streams.STATEMENT_PROCESSING,
        {
          type: 'VALIDATE_STATEMENT_DATA',
          payload: {
            statementId,
            transactionIds: savedTransactions.map(tx => tx._id.toString()),
            userId
          },
          correlationId: payload.correlationId || messageId
        }
      );

      return {
        success: true,
        statementId,
        transactionCount: savedTransactions.length,
        transactionIds: savedTransactions.map(tx => tx._id.toString())
      };

    } catch (error) {
      this.errorCount++;
      
      // Update statement with error
      await Statement.findByIdAndUpdate(payload.statementId, {
        'processing.stages.extraction': {
          status: 'FAILED',
          error: error.message,
          failedAt: new Date()
        }
      });
      
      logger.error('Error extracting transactions:', error);
      throw error;
    }
  }

  async validateStatementData(payload, messageId) {
    try {
      const { statementId, transactionIds, userId } = payload;
      
      // Update statement status
      await Statement.findByIdAndUpdate(statementId, {
        'processing.stages.validation': {
          status: 'PROCESSING',
          startedAt: new Date()
        }
      });

      logger.info(`Validating data for statement ${statementId}`);

      // Perform data validation
      const validationResult = await this.validateTransactionData(statementId, transactionIds);

      // Update statement with validation results
      await Statement.findByIdAndUpdate(statementId, {
        'processing.stages.validation': {
          status: 'COMPLETED',
          completedAt: new Date(),
          metadata: validationResult
        }
      });

      // If validation passes, queue categorization
      if (validationResult.isValid) {
        await redisStreamService.addToStream(
          redisStreamService.streams.TRANSACTION_CATEGORIZATION,
          {
            type: 'CATEGORIZE_STATEMENT_TRANSACTIONS',
            payload: {
              statementId,
              userId,
              nextStage: 'ANALYSIS'
            },
            correlationId: payload.correlationId || messageId
          }
        );
      } else {
        // If validation fails, still finalize but mark with warnings
        await redisStreamService.addToStream(
          redisStreamService.streams.STATEMENT_PROCESSING,
          {
            type: 'FINALIZE_STATEMENT_PROCESSING',
            payload: {
              statementId,
              userId,
              status: 'COMPLETED_WITH_WARNINGS',
              warnings: validationResult.errors
            },
            correlationId: payload.correlationId || messageId
          }
        );
      }

      return {
        success: true,
        statementId,
        validationResult
      };

    } catch (error) {
      this.errorCount++;
      
      // Update statement with error
      await Statement.findByIdAndUpdate(payload.statementId, {
        'processing.stages.validation': {
          status: 'FAILED',
          error: error.message,
          failedAt: new Date()
        }
      });
      
      logger.error('Error validating statement data:', error);
      throw error;
    }
  }

  async finalizeStatementProcessing(payload, messageId) {
    try {
      const { statementId, userId, status = 'COMPLETED', warnings = [] } = payload;
      
      const statement = await Statement.findById(statementId);
      if (!statement) {
        throw new Error(`Statement ${statementId} not found`);
      }

      // Calculate final processing statistics
      const transactions = await Transaction.find({ statementId });
      const categorizedTransactions = transactions.filter(tx => tx.category);
      
      const finalStats = {
        totalTransactions: transactions.length,
        categorizedTransactions: categorizedTransactions.length,
        categorizationRate: transactions.length > 0 ? 
          (categorizedTransactions.length / transactions.length) * 100 : 0,
        totalAmount: transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
        processingTime: Date.now() - new Date(statement.processing.startedAt).getTime()
      };

      // Update statement final status
      await Statement.findByIdAndUpdate(statementId, {
        'processing.status': status,
        'processing.completedAt': new Date(),
        'processing.finalStats': finalStats,
        'processing.warnings': warnings.length > 0 ? warnings : undefined
      });

      // Emit completion event
      await redisStreamService.addToStream(
        redisStreamService.streams.NOTIFICATIONS,
        {
          type: 'STATEMENT_PROCESSING_COMPLETED',
          payload: {
            statementId,
            userId,
            status,
            stats: finalStats,
            warnings
          },
          correlationId: payload.correlationId || messageId
        }
      );

      this.processedCount++;

      logger.info(`Statement processing completed for ${statementId}`, {
        status,
        stats: finalStats,
        warnings: warnings.length
      });

      return {
        success: true,
        statementId,
        status,
        finalStats,
        warnings
      };

    } catch (error) {
      this.errorCount++;
      logger.error('Error finalizing statement processing:', error);
      throw error;
    }
  }

  // Helper methods for statement processing

  async parseStatementFileContent(filePath) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      // This is a simplified parser - you would implement your actual parsing logic here
      const transactions = [];
      let format = 'unknown';
      let dateRange = { start: null, end: null };
      
      // Detect format and parse transactions
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip headers and empty lines
        if (!line || line.includes('Date') || line.includes('Transaction')) {
          continue;
        }
        
        // Simple CSV parsing (you would use a proper CSV parser)
        const parts = line.split(',').map(p => p.trim().replace(/"/g, ''));
        
        if (parts.length >= 3) {
          const transaction = {
            date: new Date(parts[0]),
            description: parts[1],
            amount: parseFloat(parts[2]) || 0
          };
          
          if (!isNaN(transaction.date.getTime()) && transaction.amount !== 0) {
            transactions.push(transaction);
            
            // Update date range
            if (!dateRange.start || transaction.date < dateRange.start) {
              dateRange.start = transaction.date;
            }
            if (!dateRange.end || transaction.date > dateRange.end) {
              dateRange.end = transaction.date;
            }
          }
        }
      }
      
      format = transactions.length > 0 ? 'csv' : 'unknown';
      
      const stats = await fs.stat(filePath);
      
      return {
        data: transactions,
        lineCount: lines.length,
        transactionCount: transactions.length,
        format,
        dateRange,
        fileSize: stats.size,
        metadata: {
          parseMethod: 'simple_csv',
          parsedAt: new Date()
        }
      };
      
    } catch (error) {
      logger.error('Error parsing statement file content:', error);
      throw error;
    }
  }

  async extractTransactionsFromData(parsedData, statementId) {
    try {
      // Convert parsed data to transaction format
      return parsedData.map((item, index) => ({
        date: item.date,
        description: item.description,
        amount: item.amount,
        type: item.amount > 0 ? 'CREDIT' : 'DEBIT',
        balance: item.balance || null,
        referenceNumber: item.referenceNumber || `${statementId}-${index}`,
        metadata: {
          originalIndex: index,
          rawData: item
        }
      }));
    } catch (error) {
      logger.error('Error extracting transactions from data:', error);
      throw error;
    }
  }

  async validateTransactionData(statementId, transactionIds) {
    try {
      const transactions = await Transaction.find({ _id: { $in: transactionIds } });
      
      const validationErrors = [];
      let validTransactions = 0;
      
      for (const transaction of transactions) {
        // Validate date
        if (!transaction.date || isNaN(transaction.date.getTime())) {
          validationErrors.push(`Invalid date for transaction ${transaction._id}`);
          continue;
        }
        
        // Validate amount
        if (transaction.amount === 0 || isNaN(transaction.amount)) {
          validationErrors.push(`Invalid amount for transaction ${transaction._id}`);
          continue;
        }
        
        // Validate description
        if (!transaction.description || transaction.description.trim().length === 0) {
          validationErrors.push(`Missing description for transaction ${transaction._id}`);
          continue;
        }
        
        validTransactions++;
      }
      
      const validationRate = transactions.length > 0 ? 
        (validTransactions / transactions.length) * 100 : 0;
      
      return {
        isValid: validationErrors.length === 0,
        totalTransactions: transactions.length,
        validTransactions,
        validationRate,
        errors: validationErrors
      };
      
    } catch (error) {
      logger.error('Error validating transaction data:', error);
      throw error;
    }
  }

  async getWorkerStats() {
    return {
      workerName: this.workerName,
      isRunning: this.isRunning,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      successRate: this.processedCount > 0 ? 
        ((this.processedCount - this.errorCount) / this.processedCount) * 100 : 0,
      uptime: process.uptime()
    };
  }

  async handleShutdown(signal) {
    logger.info(`Received ${signal}, shutting down statement processing worker gracefully...`);
    this.isRunning = false;
    
    // Give time for current processing to complete
    setTimeout(() => {
      process.exit(0);
    }, 10000); // 10 seconds for statement processing
  }
}

// Start worker if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const worker = new StatementProcessingWorker();
  
  worker.start().catch((error) => {
    logger.error('Failed to start statement processing worker:', error);
    process.exit(1);
  });
}

export default StatementProcessingWorker;
