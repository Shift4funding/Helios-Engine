import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFParserService from '../../src/services/pdfParserService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('PDF Parser Service', () => {
    let samplePDFBuffer;

    beforeAll(async () => {
        const pdfPath = path.join(__dirname, '../fixtures/sample-statement.pdf');
        try {
            // Valid PDF structure
            const validPDF = `%PDF-1.4
%����
1 0 obj
<< /Type /Catalog
   /Pages 2 0 R
>>
endobj
2 0 obj
<< /Type /Pages
   /Kids [3 0 R]
   /Count 1
>>
endobj
3 0 obj
<< /Type /Page
   /Parent 2 0 R
   /MediaBox [0 0 612 792]
   /Contents 4 0 R
>>
endobj
4 0 obj
<< /Length 100 >>
stream
BT
/F1 12 Tf
72 720 Td
(05/15/23 GROCERY STORE PURCHASE -123.45
05/16/23 SALARY DEPOSIT 2500.00
05/17/23 UTILITY BILL -85.99) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000120 00000 n
0000000200 00000 n
trailer
<< /Size 5
   /Root 1 0 R
>>
startxref
350
%%EOF`;

            await fs.writeFile(pdfPath, validPDF);
            samplePDFBuffer = Buffer.from(validPDF);
        } catch (error) {
            console.error('Failed to create test PDF:', error);
            throw error;
        }
    });

    it('should parse Chase bank statement format', async () => {
        const result = await PDFParserService.parseStatement(samplePDFBuffer, 'CHASE');
        
        expect(result).toHaveProperty('transactions');
        expect(result.transactions.length).toBeGreaterThan(0);
        
        const firstTransaction = result.transactions[0];
        expect(firstTransaction).toEqual({
            date: '05/15/23',
            description: 'GROCERY STORE PURCHASE',
            amount: -123.45
        });
    });
});