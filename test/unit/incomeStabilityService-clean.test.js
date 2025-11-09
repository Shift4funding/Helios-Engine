// Clean unit test for IncomeStabilityService without any mocking interference
import { test, expect } from 'vitest';
import IncomeStabilityService from '../../src/services/incomeStabilityService.js';

test('Income Stability Service - Core Functions Work', () => {
  console.log('Testing service:', typeof IncomeStabilityService);
  
  const service = new IncomeStabilityService();
  
  console.log('Service instance:', service);
  console.log('Available functions:', Object.getOwnPropertyNames(Object.getPrototypeOf(service)));
  
  // Test basic initialization
  expect(service.incomeKeywords).toBeDefined();
  expect(service.incomeKeywords).toContain('payroll');
  expect(service.minIncomeAmount).toBe(50);
  expect(service.maxIncomeInterval).toBe(45);

  // Test data - realistic income transactions
  const testTransactions = [
    { amount: 2500, description: 'PAYROLL DEPOSIT', date: '2024-01-01' },
    { amount: 2500, description: 'PAYROLL DEPOSIT', date: '2024-01-15' },
    { amount: 2500, description: 'PAYROLL DEPOSIT', date: '2024-02-01' },
    { amount: -100, description: 'GROCERY STORE', date: '2024-01-02' },
    { amount: 500, description: 'FREELANCE PAYMENT', date: '2024-01-10' }
  ];

  // Test analyze method
  const result = service.analyze(testTransactions);
  expect(result).toBeDefined();
  expect(result.stabilityScore).toBeDefined();
  expect(typeof result.stabilityScore).toBe('number');
  
  // Test filterIncomeTransactions method
  const incomeTransactions = service.filterIncomeTransactions(testTransactions);
  expect(incomeTransactions).toBeDefined();
  expect(Array.isArray(incomeTransactions)).toBe(true);
  expect(incomeTransactions.length).toBeGreaterThan(0);
  
  console.log('Analysis result:', result);
  console.log('Income transactions:', incomeTransactions);
});

test('Income Stability Service - Error Handling', () => {
  const service = new IncomeStabilityService();
  
  // Test with invalid input
  expect(() => service.analyze('not an array')).toThrow('Transactions must be an array');
  expect(() => service.analyze(null)).toThrow('Transactions must be an array');
  
  // Test with empty array
  const emptyResult = service.analyze([]);
  expect(emptyResult).toBeDefined();
  expect(emptyResult.stabilityScore).toBeDefined();
});
