const express = require('express');
const router = express.Router();
const loanService = require('../services/loanService');
const riskAssessmentService = require('../services/riskAssessmentService');
const loanApprovalService = require('../services/loanApprovalService');
const auth = require('../middleware/auth');
// permissionMiddleware adapter: accepts an array of permission names or a single permission.
const permissionMiddleware = (perms) => {
  // perms can be an array like ['create_loan_application']
  const required = Array.isArray(perms) ? perms[0] : perms;
  // Our requirePermission takes (resource, action) — we store permissions as single keys, so map simple keys to resource/action when possible.
  // For backward compatibility, we'll call requirePermission with resource 'loans' and action = required where appropriate.
  return auth.requirePermission('loans', required);
};
const Joi = require('joi');

// Validation schemas
const loanApplicationSchema = Joi.object({
  customer_id: Joi.number().integer().positive().required(),
  loan_product_id: Joi.number().integer().positive().required(),
  requested_amount: Joi.number().positive().required(),
  term_months: Joi.number().integer().min(1).max(240).required(),
  interest_rate: Joi.number().positive().optional(),
  payment_frequency: Joi.string().valid('weekly', 'bi_weekly', 'monthly', 'quarterly').optional(),
  purpose: Joi.string().min(10).max(500).required(),
  employment_status: Joi.string().valid('employed', 'self_employed', 'unemployed', 'retired', 'student').required(),
  monthly_income: Joi.number().positive().required(),
  existing_debts: Joi.number().min(0).optional(),
  collateral_type: Joi.string().valid('none', 'property', 'vehicle', 'gold', 'fixed_deposit', 'guarantee', 'business_assets', 'other').optional(),
  collateral_value: Joi.number().min(0).optional(),
  collateral_description: Joi.string().max(500).optional(),
  guarantor_name: Joi.string().max(100).optional(),
  guarantor_phone: Joi.string().pattern(/^[0-9]{10,15}$/).optional(),
  guarantor_relationship: Joi.string().max(100).optional(),
  proposed_start_date: Joi.date().min('now').optional(),
  branch_id: Joi.number().integer().positive().optional()
});

const loanApplicationUpdateSchema = Joi.object({
  requested_amount: Joi.number().positive().optional(),
  term_months: Joi.number().integer().min(1).max(240).optional(),
  interest_rate: Joi.number().positive().optional(),
  payment_frequency: Joi.string().valid('weekly', 'bi_weekly', 'monthly', 'quarterly').optional(),
  purpose: Joi.string().min(10).max(500).optional(),
  employment_status: Joi.string().valid('employed', 'self_employed', 'unemployed', 'retired', 'student').optional(),
  monthly_income: Joi.number().positive().optional(),
  existing_debts: Joi.number().min(0).optional(),
  collateral_type: Joi.string().valid('none', 'property', 'vehicle', 'gold', 'fixed_deposit', 'guarantee', 'business_assets', 'other').optional(),
  collateral_value: Joi.number().min(0).optional(),
  collateral_description: Joi.string().max(500).optional(),
  guarantor_name: Joi.string().max(100).optional(),
  guarantor_phone: Joi.string().pattern(/^[0-9]{10,15}$/).optional(),
  guarantor_relationship: Joi.string().max(100).optional(),
  proposed_start_date: Joi.date().min('now').optional()
});

const paymentCalculationSchema = Joi.object({
  principal: Joi.number().positive().required(),
  interest_rate: Joi.number().positive().required(),
  term_months: Joi.number().integer().min(1).max(240).required(),
  payment_frequency: Joi.string().valid('weekly', 'bi_weekly', 'monthly', 'quarterly').optional(),
  start_date: Joi.date().optional()
});

/**
 * @route POST /api/loans/applications
 * @desc Create a new loan application
 * @access Private (loan_officer, branch_manager, finance_manager, ceo)
 */
router.post('/applications', 
  auth.authenticateToken, 
  permissionMiddleware(['create_loan_application']),
  async (req, res) => {
    try {
      const { error } = loanApplicationSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const application = await loanService.createLoanApplication(req.body, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Loan application created successfully',
        data: {
          application,
          next_steps: [
            'Upload required documents',
            'Complete guarantor information if applicable',
            'Submit application for review'
          ]
        }
      });
    } catch (error) {
      console.error('Error creating loan application:', error);
      res.status(error.message.includes('not found') || error.message.includes('must be') ? 400 : 500).json({
        success: false,
        message: error.message || 'Failed to create loan application'
      });
    }
  }
);

/**
 * @route GET /api/loans/applications/:id
 * @desc Get loan application by ID
 * @access Private (based on branch access and role)
 */
