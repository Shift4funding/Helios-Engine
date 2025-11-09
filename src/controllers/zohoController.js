import { Types } from 'mongoose';
import redisStreamService from '../services/redisStreamService.js';
// The controller no longer initializes the service. It will be passed via middleware.
// import ZohoCrmService from '../services/crm/zoho.service.js';
import Statement from '../models/Statement.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { validateRequest, analysisRequestSchema, jobIdSchema } from '../validation/zodSchemas.js';
import { jobMetrics, zohoMetrics } from '../monitoring/metrics.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'tmp', 'uploads');

class ZohoController {
  constructor() {
    // this.zohoCrmService = null; // Service is now injected
    this.integrationUserId = this.resolveIntegrationUserId();
    // this.initializeZohoCrmService(); // Service is now injected

    // Bind methods to preserve 'this' context
    this.startAnalysis = this.startAnalysis.bind(this);
    this.getAnalysisStatus = this.getAnalysisStatus.bind(this);
    this.handleMissingZohoDeal = this.handleMissingZohoDeal.bind(this);
  }

  resolveIntegrationUserId() {
    const candidateIds = [
      process.env.ZOHO_INTEGRATION_USER_ID,
      process.env.SYSTEM_USER_ID,
      process.env.DEFAULT_USER_ID
    ].filter(Boolean);

    for (const id of candidateIds) {
      if (Types.ObjectId.isValid(id)) {
        return new Types.ObjectId(id);
      }
    }

    return new Types.ObjectId();
  }

  /* Service is now injected via middleware
  initializeZohoCrmService() {
    if (!this.zohoCrmService) {
      const config = {
        clientId: process.env.ZOHO_CLIENT_ID,
        clientSecret: process.env.ZOHO_CLIENT_SECRET,
        refreshToken: process.env.ZOHO_REFRESH_TOKEN,
        apiDomain: process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com',
        apiVersion: 'v2',
        accountsUrl: process.env.ZOHO_AUTH_URL || process.env.ZOHO_ACCOUNTS_URL
      };
      
      if (config.clientId && config.clientSecret && config.refreshToken) {
        this.zohoCrmService = new ZohoCrmService(config);
        logger.info('Zoho CRM service initialized successfully');
      } else {
        logger.warn('Zoho CRM service not initialized - missing required environment variables');
      }
    }
    return this.zohoCrmService;
  }
  */

  handleMissingZohoDeal(dealId, error) {
    const statusCode = error?.response?.status || error?.status || 404;
    const errorMessage = error?.response?.data?.message || error?.message;

    logger.warn('Zoho deal not found or inaccessible.', {
      dealId,
      statusCode,
      error: errorMessage
    });

    try {
      zohoMetrics.apiCallTotal.inc({ endpoint: 'attachments', status: 'not_found' });
    } catch (metricError) {
      logger.debug('Failed to record Zoho metrics for missing deal', {
        dealId,
        metricError: metricError.message
      });
    }
  }

