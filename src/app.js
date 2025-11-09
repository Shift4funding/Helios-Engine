import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

import { getHealthStatus } from './services/healthService.js';

// Import consolidated routes and middleware
import consolidatedRoutes from './routes/consolidatedRoutes.js';
import zohoRoutes from './routes/zohoRoutes.js';
import { 
  morganMiddleware, 
  performanceMonitor, 
  sanitizeRequest, 
  errorHandler 
} from './middleware/index.js';
import { securityHeaders, requestId, responseTime } from './middleware/security.js';
import { getMetrics } from './middleware/metrics.js';

// Import Swagger configuration
import { setupSwagger } from './config/swagger.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();

// Setup Swagger API documentation
setupSwagger(app);

// Security and performance middleware
app.use(requestId);
app.use(responseTime);
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morganMiddleware);
app.use(performanceMonitor);
app.use(sanitizeRequest);

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health endpoint (direct access without /api prefix)
app.get('/health', async (req, res) => {
  try {
    const healthStatus = await getHealthStatus();
    res.status(healthStatus.status === 'healthy' ? 200 : 503).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API Routes
app.use('/api', consolidatedRoutes);
app.use('/api/zoho', zohoRoutes);

// API documentation note
app.get('/api', (req, res) => {
  res.json({
    message: 'Bank Statement Analyzer API',
    docs: '/api-docs',
    status: 'available'
  });
});

// Placeholder routes for missing endpoints
app.get('/api/merchants', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Merchants endpoint - placeholder implementation'
  });
});

app.get('/api/settings', (req, res) => {
  res.json({
    success: true,
    data: {
      theme: 'light',
      notifications: true,
      autoAnalysis: false
    },
    message: 'Settings endpoint - placeholder implementation'
  });
});

// Global error handler (must be after all routes)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Database connection is handled in server.js

export default app;
