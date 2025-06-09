import mongoose from 'mongoose';

const StatementSchema = new mongoose.Schema({
    applicationId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    parsedData: {
        accountInfo: Object,
        transactions: [Object],
        metadata: Object
    },
    analysis: {
        summary: String,
        riskFactors: [String],
        unusualTransactions: [String],
        cashFlowAnalysis: String,
        incomeStability: String
    }
}, {
    timestamps: true
});

export const Statement = mongoose.model('Statement', StatementSchema);