router.get('/applications/:id',
  auth.authenticateToken,
  permissionMiddleware(['view_loan_application']),
  async (req, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      if (isNaN(applicationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid application ID'
        });
      }

      const options = {
        includePaymentSchedule: req.query.include_schedule === 'true',
        includeDocuments: req.query.include_documents === 'true',
        includeApprovalHistory: req.query.include_approvals === 'true'
      };

      const application = await loanService.getLoanApplicationById(applicationId, options);

      res.json({
        success: true,
        data: application
      });
    } catch (error) {
      console.error('Error getting loan application:', error);
      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to get loan application'
      });
    }
  }
);

/**
 * @route PUT /api/loans/applications/:id
 * @desc Update loan application
 * @access Private (loan_officer, branch_manager, finance_manager, ceo)
 */
router.put('/applications/:id',
  auth.authenticateToken,
  permissionMiddleware(['update_loan_application']),
  async (req, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      if (isNaN(applicationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid application ID'
        });
      }

      const { error } = loanApplicationUpdateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const application = await loanService.updateLoanApplication(applicationId, req.body, req.user.id);

      res.json({
        success: true,
        message: 'Loan application updated successfully',
        data: application
      });
    } catch (error) {
      console.error('Error updating loan application:', error);
      res.status(error.message.includes('not found') || error.message.includes('cannot be') ? 400 : 500).json({
        success: false,
        message: error.message || 'Failed to update loan application'
      });
    }
  }
);

/**
 * @route POST /api/loans/applications/:id/submit
 * @desc Submit loan application for review
 * @access Private (loan_officer, branch_manager, finance_manager, ceo)
 */
router.post('/applications/:id/submit',
  auth.authenticateToken,
  permissionMiddleware(['submit_loan_application']),
  async (req, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      if (isNaN(applicationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid application ID'
        });
      }

      const application = await loanService.submitLoanApplication(applicationId, req.user.id);

      res.json({
        success: true,
        message: 'Loan application submitted for review',
        data: {
          application,
          workflow_initiated: true,
          next_steps: [
            'Application will be reviewed by loan officers',
            'Risk assessment will be conducted',
            'Approval workflow will proceed based on amount'
          ]
        }
      });
    } catch (error) {
      console.error('Error submitting loan application:', error);
      res.status(error.message.includes('not found') || error.message.includes('Only') ? 400 : 500).json({
        success: false,
        message: error.message || 'Failed to submit loan application'
      });
    }
  }
);

/**
 * @route GET /api/loans/applications/:id/payment-schedule
 * @desc Get payment schedule for loan application
 * @access Private (based on branch access and role)
 */
router.get('/applications/:id/payment-schedule',
  auth.authenticateToken,
  permissionMiddleware(['view_loan_application']),
  async (req, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      if (isNaN(applicationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid application ID'
        });
      }

      const schedule = await loanService.getPaymentSchedule(applicationId);

      res.json({
        success: true,
        data: {
          application_id: applicationId,
          schedule,
          summary: {
            total_payments: schedule.length,
            total_amount: schedule.reduce((sum, payment) => sum + payment.payment_amount, 0),
            total_interest: schedule.reduce((sum, payment) => sum + payment.interest_amount, 0),
            total_principal: schedule.reduce((sum, payment) => sum + payment.principal_amount, 0)
          }
        }
      });
    } catch (error) {
      console.error('Error getting payment schedule:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment schedule'
      });
    }
  }
);

/**
 * @route POST /api/loans/calculate-payment
 * @desc Calculate loan payment schedule (utility endpoint)
 * @access Private (loan_officer, branch_manager, finance_manager, ceo)
 */
router.post('/calculate-payment',
  auth.authenticateToken,
  permissionMiddleware(['create_loan_application']),
  async (req, res) => {
    try {
      const { error } = paymentCalculationSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const calculation = await loanService.calculatePaymentSchedule({
        principal: req.body.principal,
        interestRate: req.body.interest_rate,
        termMonths: req.body.term_months,
        paymentFrequency: req.body.payment_frequency || 'monthly',
        startDate: req.body.start_date || new Date()
      });

      res.json({
        success: true,
        data: {
          loan_parameters: {
            principal: req.body.principal,
            interest_rate: req.body.interest_rate,
            term_months: req.body.term_months,
            payment_frequency: req.body.payment_frequency || 'monthly'
          },
          calculation: {
            monthly_payment: calculation.monthlyPayment,
            total_amount: calculation.totalAmount,
            total_interest: calculation.totalInterest,
            total_payments: calculation.schedule.length
          },
          schedule: calculation.schedule
        }
      });
    } catch (error) {
      console.error('Error calculating payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate payment schedule'
      });
    }
  }
);

