import { ChaseBankParser } from './parsers/ChaseBankParser.js';
import { BankOfAmericaParser } from './parsers/BankOfAmericaParser.js';
import { detectBank } from '../utils/bankDetector.js';

export class PDFParserService {
    constructor() {
        this.parsers = {
            'Chase': new ChaseBankParser(),
            'Bank of America': new BankOfAmericaParser()
        };
    }

    async parse(buffer) {
        try {
            if (!Buffer.isBuffer(buffer)) {
                throw new Error('Invalid PDF buffer provided');
            }

            const bankName = await detectBank(buffer);
            const parser = this.parsers[bankName];
            
            if (!parser) {
                throw new Error(`Unsupported bank statement format: ${bankName}`);
            }

            return await parser.parse(buffer);
        } catch (error) {
            console.error('PDF parsing error:', error);
            throw new Error('Failed to parse bank statement');
        }
    }
}
