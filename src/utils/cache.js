import { LRUCache } from 'lru-cache';

const cache = new LRUCache({
    max: 500,
    ttl: 1000 * 60 * 5 // 5 minutes
});

export const cacheRequest = async (key, fn) => {
    if (cache.has(key)) {
        return cache.get(key);
    }
    const result = await fn();
    cache.set(key, result);
    return result;
};