import { describe, it, expect, jest } from '@jest/globals';
import sanitizeRequest from '../../src/middleware/sanitizer.js';

describe('Sanitization Middleware', () => {
    it('should sanitize HTML in request body', () => {
        const req = {
            body: {
                text: '<script>alert("xss")</script>Hello',
                nested: { html: '<img src="x" onerror="alert(1)">' }
            }
        };
        const next = jest.fn();

        sanitizeRequest(req, {}, next);

        expect(req.body.text).toBe('Hello');
        expect(req.body.nested.html).toBe('');
        expect(next).toHaveBeenCalled();
    });

    it('should handle arrays in request body', () => {
        const req = {
            body: {
                items: ['<b>test</b>', '<script>alert(1)</script>']
            }
        };
        const next = jest.fn();

        sanitizeRequest(req, {}, next);

        expect(req.body.items[0]).toBe('test');
        expect(req.body.items[1]).toBe('');
    });
});