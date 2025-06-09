// tests/services/perplexityService.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use correct path resolution
const mockTransactions = await import(path.join(__dirname, '../fixtures/mockTransactions.js'));

describe('Perplexity Service', () => {
    // You must have at least one test (an "it" block) for the suite to run.
    it('should call the Perplexity API and return a structured analysis', async () => {
        // Setup a mock for the axios HTTP client
        const mock = new MockAdapter(axios);
        const mockApiResponse = {
            choices: [{ message: { content: '{"structured": {}, "metadata": {}}' } }],
        };
        mock.onPost('https://api.perplexity.ai/chat/completions').reply(200, mockApiResponse);

        // Call the actual function from your service
        const analysis = await PerplexityService.analyzeTransactions(mockTransactions);

        // Assert that the result is what you expect
        expect(analysis).toHaveProperty('structured');
        expect(analysis).toHaveProperty('metadata');
    });
});