/**
 * @route GET /api/loans/lookup/statuses
 * @desc Get loan statuses
 * @access Private
 */
router.get('/lookup/statuses',
  auth.authenticateToken,
  async (req, res) => {
    try {
      const statuses = loanService.getLoanStatuses();
      
      res.json({
        success: true,
        data: Object.entries(statuses).map(([value, label]) => ({
          value,
          label
        }))
      });
    } catch (error) {
      console.error('Error getting loan statuses:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get loan statuses'
      });
    }
  }
);

/**
 * @route GET /api/loans/lookup/payment-frequencies
 * @desc Get payment frequencies
 * @access Private
 */
router.get('/lookup/payment-frequencies',
  auth.authenticateToken,
  async (req, res) => {
    try {
      const frequencies = loanService.getPaymentFrequencies();
      
      res.json({
        success: true,
        data: Object.entries(frequencies).map(([value, label]) => ({
          value,
          label
        }))
      });
    } catch (error) {
      console.error('Error getting payment frequencies:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment frequencies'
      });
    }
  }
);

/**
 * @route GET /api/loans/lookup/collateral-types
 * @desc Get collateral types
 * @access Private
 */
router.get('/lookup/collateral-types',
  auth.authenticateToken,
  async (req, res) => {
    try {
      const types = loanService.getCollateralTypes();
      
      res.json({
        success: true,
        data: Object.entries(types).map(([value, label]) => ({
          value,
          label
        }))
      });
    } catch (error) {
      console.error('Error getting collateral types:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get collateral types'
      });
    }
  }
);

/**
 * @route GET /api/loans/applications/:id/approvals
 * @desc Get approval history for loan application
 * @access Private (loan_officer, branch_manager, finance_manager, ceo)
 */
router.get('/applications/:id/approvals',
  auth.authenticateToken,
  permissionMiddleware(['view_loan_application']),
  async (req, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      if (isNaN(applicationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid application ID'
        });
      }

      const approvals = await loanApprovalService.getApprovalWorkflow(applicationId);

      res.json({
        success: true,
        data: {
          application_id: applicationId,
          approval_workflow: approvals,
          workflow_status: {
            pending_approvals: approvals.filter(a => a.status === 'pending').length,
            completed_approvals: approvals.filter(a => a.status === 'approved').length,
            rejected_approvals: approvals.filter(a => a.status === 'rejected').length
          }
        }
      });
    } catch (error) {
      console.error('Error getting approval history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get approval history'
      });
    }
  }
);

/**
 * @route POST /api/loans/applications/:id/approve
 * @desc Approve or reject loan application at specific level
 * @access Private (loan_officer, branch_manager, finance_manager, ceo)
 */
router.post('/applications/:id/approve',
  auth.authenticateToken,
  permissionMiddleware(['approve_loan_application']),
  async (req, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      if (isNaN(applicationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid application ID'
        });
      }

      const approvalSchema = Joi.object({
        approval_level: Joi.number().integer().min(1).max(4).required(),
        decision: Joi.string().valid('approved', 'rejected').required(),
        comments: Joi.string().max(500).optional(),
        rejection_reason: Joi.string().max(500).when('decision', {
          is: 'rejected',
          then: Joi.required(),
          otherwise: Joi.optional()
        })
      });

      const { error } = approvalSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const result = await loanApprovalService.processApproval(
        applicationId,
        req.body.approval_level,
        {
          decision: req.body.decision,
          comments: req.body.comments,
          rejection_reason: req.body.rejection_reason
        },
        req.user.id
      );

      res.json({
        success: true,
        message: `Loan application ${req.body.decision} successfully`,
        data: result
      });
    } catch (error) {
      console.error('Error processing approval:', error);
      res.status(error.message.includes('not found') || error.message.includes('authority') ? 400 : 500).json({
        success: false,
        message: error.message || 'Failed to process approval'
      });
    }
  }
);

/**
 * @route POST /api/loans/applications/:id/escalate
 * @desc Escalate loan application to higher approval level
 * @access Private (loan_officer, branch_manager, finance_manager)
 */
router.post('/applications/:id/escalate',
  auth.authenticateToken,
  permissionMiddleware(['manage_loan_workflow']),
  async (req, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      if (isNaN(applicationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid application ID'
        });
      }

      const escalationSchema = Joi.object({
        current_level: Joi.number().integer().min(1).max(3).required(),
        reason: Joi.string().min(10).max(500).required()
      });

      const { error } = escalationSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const result = await loanApprovalService.escalateApproval(
        applicationId,
        req.body.current_level,
        req.body.reason,
        req.user.id
      );

      res.json({
        success: true,
        message: 'Loan application escalated successfully',
        data: result
      });
    } catch (error) {
      console.error('Error escalating approval:', error);
      res.status(error.message.includes('not found') || error.message.includes('Cannot') ? 400 : 500).json({
        success: false,
        message: error.message || 'Failed to escalate approval'
      });
    }
  }
);

