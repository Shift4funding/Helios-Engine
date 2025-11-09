/**
 * Environment-based configuration
 */
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const config = {
  // Server config
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/bank-analyzer',
  
  // Auth
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '30d',
  
  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  USE_REDIS: process.env.USE_REDIS === 'true',
  
  // API
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  
  // File upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  
  // External services
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
  
  // Security
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100')
};

// Validate required config
const requiredConfig = ['JWT_SECRET'];

for (const key of requiredConfig) {
  if (!config[key] && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required configuration: ${key}`);
  }
}

export default config;
export { config };
