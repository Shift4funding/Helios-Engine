const moment = require('moment');

function createMockTransactions() {
    const now = moment();
    return [
        {
            date: now.clone().subtract(14, 'days').toDate(),
            description: 'SALARY DEPOSIT',
            amount: 5000,
            category: 'income'
        },
        {
            date: now.clone().subtract(7, 'days').toDate(),
            description: 'RENT PAYMENT',
            amount: -2000,
            category: 'expense'
        },
        {
            date: now.clone().subtract(1, 'day').toDate(),
            description: 'GROCERY SHOPPING',
            amount: -150,
            category: 'expense'
        }
    ];
}

module.exports = {
    createMockTransactions
};