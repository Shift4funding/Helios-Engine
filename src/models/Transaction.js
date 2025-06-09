import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: [true, 'Transaction date is required']
    },
    description: String,
    amount: Number,
    // Enhanced categorization for business analysis
    category: {
        type: String,
        enum: [
            'revenue',
            'expense',
            'transfer',
            'loan_payment',
            'tax_payment',
            'payroll',
            'insurance',
            'return',
            'chargeback',
            'fee'
        ],
        default: 'expense'
    },
    // Business-specific transaction types
    type: {
        type: String,
        enum: [
            'business_income',
            'personal_deposit',
            'merchant_services',
            'wire_transfer',
            'ach_payment',
            'check',
            'cash_deposit',
            'loan_disbursement',
            'overdraft',
            'other'
        ],
        default: 'other'
    },
    // Risk indicators
    riskMetrics: {
        isNSF: Boolean,
        isOverdraft: Boolean,
        isLargeDeposit: Boolean,
        isRecurring: Boolean,
        confidenceScore: {
            type: Number,
            min: 0,
            max: 100
        }
    },
    // Business analysis metadata
    businessMetrics: {
        revenueType: {
            type: String,
            enum: ['recurring', 'one_time', 'seasonal', 'unknown']
        },
        cashFlowImpact: {
            type: String,
            enum: ['positive', 'negative', 'neutral']
        },
        verificationStatus: {
            type: String,
            enum: ['verified', 'pending', 'suspicious']
        }
    },
    tags: [String],
    metadata: {
        source: String,
        statementId: mongoose.Schema.Types.ObjectId,
        originalText: String,
        raw: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;