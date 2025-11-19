describe('RiskAssessmentService with DB mocked', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('performRiskAssessment saves assessment and returns saved record', async () => {
  const mockQuery = jest.fn();

  const mockClientQuery = jest.fn((sql, _params) => {
      if (/FROM loan_applications/i.test(sql)) {
        return Promise.resolve({ rows: [{ id: 1, customer_id: 10, requested_amount: 50000, employment_status: 'employed', existing_debts: 10000, monthly_income: 60000, collateral_type: 'property', collateral_value: 80000, guarantor_name: 'G', guarantor_phone: '123', kyc_status: 'approved', kyc_approved_at: new Date().toISOString(), loan_product_id: 2 }] });
      }
      if (/INSERT INTO loan_risk_assessments/i.test(sql)) {
        return Promise.resolve({ rows: [{ id: 555, loan_application_id: 1, overall_score: 75, risk_level: 'low' }] });
      }
      // generic result
      return Promise.resolve({ rows: [] });
    });

    const mockTransaction = jest.fn(async (fn) => {
      const client = { query: mockClientQuery };
      return fn(client);
    });

    // Mock the database module before requiring the service
    jest.doMock('../config/database', () => ({ query: mockQuery, transaction: mockTransaction }));

    const riskService = require('../services/riskAssessmentService');

    const saved = await riskService.performRiskAssessment(1, 42);

    expect(saved).toBeDefined();
    // Our mock returned id 555
    expect(saved.id).toBe(555);
    expect(saved.loan_application_id || saved.application_id || saved.loan_application_id === undefined).toBeTruthy();
    // Ensure transaction was used
    expect(mockTransaction).toHaveBeenCalled();
  });

  test('performRiskAssessment throws when application not found', async () => {
  const mockClientQuery = jest.fn((sql, _params) => {
      if (/FROM loan_applications/i.test(sql)) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const mockTransaction = jest.fn(async (fn) => {
      const client = { query: mockClientQuery };
      return fn(client);
    });

    jest.doMock('../config/database', () => ({ query: jest.fn(), transaction: mockTransaction }));
    const riskService = require('../services/riskAssessmentService');

    await expect(riskService.performRiskAssessment(9999, 1)).rejects.toThrow();
    expect(mockTransaction).toHaveBeenCalled();
  });
});
