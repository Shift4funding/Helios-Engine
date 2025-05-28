const pdf = require('pdf-parse');

// Helper function to extract dates using multiple common formats
const extractDate = (text) => {
    const datePatterns = [
        /\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/, // DD/MM/YYYY or DD-MM-YYYY
        /\b(20\d{2})[/-](\d{1,2})[/-](\d{1,2})\b/, // YYYY/MM/DD or YYYY-MM-DD
        /\b(\w+)\s+(\d{1,2}),?\s+(20\d{2})\b/      // Month DD, YYYY
    ];

    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            // Convert to YYYY-MM-DD format
            try {
                const date = new Date(match[0]);
                return date.toISOString().split('T')[0];
            } catch (e) {
                console.warn('Date parsing failed:', match[0]);
            }
        }
    }
    return null;
};

// Helper to extract currency amounts
const extractAmount = (text) => {
    // Handle various currency formats
    const amountPattern = /[-]?\$?\s*[\d,]+\.?\d*/g;
    const match = text.match(amountPattern);
    if (match) {
        // Clean up and convert to number
        return Number(match[0].replace(/[$,\s]/g, ''));
    }
    return null;
};

// Main parsing function with enhanced structure
exports.parsePdf = async (pdfBuffer) => {
    try {
        const data = await pdf(pdfBuffer);
        const lines = data.text.split('\n').map(line => line.trim()).filter(Boolean);
        
        // Initialize structured data object
        const result = {
            accountInfo: {
                accountHolder: null,
                accountNumber: null,
                bankName: null,
                statementPeriod: {
                    startDate: null,
                    endDate: null
                },
                balances: {
                    opening: null,
                    closing: null
                }
            },
            transactions: [],
            rawText: data.text,
            pageCount: data.numpages,
            parsingMetadata: {
                confidence: 'medium',
                warningMessages: []
            }
        };

        // Extract account information using common patterns
        for (const line of lines) {
            // Look for account number
            if (line.match(/acc(oun)?t\s*(no|number|#)?:?\s*(\d+)/i)) {
                result.accountInfo.accountNumber = line.match(/(\d{8,})/)[0];
            }
            
            // Look for account holder (usually near the top, often with "Mr/Mrs/Ms")
            if (line.match(/(mr|mrs|ms|dr)\.?\s+[\w\s]+/i) && !result.accountInfo.accountHolder) {
                result.accountInfo.accountHolder = line.trim();
            }

            // Look for statement period
            if (line.toLowerCase().includes('statement period') || 
                line.toLowerCase().includes('statement date')) {
                const dates = line.match(/\b\d{1,2}[/-]\d{1,2}[/-]20\d{2}\b/g);
                if (dates && dates.length >= 2) {
                    result.accountInfo.statementPeriod.startDate = extractDate(dates[0]);
                    result.accountInfo.statementPeriod.endDate = extractDate(dates[1]);
                }
            }

            // Look for opening/closing balances
            if (line.toLowerCase().includes('opening balance')) {
                result.accountInfo.balances.opening = extractAmount(line);
            }
            if (line.toLowerCase().includes('closing balance')) {
                result.accountInfo.balances.closing = extractAmount(line);
            }
        }

        // Extract transactions
        // This is the most complex part - we'll look for patterns that might indicate transaction lines
        let currentTransaction = null;
        const transactionStartPatterns = [
            /^\d{1,2}[/-]\d{1,2}[/-]20\d{2}/,  // Starts with date
            /^\d{2}\s+[A-Z]{3}/                 // Starts with day + month abbreviation
        ];

        for (const line of lines) {
            // Check if line might be start of new transaction
            const isTransactionStart = transactionStartPatterns.some(pattern => pattern.test(line));
            
            if (isTransactionStart) {
                // If we have a previous transaction, save it
                if (currentTransaction) {
                    result.transactions.push(currentTransaction);
                }

                // Start new transaction
                currentTransaction = {
                    date: extractDate(line),
                    description: line.replace(/^\d{1,2}[/-]\d{1,2}[/-]20\d{2}/, '').trim(),
                    debit: null,
                    credit: null,
                    balance: null,
                    raw: line // Keep raw line for debugging
                };

                // Extract amounts
                const amounts = line.match(/[-]?\$?\s*[\d,]+\.?\d*/g);
                if (amounts) {
                    // Logic to determine which amount is debit/credit/balance
                    // This varies by bank format - here's a simple example
                    if (amounts.length >= 3) {
                        currentTransaction.debit = extractAmount(amounts[0]);
                        currentTransaction.credit = extractAmount(amounts[1]);
                        currentTransaction.balance = extractAmount(amounts[2]);
                    }
                }
            } else if (currentTransaction && line.trim()) {
                // If not a new transaction and we have text, it might be
                // continuation of previous transaction description
                currentTransaction.description += ' ' + line.trim();
                
                // Check for amounts in continuation line
                const amounts = line.match(/[-]?\$?\s*[\d,]+\.?\d*/g);
                if (amounts && (!currentTransaction.debit || !currentTransaction.credit)) {
                    // Try to fill in missing amounts
                    if (!currentTransaction.debit) currentTransaction.debit = extractAmount(amounts[0]);
                    if (!currentTransaction.credit) currentTransaction.credit = extractAmount(amounts[1]);
                }
            }
        }

        // Don't forget to add the last transaction if exists
        if (currentTransaction) {
            result.transactions.push(currentTransaction);
        }

        // Add confidence level based on what we found
        result.parsingMetadata.confidence = determineConfidenceLevel(result);
        
        return result;

    } catch (error) {
        console.error('Error parsing PDF:', error);
        throw new Error('Failed to parse PDF content: ' + error.message);
    }
};

// Helper to determine confidence level in our parsing
function determineConfidenceLevel(result) {
    let score = 0;
    const checks = {
        hasAccountNumber: !!result.accountInfo.accountNumber,
        hasAccountHolder: !!result.accountInfo.accountHolder,
        hasStatementPeriod: !!(result.accountInfo.statementPeriod.startDate && 
                              result.accountInfo.statementPeriod.endDate),
        hasBalances: !!(result.accountInfo.balances.opening !== null || 
                       result.accountInfo.balances.closing !== null),
        hasTransactions: result.transactions.length > 0,
        transactionsHaveData: result.transactions.every(t => 
            t.date && (t.debit !== null || t.credit !== null))
    };

    // Calculate confidence score
    score += checks.hasAccountNumber ? 20 : 0;
    score += checks.hasAccountHolder ? 15 : 0;
    score += checks.hasStatementPeriod ? 15 : 0;
    score += checks.hasBalances ? 20 : 0;
    score += checks.hasTransactions ? 15 : 0;
    score += checks.transactionsHaveData ? 15 : 0;

    if (score >= 90) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
}