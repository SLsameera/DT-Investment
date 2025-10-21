describe('LoanApprovalService with DB mocked', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('processApproval approves application when final approval level and no pending approvals', async () => {
  const mockClientQuery = jest.fn((sql, _params) => {
      // Return application
      if (/SELECT \* FROM loan_applications WHERE id = \$1/.test(sql)) {
        return Promise.resolve({ rows: [{ id: 1, status: 'submitted', requested_amount: 10000, application_id: 'APP-1' }] });
      }
      // pending approval lookup
      if (/FROM loan_approvals\s+WHERE loan_application_id = \$1 AND approval_level = \$2 AND status = 'pending'/.test(sql)) {
        return Promise.resolve({ rows: [{ id: 77, required_role: 'loan_officer', is_required: true }] });
      }
      // pending count
      if (/SELECT COUNT\(\*\) as pending_count\s+FROM loan_approvals/.test(sql)) {
        return Promise.resolve({ rows: [{ pending_count: '0' }] });
      }
      // update loan_approvals returning *
      if (/UPDATE loan_approvals\s+SET\s+status = \$1,\s+approved_by = \$2,/.test(sql)) {
        return Promise.resolve({ rows: [{ id: 77, status: 'approved' }] });
      }
      // final update on loan_applications
      if (/UPDATE loan_applications\s+SET status = 'approved'/.test(sql)) {
        return Promise.resolve({ rows: [] });
      }

      return Promise.resolve({ rows: [] });
    });

    const mockTransaction = jest.fn(async (fn) => {
      const client = { query: mockClientQuery };
      return fn(client);
    });

    // module-level query used by validateApprovalAuthority and other helpers
  const moduleQuery = jest.fn((sql, _params) => {
      if (/SELECT role, hierarchy_level FROM users WHERE id = \$1/.test(sql)) {
        return Promise.resolve({ rows: [{ role: 'finance_manager', hierarchy_level: 3 }] });
      }
      // fallback - return empty
      return Promise.resolve({ rows: [] });
    });

    jest.doMock('../config/database', () => ({ query: moduleQuery, transaction: mockTransaction }));

    const approvalService = require('../services/loanApprovalService');

    const result = await approvalService.processApproval(1, 1, { decision: 'approved' }, 99);

    expect(result).toBeDefined();
    expect(result.application_status).toBe('approved');
    expect(mockTransaction).toHaveBeenCalled();
  });

  test('processApproval throws when user lacks authority', async () => {
  const mockClientQuery = jest.fn((sql, _params) => {
      if (/SELECT \* FROM loan_applications WHERE id = \$1/.test(sql)) {
        return Promise.resolve({ rows: [{ id: 2, status: 'submitted', requested_amount: 10000, application_id: 'APP-2' }] });
      }
      if (/FROM loan_approvals\s+WHERE loan_application_id = \$1 AND approval_level = \$2 AND status = 'pending'/.test(sql)) {
        return Promise.resolve({ rows: [{ id: 88, required_role: 'ceo', is_required: true }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const mockTransaction = jest.fn(async (fn) => {
      const client = { query: mockClientQuery };
      return fn(client);
    });

    // module query returns a low-authority user
  const moduleQuery = jest.fn((sql, _params) => {
      if (/SELECT role, hierarchy_level FROM users WHERE id = \$1/.test(sql)) {
        return Promise.resolve({ rows: [{ role: 'loan_officer', hierarchy_level: 1 }] });
      }
      return Promise.resolve({ rows: [] });
    });

    jest.doMock('../config/database', () => ({ query: moduleQuery, transaction: mockTransaction }));
    const approvalService = require('../services/loanApprovalService');

    await expect(approvalService.processApproval(2, 2, { decision: 'approved' }, 100)).rejects.toThrow();
    expect(mockTransaction).toHaveBeenCalled();
  });
});
