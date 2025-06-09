import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const TEST_CONFIG = {
    fixturesPath: path.join(__dirname, 'fixtures'),
    testDataPath: path.join(__dirname, 'data'),
    mongoUrl: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test',
    redisUrl: process.env.REDIS_TEST_URL || 'redis://localhost:6379/1'
};