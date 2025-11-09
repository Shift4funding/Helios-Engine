const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function setup() {
    const mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    global.teardown = async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    };
}

module.exports = setup;