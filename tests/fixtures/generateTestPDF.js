const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function generateTestBankStatement() {
    const doc = new PDFDocument();
    const outputPath = path.join(__dirname, 'test-statement.pdf');
    doc.pipe(fs.createWriteStream(outputPath));

    // Add header
    doc.fontSize(16).text('Bank Statement', { align: 'center' });
    doc.moveDown();

    // Add sample transactions
    const transactions = [
        { date: '01/15/2024', description: 'GROCERY STORE', amount: -125.50 },
        { date: '01/16/2024', description: 'SALARY DEPOSIT', amount: 2500.00 },
        { date: '01/17/2024', description: 'AMAZON PURCHASE', amount: -45.99 }
    ];

    transactions.forEach(trans => {
        doc.fontSize(12).text(
            `${trans.date}    ${trans.description}    $${trans.amount.toFixed(2)}`
        );
    });

    doc.end();
    return outputPath;
}

module.exports = { generateTestBankStatement };