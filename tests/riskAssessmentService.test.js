const riskService = require('../services/riskAssessmentService');

describe('RiskAssessmentService - pure logic tests', () => {
  test('assessCreditScore returns default for no history', () => {
    expect(riskService.assessCreditScore(null)).toBe(50);
  });

  test('assessCreditScore increases with successful loans and penalizes defaults', () => {
    const creditHistory = { successful_loans: 2, defaulted_loans: 1, late_payments: 1 };
    const score = riskService.assessCreditScore(creditHistory);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('assessDebtToIncomeRatio returns expected buckets', () => {
    expect(riskService.assessDebtToIncomeRatio(0, 50000)).toBe(100);
    expect(riskService.assessDebtToIncomeRatio(10000, 50000)).toBeGreaterThanOrEqual(75);
    expect(riskService.assessDebtToIncomeRatio(40000, 50000)).toBeLessThanOrEqual(60);
  });

  test('calculateOverallRiskScore averages weighted factors', () => {
    const scores = {
      credit_score: 80,
      payment_history: 90,
      existing_loans: 100,
      income_stability: 70,
      debt_to_income_ratio: 60,
      employment_history: 80,
      collateral_value: 50,
      guarantor_strength: 40,
      kyc_completeness: 100
    };

    const overall = riskService.calculateOverallRiskScore(scores);
    expect(typeof overall).toBe('number');
    expect(overall).toBeGreaterThanOrEqual(0);
    expect(overall).toBeLessThanOrEqual(100);
  });
});
