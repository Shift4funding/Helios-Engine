/**
 * Simplified Redis Stream Service
 * 
 * This service provides a streamlined approach to job processing using Redis Streams.
 * It uses a single stream and consumer group for all analysis jobs.
 */

import redis from '../config/redis.js';
import logger from '../utils/logger.js';
import { StatementController } from '../controllers/statement.controller.js';

const STREAM_KEY = 'analysis-jobs';
const CONSUMER_GROUP = 'analysis-workers';
const CONSUMER_NAME = `worker-${process.pid}`;

class RedisStreamService {
  constructor() {
    this.statementController = new StatementController();
    this.isProcessing = false;
    this.streamsSupported = true;
    this.streams = {
      STATEMENT_UPLOAD: STREAM_KEY,
      ERROR: 'error-jobs'
    };
    this.initialize().catch(err => {
      logger.error('Failed to initialize Redis Stream Service:', err);
    });
  }

  async addToStream(streamName = STREAM_KEY, payload = {}) {
    try {
      const enrichedPayload = {
        ...payload,
        timestamp: Date.now()
      };

      const messageId = await redis.xadd(
        streamName,
        '*',
        'data',
        JSON.stringify(enrichedPayload)
      );

      logger.info('Message added to stream', {
        streamName,
        messageId
      });

      return messageId;
    } catch (error) {
      logger.error('Failed to add message to stream:', error);
      throw error;
    }
  }

  async initialize() {
    try {
      await redis.xgroup('CREATE', STREAM_KEY, CONSUMER_GROUP, '0', 'MKSTREAM');
      logger.info('Redis stream ready', {
        stream: STREAM_KEY,
        group: CONSUMER_GROUP
      });
    } catch (error) {
      // BUSYGROUP means group already exists, which is fine
      if (error.message.includes('unknown command')) {
        this.streamsSupported = false;
        logger.warn('Redis instance does not support stream commands. Job queue disabled.');
        logger.debug('Redis stream initialization error:', error);
        return;
      }

      if (!error.message.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  async addJob(jobData) {
    try {
      // Add metadata to job
      const enrichedJobData = {
        ...jobData,
        timestamp: Date.now(),
        status: 'pending'
      };

      const jobId = await redis.xadd(
        STREAM_KEY,
        '*',  // Auto-generate ID
        'data', 
        JSON.stringify(enrichedJobData)
      );

      logger.info('Job added to stream', { 
        jobId,
        type: jobData.type
      });

      return jobId;
    } catch (error) {
      logger.error('Failed to add job to stream:', error);
      throw error;
    }
  }

  async processJobs() {
    if (this.isProcessing) {
      logger.warn('Worker already processing jobs');
      return;
    }

    if (!this.streamsSupported) {
      logger.info('Redis streams unsupported; skipping job processing');
      return;
    }

    this.isProcessing = true;
    logger.info(`Worker ${CONSUMER_NAME} started processing jobs`);

    while (this.isProcessing) {
      logger.info('Worker checking for new jobs in the stream...');
      try {
        const result = await redis.xreadgroup(
          'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
          'COUNT', 1,
          'BLOCK', 5000,
          'STREAMS', STREAM_KEY, '>'
        );

        logger.info({ result }, 'Received data from Redis stream.');

        if (!result || !result.length) {
          continue;
        }

        const [, messages] = result[0];
        const [messageId, [, rawJob]] = messages[0];
        const job = JSON.parse(rawJob);

        logger.info(`Processing job with ID: ${messageId}`);

        try {
          if (job.type === 'statement_analysis') {
            // Handle Zoho integration jobs
            if (job.payload.statements) {
              for (const stmt of job.payload.statements) {
                await this.statementController.processStatementAsync(
                  stmt.statementId,
                  stmt.filePath, // Pass the file path from the job
                  null  // userId will be null for Zoho files
                );
              }
            } else {
              // Handle regular upload jobs
              await this.statementController.processStatementAsync(
                job.payload.statementId,
                job.payload.filePath,
                job.payload.userId
              );
            }
          } else {
            logger.warn(`Unknown job type: ${job.type}`);
          }

          await redis.xack(STREAM_KEY, CONSUMER_GROUP, messageId);
          logger.info(`Job ${messageId} processed and acknowledged.`);

        } catch (error) {
          logger.error('Job processing failed', {
            messageId,
            error: error.message,
          });
          // Optionally, move to a dead-letter queue
        }
      } catch (error) {
        if (error.message && error.message.includes('unknown command')) {
          this.streamsSupported = false;
          logger.error('Redis streams unsupported; stopping worker loop');
          this.isProcessing = false;
          return;
        }

        logger.error('Stream processing error:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async moveToErrorStream(messageId, job, error) {
    try {
      await redis.xadd(
        'error-jobs',
        '*',
        'data',
        JSON.stringify({
          ...job,
          error: error.message,
          failedAt: Date.now()
        })
      );
      
      // Acknowledge the failed job to remove it from pending
      await redis.xack(STREAM_KEY, CONSUMER_GROUP, messageId);
    } catch (err) {
      logger.error('Failed to move job to error stream:', err);
    }
  }

  async stop() {
    this.isProcessing = false;
    logger.info(`Worker ${CONSUMER_NAME} stopped`);
  }

  async getJobStatus(jobId) {
    try {
      const messages = await redis.xrange(STREAM_KEY, jobId, jobId);
      if (!messages || !messages.length) {
        return null;
      }
      
      const [_, [__, jobDataString]] = messages[0];
      return JSON.parse(jobDataString);
    } catch (error) {
      logger.error('Failed to get job status:', error);
      throw error;
    }
  }
}

// Export singleton instance
const redisStreamService = new RedisStreamService();

// Start processing if not in test environment and streams are supported
if (process.env.NODE_ENV !== 'test') {
  // Wait for initialization to complete before starting processing
  setTimeout(async () => {
    if (redisStreamService.streamsSupported) {
      redisStreamService.processJobs().catch(err => {
        logger.error('Failed to start job processing:', err);
      });
    } else {
      logger.info('Redis streams not supported; skipping job processing');
    }
  }, 1000); // Wait 1 second for initialization
}

export default redisStreamService;