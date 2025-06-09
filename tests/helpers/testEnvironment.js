const NodeEnvironment = require('jest-environment-node');
const { MongoMemoryServer } = require('mongodb-memory-server');

class CustomEnvironment extends NodeEnvironment {
    constructor(config) {
        super(config);
        this.mongod = null;
    }

    async setup() {
        await super.setup();
        this.mongod = await MongoMemoryServer.create();
        this.global.__MONGO_URI__ = this.mongod.getUri();
        this.global.__TEST_DATA__ = new Map();
    }

    async teardown() {
        await this.mongod.stop();
        await super.teardown();
    }
}

module.exports = CustomEnvironment;