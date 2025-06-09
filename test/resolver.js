/**
 * ES Module compatibility resolver for test files
 * This helper allows importing both CommonJS and ES Modules in tests
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

// Create a require function
const require = createRequire(import.meta.url);

// Helper for __dirname and __filename in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Export both ES Module and CommonJS compatible utilities
export {
    require,
    __filename,
    __dirname
};

// For Jest to resolve modules correctly when running tests with ES modules
export default {};
