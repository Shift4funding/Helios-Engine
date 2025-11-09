import pdfParse from 'pdf-parse';
import fs from 'fs/promises';
import logger from '../utils/logger.js';
import { PDFParseError } from '../utils/errors.js';

export class PDFParserService {
  constructor() {
    this.bankParsers = new Map();
    this.initializeParsers();
  }

  async parsePDF(filePath, options = { bankType: 'DEFAULT' }) {
    try {
      // Read the PDF file as buffer
      const buffer = await fs.readFile(filePath);
      return await this.parseStatement(buffer, options);
    } catch (error) {
      logger.error('PDF file reading failed:', error);
      throw new PDFParseError(`Failed to read PDF file: ${error.message}`);
    }
  }

  initializeParsers() {
    // Default parser for generic bank statements
    this.registerParser('DEFAULT', {
      parseDate: (text) => {
        const datePattern = /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;
        const match = text.match(datePattern);
        return match ? new Date(match[1]) : null;
      },
      
      parseAmount: (text) => {
        const amountPattern = /-?\$?\s*[\d,]+\.\d{2}/;
        const match = text.match(amountPattern);
        if (!match) return null;
        return Number(match[0].replace(/[\$,\s]/g, ''));
      },
      
      parseDescription: (text) => {
        return text.replace(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|(-?\$?\s*[\d,]+\.\d{2})/g, '').trim();
      }
    });
  }

  registerParser(bankType, parser) {
    this.bankParsers.set(bankType.toUpperCase(), parser);
  }

  async parseStatement(buffer, options = { bankType: 'DEFAULT' }) {
    try {
      const data = await pdfParse(buffer);
      const parser = this.bankParsers.get(options.bankType.toUpperCase()) || 
                    this.bankParsers.get('DEFAULT');

      // Extract basic statement information
      const accountInfo = await this._extractAccountInfo(data.text);
      const transactions = await this._extractTransactions(data.text, parser);
      const balances = await this._extractBalances(data.text);

      return {
        metadata: {
          pageCount: data.numpages,
          bankType: options.bankType,
          parsed: new Date().toISOString()
        },
        accountInfo,
        balances,
        transactions
      };
    } catch (error) {
      logger.error('PDF parsing failed:', error);
      throw new PDFParseError(`Failed to parse PDF: ${error.message}`);
    }
  }

  async _extractAccountInfo(text) {
    const accountInfo = {
      accountHolder: null,
      accountNumber: null,
      bankName: null,
      statementPeriod: {
        start: null,
        end: null
      }
    };

    // Account number pattern (masked with * or X)
    const accountPattern = /Account(?:\s+Number)?[:# ]+([X*\d]+)/i;
    const accountMatch = text.match(accountPattern);
    if (accountMatch) {
      accountInfo.accountNumber = accountMatch[1];
    }

    // Statement period pattern
    const periodPattern = /Statement Period:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*(?:to|through|-)\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i;
    const periodMatch = text.match(periodPattern);
    if (periodMatch) {
      accountInfo.statementPeriod.start = periodMatch[1];
      accountInfo.statementPeriod.end = periodMatch[2];
    }

    // Account holder pattern
    const holderPattern = /(?:Account Holder|Prepared for)[:]\s*([^\n]+)/i;
    const holderMatch = text.match(holderPattern);
    if (holderMatch) {
      accountInfo.accountHolder = holderMatch[1].trim();
    }

    return accountInfo;
  }

  async _extractBalances(text) {
    const balances = {
      opening: null,
      closing: null,
      available: null
    };

    // Opening balance pattern
    const openingPattern = /Opening(?:\s+Balance)?[:]\s*\$?([\d,]+\.\d{2})/i;
    const openingMatch = text.match(openingPattern);
    if (openingMatch) {
      balances.opening = Number(openingMatch[1].replace(/,/g, ''));
    }

    // Closing balance pattern
    const closingPattern = /Closing(?:\s+Balance)?[:]\s*\$?([\d,]+\.\d{2})/i;
    const closingMatch = text.match(closingPattern);
    if (closingMatch) {
      balances.closing = Number(closingMatch[1].replace(/,/g, ''));
    }

    // Available balance pattern
    const availablePattern = /Available(?:\s+Balance)?[:]\s*\$?([\d,]+\.\d{2})/i;
    const availableMatch = text.match(availablePattern);
    if (availableMatch) {
      balances.available = Number(availableMatch[1].replace(/,/g, ''));
    }

    return balances;
  }

  async _extractTransactions(text, parser) {
    const transactions = [];
    const lines = text.split('\n');
    
    // Define transaction line pattern based on common formats
    const transactionPattern = /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s+([^\d$-]+?)\s+(-?\$?\s*[\d,]+\.\d{2})/;
    
    for (const line of lines) {
      const match = line.match(transactionPattern);
      if (!match) continue;

      const [, dateStr, descriptionRaw, amountStr] = match;
      
      const date = parser.parseDate(dateStr);
      const amount = parser.parseAmount(amountStr);
      const description = parser.parseDescription(descriptionRaw);

      if (date && amount !== null && description) {
        transactions.push({
          date: date.toISOString().split('T')[0],
          description,
          amount,
          type: amount >= 0 ? 'credit' : 'debit'
        });
      }
    }

    return transactions;
  }

  // Method to validate extracted data
  _validateData(data) {
    const { transactions, accountInfo, balances } = data;

    // Validate transactions
    if (!Array.isArray(transactions)) {
      throw new PDFParseError('Invalid transactions data: expected array');
    }

    // Validate transaction data
    transactions.forEach((transaction, index) => {
      if (!transaction.date || !transaction.description || transaction.amount === undefined) {
        throw new PDFParseError(`Invalid transaction data at index ${index}`);
      }
    });

    // Validate account info
    if (!accountInfo || typeof accountInfo !== 'object') {
      throw new PDFParseError('Invalid account information');
    }

    // Validate balances
    if (!balances || typeof balances !== 'object') {
      throw new PDFParseError('Invalid balance information');
    }

    return true;
  }
}

// Export singleton instance
const pdfParserService = new PDFParserService();
export default pdfParserService;
