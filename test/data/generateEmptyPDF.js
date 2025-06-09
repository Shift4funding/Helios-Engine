import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generateEmptyPDF() {
    const doc = new PDFDocument();
    const outputPath = path.join(__dirname, 'empty.pdf');
    doc.pipe(fs.createWriteStream(outputPath));
    doc.end();
    return outputPath;
}

generateEmptyPDF();