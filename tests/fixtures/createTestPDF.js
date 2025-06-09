const fs = require('fs').promises;
const path = require('path');

async function createTestPDF() {
    const pdfPath = path.join(__dirname, 'test.pdf');
    const minimalPDF = '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF';
    
    try {
        await fs.writeFile(pdfPath, minimalPDF);
        console.log('Test PDF created successfully');
    } catch (error) {
        console.error('Failed to create test PDF:', error);
    }
}

createTestPDF();