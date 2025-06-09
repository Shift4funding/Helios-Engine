const path = require('path');

/**
 * Base resolver implementation
 * @param {string} requestPath - Path to resolve
 * @param {Object} options - Resolver options
 * @returns {string} Resolved path
 */
function resolve(requestPath, options) {
    if (requestPath.endsWith('.js')) {
        try {
            return options.defaultResolver(requestPath, {
                ...options,
                packageFilter: (pkg) => ({
                    ...pkg,
                    main: pkg.module || pkg.main
                })
            });
        } catch {
            return require.resolve(requestPath);
        }
    }
    return options.defaultResolver(requestPath, options);
}

// Create resolver function
function resolver(requestPath, options) {
    return resolve(requestPath, options);
}

// Add required properties
resolver.sync = resolve;
resolver.async = async (requestPath, options) => resolve(requestPath, options);

module.exports = resolver;
