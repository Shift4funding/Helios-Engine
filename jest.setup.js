jest.setTimeout(30000);

// Setup global mocks
const mockLogger = {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
};

// Mock modules before any tests run
jest.mock('./src/config/logger', () => mockLogger);
jest.mock('./src/services/perplexityService', () => {
    return jest.fn().mockImplementation(() => ({
        analyzeText: jest.fn().mockResolvedValue({ category: 'uncategorized' }),
        getSuggestions: jest.fn().mockResolvedValue([])
    }));
});

jest.mock('./src/services/RedisService', () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1)
}));

jest.mock('natural', () => ({
    BayesClassifier: jest.fn().mockImplementation(() => ({
        addDocument: jest.fn(),
        train: jest.fn(),
        classify: jest.fn().mockReturnValue('uncategorized')
    }))
}));

// Make mocks available globally
global.__mocks__ = {
    logger: mockLogger
};

// Cleanup all mocks after each test
afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise Rejection:', error);
});

// Global test setup
global.console = {
    ...console,
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn()
};