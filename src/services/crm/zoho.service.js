import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import qs from 'qs';
import logger from '../../utils/logger.js';
import ZohoWorkDriveService from './zohoWorkDrive.service.js';

class ZohoCrmService {
  constructor() {
    this.apiDomain = process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com';
    this.apiVersion = 'v8';
    this.baseUrl = `${this.apiDomain}/crm/${this.apiVersion}`;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.refreshPromise = null; // This will act as our lock

    // The ZohoCrmService itself will provide the access token to the WorkDrive service.
    const tokenProvider = {
      getAccessToken: () => this.accessToken,
    };
    this.workDriveService = new ZohoWorkDriveService({}, tokenProvider);
    
    this.initialize();
  }

  async initialize() {
    try {
      this.api = axios.create({
        baseURL: this.baseUrl,
      });

      this.api.interceptors.request.use(
        async (config) => {
          await this.ensureValidToken();
          config.headers.Authorization = `Zoho-oauthtoken ${this.accessToken}`;
          return config;
        },
        (error) => Promise.reject(error)
      );

      // The response interceptor is now more robust for retrying requests.
      this.api.interceptors.response.use(
        (response) => response,
        async (error) => {
          const originalRequest = error.config;
          // Check for 401, ensure it's not a repeated attempt on the same request
          if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            logger.warn('Zoho token expired or invalid, interceptor will trigger a refresh.');
            try {
              // The refreshAccessToken method now handles the locking mechanism
              const newAccessToken = await this.refreshAccessToken();
              originalRequest.headers['Authorization'] = `Zoho-oauthtoken ${newAccessToken}`;
              // Retry the original request with the new token
              return this.api(originalRequest);
            } catch (refreshError) {
              logger.error('Failed to refresh token during interceptor retry.', { error: refreshError.message });
              return Promise.reject(refreshError);
            }
          }
          return Promise.reject(error);
        }
      );

      // Initial token fetch on startup
      await this.refreshAccessToken();
      logger.info('Zoho CRM service initialized successfully and initial token fetched.');
    } catch (error) {
      logger.error('Failed to initialize Zoho CRM service', { error: error.message });
      // We throw here to ensure the application doesn't start with a broken service.
      throw new Error(`ZohoCrmService initialization failed: ${error.message}`);
    }
  }

  async refreshAccessToken() {
    // If a refresh is already in progress, wait for it to complete.
    if (this.refreshPromise) {
      logger.info('Token refresh already in progress, waiting for it to complete.');
      return this.refreshPromise;
    }

    // Create a new promise to represent the token refresh process. This is our "lock".
    this.refreshPromise = new Promise(async (resolve, reject) => {
      logger.info('Attempting to refresh Zoho access token...');
      const url = `https://accounts.zoho.com/oauth/v2/token`;
      const data = qs.stringify({
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token',
      });

      try {
        const response = await axios.post(url, data, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        if (response.data.access_token) {
          this.accessToken = response.data.access_token;
          // Set expiry to 55 minutes from now (Zoho tokens last 60 mins)
          this.tokenExpiry = Date.now() + 55 * 60 * 1000;
          logger.info('Successfully refreshed Zoho access token.');
          resolve(this.accessToken);
        } else {
          // This case should ideally not be hit if the API is consistent
          logger.error('Zoho token refresh response did not contain an access_token.');
          reject(new Error('No access token in Zoho response'));
        }
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'Unknown error during token refresh';
        logger.error(`Failed to refresh Zoho access token: ${errorMessage}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
        reject(new Error(`Token refresh failed: ${errorMessage}`));
      } finally {
        // IMPORTANT: Clear the promise lock so that subsequent calls can trigger a new refresh if needed.
        this.refreshPromise = null;
      }
    });

    return this.refreshPromise;
  }

  async ensureValidToken() {
    // If token is missing or expired, trigger a refresh.
    // The refreshAccessToken method itself handles the locking.
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      logger.info('Zoho token is invalid or expired, ensuring a refresh is triggered.');
      return this.refreshAccessToken();
    }
    return Promise.resolve();
  }

  async getDealAttachments(dealId) {
    const uploadsDir = path.join(process.cwd(), 'tmp', 'uploads');
    try {
      await fs.mkdir(uploadsDir, { recursive: true });

      logger.info(`Fetching attachments for deal ID: ${dealId}`);
      const response = await this.api.get(`/Deals/${dealId}/Attachments`);
      
      if (!response.data?.data) {
        logger.warn(`No attachments found for deal ${dealId}.`);
        return [];
      }

      return response.data.data;
    } catch (error) {
      logger.error(`Error fetching attachments for deal ${dealId}: ${error.message}`);
      if (error.response) {
        logger.error('Zoho API Error Response:', { status: error.response.status, data: error.response.data });
      }
      // Re-throw a more specific error to be caught by the controller
      throw new Error(`Failed to retrieve attachments from Zoho: ${error.message}`);
    }
  }

  async processAttachments(dealId, attachments) {
    const uploadsDir = path.join(process.cwd(), 'tmp', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    logger.info(`Found ${attachments.length} total attachments to process for deal ${dealId}.`);
    
    const downloadPromises = attachments.map(async (attachment) => {
      try {
        // Process WorkDrive links
        if (attachment.$type === 'Link URL' && this.workDriveService) {
          const url = attachment.$link_url;
          logger.info('Processing WorkDrive link attachment.', { attachmentId: attachment.id, url });
          const fileId = this.workDriveService.parseFileIdFromUrl(url);
          if (fileId) {
            const workDriveFile = await this.workDriveService.downloadFile(fileId);
            if (workDriveFile) {
              const sanitizedName = (attachment.File_Name || workDriveFile.fileName).replace(/[^\w\s.-]/g, '_');
              const filePath = path.join(uploadsDir, sanitizedName);
              await fs.writeFile(filePath, workDriveFile.fileContent);
              logger.info(`Successfully processed WorkDrive file and saved to ${filePath}`);
              return { ...attachment, filePath, source: 'WorkDrive' };
            }
          }
          return null;
        }

        // Process direct CRM file attachments (only PDFs)
        if (attachment.File_Name && attachment.Size !== '0' && path.extname(attachment.File_Name).toLowerCase() === '.pdf') {
            logger.info(`Found PDF attachment: ${attachment.File_Name}`);
            const sanitizedName = attachment.File_Name.replace(/[^\w\s.-]/g, '_');
            const downloadedPath = await this.downloadAttachment(dealId, attachment.id, uploadsDir, sanitizedName);
            if (downloadedPath) {
              return { ...attachment, filePath: downloadedPath, source: 'CRM' };
            }
            return null;
        }
        
        logger.warn('Skipping attachment (not a PDF, valid WorkDrive link, or is an empty file).', { id: attachment.id, name: attachment.File_Name });
        return null;
      } catch (error) {
        logger.error('Error processing a single attachment.', { attachmentId: attachment.id, error: error.message });
        return null;
      }
    });

    const downloadedAttachments = (await Promise.all(downloadPromises)).filter(Boolean);
    logger.info(`Successfully processed and downloaded ${downloadedAttachments.length} attachments for deal ${dealId}.`);
    return downloadedAttachments;
  }

  async downloadAttachment(dealId, attachmentId, destinationDir, fileName) {
    const filePath = path.join(destinationDir, fileName);
    try {
      logger.info(`Downloading CRM attachment ${attachmentId} for deal ${dealId}`);
      const response = await this.api.get(`/Deals/${dealId}/Attachments/${attachmentId}`, {
        responseType: 'arraybuffer',
      });
      await fs.writeFile(filePath, Buffer.from(response.data));
      logger.info(`Successfully downloaded CRM attachment to ${filePath}`);
      return filePath;
    } catch (error) {
      logger.error(`Failed to download CRM attachment ${attachmentId}: ${error.message}`);
      return null;
    }
  }
}

// Create and export a singleton instance.
const zohoCrmService = new ZohoCrmService();
export default zohoCrmService;