  async startAnalysis(req, res, next) {
    const startTime = Date.now();
    try {
      const { dealId } = req.validated;
      
      logger.info(`Starting analysis for Deal ID: ${dealId}`, { dealId });
      
      jobMetrics.activeJobs.inc({ jobType: 'statement_analysis' });

      const zohoCrmService = req.crmService;
      if (!zohoCrmService) {
        throw new AppError('Zoho CRM service not available', 500);
      }

      const attachments = await zohoCrmService.getDealAttachments(dealId);

      if (!attachments || attachments.length === 0) {
        logger.warn(`No attachments found for Deal ID: ${dealId}`);
        return res.status(404).json({
          message: `No attachments found for Deal ID: ${dealId}.`,
        });
      }

      // Log attachment details for debugging
      logger.info('Attachments returned from Zoho service:', {
        count: attachments.length,
        items: attachments.map(a => ({ id: a.id, name: a.File_Name, size: a.Size })),
      });

      const processedAttachments = await zohoCrmService.processAttachments(dealId, attachments);
      
      const pdfAttachments = processedAttachments.filter(
        (att) => att.filePath && path.extname(att.filePath).toLowerCase() === '.pdf'
      );

      if (pdfAttachments.length === 0) {
        logger.warn(`No PDF attachments found to process for Deal ID: ${dealId}.`);
        return res.status(404).json({
          message: 'No PDF bank statements found to analyze for this deal.',
        });
      }
      
      const filesToProcess = [];
      for (const attachment of pdfAttachments) {
        const file = {
          originalname: attachment.File_Name,
          path: attachment.filePath,
          size: attachment.Size,
          attachmentId: attachment.id,
          source: attachment.source,
        };
      
        logger.info('Controller evaluating file for PDF criteria:', {
          fileName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
        });

        const isPdf = path.extname(file.originalname).toLowerCase() === '.pdf' && file.size > 0;
        if (isPdf) {
          filesToProcess.push(file);
        } else {
          logger.warn('Skipping non-PDF or empty file from Zoho attachments', {
            fileName: file.originalname,
            size: file.size,
          });
        }
      }

      if (filesToProcess.length === 0) {
        logger.warn(`No processable PDF files found for Deal ID: ${dealId}`);
        return res.status(404).json({
          message: 'No processable PDF bank statements found for this deal.',
        });
      }

      logger.info('Final PDF files to process:', {
        count: filesToProcess.length,
        files: filesToProcess.map(f => f.originalname),
      });

      const analysisPromises = filesToProcess.map((file) =>
        statementQueue.add('analyze-statement', {
          dealId,
          filePath: file.path,
          originalName: file.originalname,
          source: file.source,
          attachmentId: file.attachmentId,
          metadata: {
            ...req.body.metadata,
            source: 'zoho-api',
          },
        })
      );

      await Promise.all(analysisPromises);

      res.status(202).json({
        message: `Analysis started for ${filesToProcess.length} statement(s).`,
        dealId,
        files: filesToProcess.map((f) => f.originalname),
      });

      const duration = (Date.now() - startTime) / 1000;
      jobMetrics.processingDuration.observe({ jobType: 'statement_analysis', status: 'success' }, duration);
      jobMetrics.jobsTotal.inc({ jobType: 'statement_analysis', status: 'success' });
      jobMetrics.activeJobs.dec({ jobType: 'statement_analysis' });

    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      jobMetrics.processingDuration.observe({ jobType: 'statement_analysis', status: 'error' }, duration);
      jobMetrics.jobsTotal.inc({ jobType: 'statement_analysis', status: 'error' });
      jobMetrics.activeJobs.dec({ jobType: 'statement_analysis' });

      logger.error(`Error starting analysis for Deal ID: ${req.validated?.dealId || req.body.dealId}`, {
        dealId: req.validated?.dealId || req.body.dealId,
        error: error.message
      });
      next(error);
    }
  }

  async getAnalysisStatus(req, res, next) {
    const startTime = Date.now();
    try {
      const { jobId } = req.validated;

      const streamInfo = await redisStreamService.getStreamInfo(
        redisStreamService.streams.STATEMENT_UPLOAD
      );
      
      const status = streamInfo.firstEntry ? streamInfo.firstEntry[1] : null;
      
      if (!status) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      res.json({
        success: true,
        data: {
          jobId,
          status: redisStreamService.parseMessage(status)
        }
      });

      const duration = (Date.now() - startTime) / 1000;
      jobMetrics.processingDuration.observe({ jobType: 'status_check', status: 'success' }, duration);

    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      jobMetrics.processingDuration.observe({ jobType: 'status_check', status: 'error' }, duration);

      logger.error(`Error getting analysis status for Job ID: ${req.validated?.jobId || req.params.jobId}`, {
        jobId: req.validated?.jobId || req.params.jobId,
        error: error.message
      });
      next(error);
    }
  }

  // Middleware arrays for routes
  getStartAnalysisHandler() {
    // Bind the handler to preserve 'this' context
    const boundStartAnalysis = this.startAnalysis.bind(this);
    
    // Return middleware array
    return [
      validateRequest(analysisRequestSchema),
      boundStartAnalysis
    ];
  }

  getAnalysisStatusHandler() {
    // Bind the handler to preserve 'this' context
    const boundGetAnalysisStatus = this.getAnalysisStatus.bind(this);
    
    // Return middleware array
    return [
      validateRequest(jobIdSchema),
      boundGetAnalysisStatus
    ];
  }
}

// Create singleton instance with pre-bound methods
const zohoController = new ZohoController();

// Export the singleton instance
export default zohoController;
