const approvalService = require('../services/loanApprovalService');

describe('LoanApprovalService - pure logic tests', () => {
  test('getRequiredRoleForLevel returns correct roles per amount', () => {
    expect(approvalService.getRequiredRoleForLevel(1, 50000)).toBe('loan_officer');
    expect(approvalService.getRequiredRoleForLevel(2, 200000)).toBe('branch_manager');
    expect(approvalService.getRequiredRoleForLevel(3, 1000000)).toBe('finance_manager');
  });

  test('getNextSteps returns reasonable array for statuses', async () => {
    const stepsPending = await approvalService.getNextSteps(1, 'pending_approval');
    expect(Array.isArray(stepsPending)).toBe(true);
    const stepsApproved = await approvalService.getNextSteps(1, 'approved');
    expect(stepsApproved).toContain('Loan account will be created');
    const stepsRejected = await approvalService.getNextSteps(1, 'rejected');
    expect(stepsRejected).toContain('Customer will be notified of rejection');
  });
});
