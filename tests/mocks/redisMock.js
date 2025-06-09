class RedisMock {
    constructor() {
        this.storage = new Map();
    }

    async get(key) {
        return this.storage.get(key);
    }

    async set(key, value, expiration) {
        this.storage.set(key, value);
        return 'OK';
    }
}

module.exports = new RedisMock();