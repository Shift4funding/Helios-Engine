const mongoose = require('mongoose');

const AnalysisSchema = new mongoose.Schema({
    analysisId: {
        type: String,
        required: true,
        unique: true
    },
    transactions: [{
        date: Date,
        description: String,
        amount: Number,
        category: String
    }],
    summary: {
        totalIncome: Number,
        totalExpenses: Number,
        netCashFlow: Number
    },
    metadata: {
        bankType: String,
        analysisDate: Date,
        pdfHash: String
    },
    aiInsights: mongoose.Schema.Types.Mixed
}, {
    timestamps: true
});

module.exports = mongoose.model('Analysis', AnalysisSchema);