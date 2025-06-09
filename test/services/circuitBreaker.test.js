import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import circuitBreaker from '../../src/services/circuitBreakerService.js';

describe('Circuit Breaker Service', () => {
    const mockService = jest.fn();
    const serviceName = 'test-service';

    beforeEach(() => {
        mockService.mockReset();
    });

    it('should handle successful calls', async () => {
        mockService.mockResolvedValue({ data: 'success' });

        const result = await circuitBreaker.execute(serviceName, mockService, 'test');
        
        expect(result).toEqual({ data: 'success' });
    });

    it('should handle service failures', async () => {
        mockService.mockRejectedValue(new Error('Service failed'));

        const result = await circuitBreaker.execute(serviceName, mockService, 'test');
        
        expect(result).toEqual({
            success: false,
            error: 'test-service is temporarily unavailable'
        });
    });

    it('should track circuit breaker stats', async () => {
        mockService.mockResolvedValue({ data: 'success' });
        await circuitBreaker.execute(serviceName, mockService);

        const stats = circuitBreaker.getStats(serviceName);
        
        expect(stats.state).toBe('closed');
        expect(stats.stats.successful).toBeGreaterThan(0);
    });
});
