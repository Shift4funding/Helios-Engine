// FILE: jest.config.cjs

/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.js$': 'babel-jest',
    },

    // VERIFY THAT moduleNameMapper IS GONE.

    testMatch: [
        '**/test/**/*.test.js',
        '**/tests/**/*.test.js',
    ],
    setupFilesAfterEnv: ['./test/setup.js'],
    verbose: true,
    testTimeout: 10000,
    transformIgnorePatterns: [
        'node_modules/(?!(pdf-parse|@jest/globals)/)',
    ],
};