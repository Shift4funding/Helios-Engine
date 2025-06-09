const { categories } = require('../config/categories');

class CategorizationService {
    categorizeTransaction(transaction) {
        // Use ML/pattern matching to categorize
        const category = this.matchCategory(transaction.description);
        return {
            ...transaction,
            category,
            confidence: this.calculateConfidence(transaction, category)
        };
    }

    // Add smart category matching
    matchCategory(description) {
        // Implement smart matching logic
    }
}

module.exports = new CategorizationService();