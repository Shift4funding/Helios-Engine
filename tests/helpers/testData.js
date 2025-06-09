const generateTestTransactions = () => [
    { date: '2025-01-01', description: 'SALARY DEPOSIT', amount: 5000 },
    { date: '2025-01-15', description: 'RENT PAYMENT', amount: -2000 },
    { date: '2025-01-31', description: 'UTILITIES', amount: -150 }
];

module.exports = {
    generateTestTransactions
};