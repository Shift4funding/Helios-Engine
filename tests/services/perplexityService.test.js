import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import PerplexityService from '../../src/services/perplexityService.js';
import mockTransactions from '../fixtures/mockTransactions.js';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

describe('PerplexityService', () => {
    let mockAxios;
    let perplexityService;

    beforeEach(() => {
        mockAxios = new MockAdapter(axios);
        perplexityService = new PerplexityService();
        jest.clearAllMocks();
    });

    afterEach(() => {
        mockAxios.restore();
    });

    it('should analyze transactions correctly', async () => {
        const expectedResponse = {
            summary: 'Analysis complete',
            categories: ['Food', 'Transport']
        };

        mockAxios.onPost('/analyze').reply(200, expectedResponse);

        const analysis = await perplexityService.analyzeTransactions(mockTransactions);
        
        expect(analysis).toEqual(expectedResponse);
        expect(mockAxios.history.post.length).toBe(1);
    });
});