const loanService = require('../services/loanService');

describe('LoanService smoke tests', () => {
  test('loanService should export functions', () => {
    expect(loanService).toBeDefined();
    expect(typeof loanService.createLoanApplication).toBe('function');
    expect(typeof loanService.calculatePaymentSchedule).toBe('function');
  });

  test('calculatePaymentSchedule returns schedule for valid params', async () => {
    const result = await loanService.calculatePaymentSchedule({
      principal: 100000,
      interestRate: 12,
      termMonths: 12,
      paymentFrequency: 'monthly',
      startDate: new Date()
    });

    expect(result).toBeDefined();
    expect(result.schedule).toBeInstanceOf(Array);
    expect(result.schedule.length).toBeGreaterThan(0);
  });
});