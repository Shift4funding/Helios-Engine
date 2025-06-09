import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generateTestPDF() {
    const doc = new PDFDocument();
    const outputPath = path.join(__dirname, '05-versions-space.pdf');
    doc.pipe(fs.createWriteStream(outputPath));

    // Add mock Chase bank statement content
    doc.fontSize(14).text('CHASE', { align: 'right' });
    doc.fontSize(12).text('Account Number: ****1234');
    doc.text('Statement Period: 05/01/2025 through 05/31/2025');
    
    // Add sample transactions
    doc.moveDown();
    doc.text('05/01 05/01 Direct Deposit EMPLOYER INC        +$3,000.00  $3,000.00');
    doc.text('05/02 05/02 Debit Card Purchase GROCERY STORE    -$150.00  $2,850.00');

    doc.end();
    return outputPath;
}

generateTestPDF();