/**
 * @route GET /api/loans/pending-approvals
 * @desc Get loan applications pending approval for current user
 * @access Private (loan_officer, branch_manager, finance_manager, ceo)
 */
router.get('/pending-approvals',
  auth.authenticateToken,
  permissionMiddleware(['view_loan_application']),
  async (req, res) => {
    try {
      const filters = {
        min_amount: req.query.min_amount ? parseFloat(req.query.min_amount) : undefined,
        max_amount: req.query.max_amount ? parseFloat(req.query.max_amount) : undefined,
        submitted_after: req.query.submitted_after || undefined
      };

      const pendingApprovals = await loanApprovalService.getPendingApprovals(req.user.id, filters);

      res.json({
        success: true,
        data: {
          pending_approvals: pendingApprovals,
          total_count: pendingApprovals.length,
          filters_applied: Object.keys(filters).filter(key => filters[key] !== undefined)
        }
      });
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pending approvals'
      });
    }
  }
);

/**
 * @route POST /api/loans/applications/:id/risk-assessment
 * @desc Perform risk assessment for loan application
 * @access Private (loan_officer, branch_manager, finance_manager)
 */
router.post('/applications/:id/risk-assessment',
  auth.authenticateToken,
  permissionMiddleware(['perform_risk_assessment']),
  async (req, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      if (isNaN(applicationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid application ID'
        });
      }

      const assessment = await riskAssessmentService.performRiskAssessment(applicationId, req.user.id);

      res.json({
        success: true,
        message: 'Risk assessment completed successfully',
        data: assessment
      });
    } catch (error) {
      console.error('Error performing risk assessment:', error);
      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to perform risk assessment'
      });
    }
  }
);

/**
 * @route GET /api/loans/applications/:id/risk-assessment
 * @desc Get risk assessment for loan application
 * @access Private (loan_officer, branch_manager, finance_manager, ceo)
 */
router.get('/applications/:id/risk-assessment',
  auth.authenticateToken,
  permissionMiddleware(['view_risk_assessment']),
  async (req, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      if (isNaN(applicationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid application ID'
        });
      }

      const assessment = await riskAssessmentService.getRiskAssessment(applicationId);

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Risk assessment not found for this application'
        });
      }

      res.json({
        success: true,
        data: assessment
      });
    } catch (error) {
      console.error('Error getting risk assessment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get risk assessment'
      });
    }
  }
);

/**
 * @route POST /api/loans/bulk-approve
 * @desc Bulk approve/reject multiple loan applications
 * @access Private (branch_manager, finance_manager, ceo)
 */
router.post('/bulk-approve',
  auth.authenticateToken,
  permissionMiddleware(['approve_loan_application']),
  async (req, res) => {
    try {
      const bulkSchema = Joi.object({
        applications: Joi.array().items(
          Joi.object({
            application_id: Joi.number().integer().positive().required(),
            approval_level: Joi.number().integer().min(1).max(4).required(),
            decision: Joi.string().valid('approved', 'rejected').required(),
            comments: Joi.string().max(500).optional(),
            rejection_reason: Joi.string().max(500).optional()
          })
        ).min(1).max(50).required()
      });

      const { error } = bulkSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const results = await loanApprovalService.bulkApprove(req.body.applications, req.user.id);

      res.json({
        success: true,
        message: 'Bulk approval processing completed',
        data: results
      });
    } catch (error) {
      console.error('Error in bulk approval:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process bulk approval'
      });
    }
  }
);

/**
 * @route GET /api/loans/approval-statistics
 * @desc Get loan approval statistics for reporting
 * @access Private (branch_manager, finance_manager, ceo, admin)
 */
router.get('/approval-statistics',
  auth.authenticateToken,
  permissionMiddleware(['loan_reports']),
  async (req, res) => {
    try {
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        branch_id: req.query.branch_id ? parseInt(req.query.branch_id) : undefined
      };

      const statistics = await loanApprovalService.getApprovalStatistics(filters);

      res.json({
        success: true,
        data: {
          statistics,
          filters_applied: filters,
          generated_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting approval statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get approval statistics'
      });
    }
  }
);

/**
 * Error handling middleware
 */
router.use((error, req, res, _next) => {
  console.error('Loan routes error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: error.message })
  });
});

module.exports = router;