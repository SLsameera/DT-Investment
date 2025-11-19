const { query, transaction } = require('../config/database');
// const loanService = require('./loanService'); // reserved for future use
// const riskAssessmentService = require('./riskAssessmentService'); // reserved for future use

class LoanApprovalService {
  constructor() {
    this.approvalStatuses = {
      'pending': 'Pending Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'escalated': 'Escalated'
    };

    this.workflowSteps = {
      1: { role: 'loan_officer', description: 'Initial review and documentation check' },
      2: { role: 'branch_manager', description: 'Branch-level approval' },
      3: { role: 'finance_manager', description: 'Financial review and final approval' },
      4: { role: 'ceo', description: 'Executive approval for high-value loans' }
    };
  }

  /**
   * Approve or reject a loan application at specific approval level
   * @param {number} applicationId - Loan application ID
   * @param {number} approvalLevel - Approval level (1-4)
   * @param {Object} approvalData - Approval decision data
   * @param {number} approvedBy - ID of user making approval decision
   * @returns {Object} Approval result
   */
  async processApproval(applicationId, approvalLevel, approvalData, approvedBy) {
    try {
      return await transaction(async (client) => {
        // Get loan application
        const appResult = await client.query(
          'SELECT * FROM loan_applications WHERE id = $1',
          [applicationId]
        );

        if (appResult.rows.length === 0) {
          throw new Error('Loan application not found');
        }

        const application = appResult.rows[0];

        // Validate application status
        if (!['submitted', 'under_review', 'pending_approval'].includes(application.status)) {
          throw new Error('Application is not in a reviewable status');
        }

        // Get pending approval for this level
        const approvalResult = await client.query(`
          SELECT * FROM loan_approvals 
          WHERE loan_application_id = $1 AND approval_level = $2 AND status = 'pending'
        `, [applicationId, approvalLevel]);

        if (approvalResult.rows.length === 0) {
          throw new Error('No pending approval found for this level');
        }

        const approval = approvalResult.rows[0];

        // Validate user can make this approval
        await this.validateApprovalAuthority(approvedBy, approval.required_role, application.requested_amount);

        // Update approval record
        const updatedApproval = await client.query(`
          UPDATE loan_approvals 
          SET 
            status = $1,
            approved_by = $2,
            approved_at = CURRENT_TIMESTAMP,
            comments = $3,
            rejection_reason = $4
          WHERE id = $5
          RETURNING *
        `, [
          approvalData.decision, // 'approved' or 'rejected'
          approvedBy,
          approvalData.comments || null,
          approvalData.rejection_reason || null,
          approval.id
        ]);

        // Process the approval decision
        let applicationStatus = application.status;
        // define pendingCount in outer scope so return can reference it safely
        let pendingCount = null;

        if (approvalData.decision === 'approved') {
          // Check if this was the final approval level
          const pendingApprovalsResult = await client.query(`
            SELECT COUNT(*) as pending_count 
            FROM loan_approvals 
            WHERE loan_application_id = $1 AND status = 'pending' AND is_required = true
          `, [applicationId]);

          pendingCount = parseInt(pendingApprovalsResult.rows[0].pending_count);

          if (pendingCount === 0) {
            // All approvals complete - approve the loan
            applicationStatus = 'approved';
            await client.query(`
              UPDATE loan_applications 
              SET status = 'approved', approved_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `, [applicationId]);

            // Create loan account (placeholder for future implementation)
            await this.createLoanAccount(client, application);

          } else {
            // Move to pending approval status
            applicationStatus = 'pending_approval';
            await client.query(`
              UPDATE loan_applications 
              SET status = 'pending_approval'
              WHERE id = $1
            `, [applicationId]);
          }

        } else if (approvalData.decision === 'rejected') {
          // Reject the loan application
          applicationStatus = 'rejected';
          await client.query(`
            UPDATE loan_applications 
            SET 
              status = 'rejected',
              rejected_at = CURRENT_TIMESTAMP,
              rejection_reason = $1
            WHERE id = $2
          `, [approvalData.rejection_reason, applicationId]);

          // Mark all other pending approvals as cancelled
          await client.query(`
            UPDATE loan_approvals 
            SET status = 'cancelled'
            WHERE loan_application_id = $1 AND status = 'pending'
          `, [applicationId]);
        }

        // Log the approval action
        await this.logApprovalActivity(client, applicationId, approvedBy, approvalData.decision, {
          approval_level: approvalLevel,
          comments: approvalData.comments,
          rejection_reason: approvalData.rejection_reason,
          new_status: applicationStatus
        });

        // Send notifications (placeholder)
        await this.sendApprovalNotifications(application, approvalData.decision, approvedBy);

        return {
          approval: updatedApproval.rows[0],
          application_status: applicationStatus,
          workflow_complete: pendingCount === 0 && approvalData.decision === 'approved',
          next_steps: await this.getNextSteps(applicationId, applicationStatus)
        };
      });
    } catch (error) {
      console.error('Error processing loan approval:', error);
      throw error;
    }
  }

  /**
   * Get loan approval workflow status
   * @param {number} applicationId - Loan application ID
   * @returns {Object} Workflow status
   */
  async getApprovalWorkflow(applicationId) {
    try {
      const result = await query(`
        SELECT 
          la.*,
          u.first_name, u.last_name, u.role,
          u.id as approver_id
        FROM loan_approvals la
        LEFT JOIN users u ON la.approved_by = u.id
        WHERE la.loan_application_id = $1
        ORDER BY la.approval_level
      `, [applicationId]);

      return result.rows.map(approval => ({
        id: approval.id,
        level: approval.approval_level,
        required_role: approval.required_role,
        step_description: this.workflowSteps[approval.approval_level]?.description || 'Review step',
        status: approval.status,
        status_display: this.approvalStatuses[approval.status] || approval.status,
        approver: approval.first_name && approval.last_name 
          ? {
              id: approval.approver_id,
              name: `${approval.first_name} ${approval.last_name}`,
              role: approval.role
            }
          : null,
        approved_at: approval.approved_at,
        comments: approval.comments,
        rejection_reason: approval.rejection_reason,
        is_required: approval.is_required,
        can_approve: approval.status === 'pending'
      }));
    } catch (error) {
      console.error('Error getting approval workflow:', error);
      throw error;
    }
  }

  /**
   * Escalate loan application to higher approval level
   * @param {number} applicationId - Loan application ID
   * @param {number} currentLevel - Current approval level
   * @param {string} reason - Escalation reason
   * @param {number} escalatedBy - ID of user escalating
   * @returns {Object} Escalation result
   */
  async escalateApproval(applicationId, currentLevel, reason, escalatedBy) {
    try {
      return await transaction(async (client) => {
        // Get application
        const appResult = await client.query(
          'SELECT * FROM loan_applications WHERE id = $1',
          [applicationId]
        );

        if (appResult.rows.length === 0) {
          throw new Error('Loan application not found');
        }

        const application = appResult.rows[0];

        // Create escalation approval level if not exists
        const nextLevel = currentLevel + 1;
        const nextRole = this.getRequiredRoleForLevel(nextLevel, application.requested_amount);

        if (!nextRole) {
          throw new Error('Cannot escalate beyond highest approval level');
        }

        // Check if escalation level already exists
        const existingResult = await client.query(`
          SELECT * FROM loan_approvals 
          WHERE loan_application_id = $1 AND approval_level = $2
        `, [applicationId, nextLevel]);

        let escalationApproval;

        if (existingResult.rows.length === 0) {
          // Create new escalation level
          const escalationResult = await client.query(`
            INSERT INTO loan_approvals (
              loan_application_id, approval_level, required_role, 
              status, is_required, created_at
            ) VALUES ($1, $2, $3, 'pending', true, CURRENT_TIMESTAMP)
            RETURNING *
          `, [applicationId, nextLevel, nextRole]);

          escalationApproval = escalationResult.rows[0];
        } else {
          // Update existing escalation level to pending
          const escalationResult = await client.query(`
            UPDATE loan_approvals 
            SET status = 'pending', is_required = true
            WHERE id = $1
            RETURNING *
          `, [existingResult.rows[0].id]);

          escalationApproval = escalationResult.rows[0];
        }

        // Update current level status to escalated
        await client.query(`
          UPDATE loan_approvals 
          SET status = 'escalated', comments = $1
          WHERE loan_application_id = $2 AND approval_level = $3
        `, [reason, applicationId, currentLevel]);

        // Log escalation
        await this.logApprovalActivity(client, applicationId, escalatedBy, 'escalated', {
          from_level: currentLevel,
          to_level: nextLevel,
          reason: reason
        });

        return {
          escalated_to_level: nextLevel,
          required_role: nextRole,
          escalation_approval: escalationApproval,
          reason: reason
        };
      });
    } catch (error) {
      console.error('Error escalating approval:', error);
      throw error;
    }
  }

  /**
   * Bulk approve multiple loan applications
   * @param {Array} applications - Array of application IDs with approval data
   * @param {number} approvedBy - ID of user making bulk approval
   * @returns {Object} Bulk approval results
   */
  async bulkApprove(applications, approvedBy) {
    try {
      const results = {
        successful: [],
        failed: [],
        summary: {
          total: applications.length,
          approved: 0,
          rejected: 0,
          failed: 0
        }
      };

      for (const appData of applications) {
        try {
          const result = await this.processApproval(
            appData.application_id,
            appData.approval_level,
            {
              decision: appData.decision,
              comments: appData.comments,
              rejection_reason: appData.rejection_reason
            },
            approvedBy
          );

          results.successful.push({
            application_id: appData.application_id,
            result: result
          });

          if (appData.decision === 'approved') {
            results.summary.approved++;
          } else {
            results.summary.rejected++;
          }

        } catch (error) {
          results.failed.push({
            application_id: appData.application_id,
            error: error.message
          });
          results.summary.failed++;
        }
      }

      return results;
    } catch (error) {
      console.error('Error in bulk approval:', error);
      throw error;
    }
  }

  /**
   * Get loan applications pending approval for a specific user
   * @param {number} userId - User ID
   * @param {Object} filters - Optional filters
   * @returns {Array} Pending applications
   */
  async getPendingApprovals(userId, filters = {}) {
    try {
      // Get user's role and authorities
      const userResult = await query(
        'SELECT role, branch_id FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Build query for pending approvals
      let whereConditions = ['la.status = $1', 'lap.required_role = $2'];
      let queryParams = ['pending', user.role];
      let paramCount = 2;

      // Add branch filter for non-admin roles
      if (!['super_admin', 'admin', 'ceo'].includes(user.role)) {
        whereConditions.push(`lapp.branch_id = $${++paramCount}`);
        queryParams.push(user.branch_id);
      }

      // Add amount range filter if provided
      if (filters.min_amount) {
        whereConditions.push(`lapp.requested_amount >= $${++paramCount}`);
        queryParams.push(filters.min_amount);
      }

      if (filters.max_amount) {
        whereConditions.push(`lapp.requested_amount <= $${++paramCount}`);
        queryParams.push(filters.max_amount);
      }

      // Add date range filter if provided
      if (filters.submitted_after) {
        whereConditions.push(`lapp.submitted_at >= $${++paramCount}`);
        queryParams.push(filters.submitted_after);
      }

      const result = await query(`
        SELECT 
          lapp.id, lapp.application_id, lapp.requested_amount, lapp.term_months,
          lapp.submitted_at, lapp.status as app_status,
          lap.id as approval_id, lap.approval_level, lap.required_role,
          c.customer_id, c.first_name, c.last_name, c.phone_number,
          lp.name as product_name,
          b.name as branch_name
        FROM loan_approvals lap
        JOIN loan_applications lapp ON lap.loan_application_id = lapp.id
        JOIN customers c ON lapp.customer_id = c.id
        JOIN loan_products lp ON lapp.loan_product_id = lp.id
        JOIN branches b ON lapp.branch_id = b.id
        WHERE ${whereConditions.join(' AND ')} AND lap.status = 'pending'
        ORDER BY lapp.submitted_at ASC
      `, queryParams);

      return result.rows.map(app => ({
        application: {
          id: app.id,
          application_id: app.application_id,
          amount: app.requested_amount,
          term_months: app.term_months,
          submitted_at: app.submitted_at,
          status: app.app_status
        },
        approval: {
          id: app.approval_id,
          level: app.approval_level,
          required_role: app.required_role
        },
        customer: {
          customer_id: app.customer_id,
          name: `${app.first_name} ${app.last_name}`,
          phone: app.phone_number
        },
        product: {
          name: app.product_name
        },
        branch: {
          name: app.branch_name
        }
      }));
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      throw error;
    }
  }

  /**
   * Validate user has authority to make approval at specific level
   * @param {number} userId - User ID
   * @param {string} requiredRole - Required role for approval
   * @param {number} loanAmount - Loan amount
   */
  async validateApprovalAuthority(userId, requiredRole, loanAmount) {
    const userResult = await query(
      'SELECT role, hierarchy_level FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    // Check if user has required role or higher authority
    const roleHierarchy = {
      'loan_officer': 1,
      'branch_manager': 2,
      'finance_manager': 3,
      'ceo': 4,
      'admin': 5,
      'super_admin': 6
    };

    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 999;

    if (userLevel < requiredLevel) {
      throw new Error('Insufficient authority for this approval level');
    }

    // Additional amount-based checks
    if (loanAmount > 5000000 && user.role !== 'ceo' && !['admin', 'super_admin'].includes(user.role)) {
      throw new Error('CEO approval required for loans above 5,000,000');
    }
  }

  /**
   * Get required role for approval level based on loan amount
   * @param {number} level - Approval level
   * @param {number} amount - Loan amount
   * @returns {string} Required role
   */
  getRequiredRoleForLevel(level, amount) {
    if (amount <= 100000) {
      switch (level) {
        case 1: return 'loan_officer';
        default: return null;
      }
    } else if (amount <= 500000) {
      switch (level) {
        case 1: return 'loan_officer';
        case 2: return 'branch_manager';
        default: return null;
      }
    } else if (amount <= 5000000) {
      switch (level) {
        case 1: return 'loan_officer';
        case 2: return 'branch_manager';
        case 3: return 'finance_manager';
        default: return null;
      }
    } else {
      switch (level) {
        case 1: return 'loan_officer';
        case 2: return 'branch_manager';
        case 3: return 'finance_manager';
        case 4: return 'ceo';
        default: return null;
      }
    }
  }

  /**
   * Create loan account after final approval (placeholder)
   * @param {Object} client - Database client
   * @param {Object} application - Loan application data
   */
  async createLoanAccount(client, application) {
    // TODO: Implement loan account creation
    // This would create the active loan record, set up payment schedules, etc.
    
    await this.logApprovalActivity(client, application.id, null, 'loan_account_created', {
      application_id: application.application_id,
      amount: application.requested_amount
    });
  }

  /**
   * Get next steps in the approval process
   * @param {number} applicationId - Loan application ID
   * @param {string} currentStatus - Current application status
   * @returns {Array} Next steps
   */
  async getNextSteps(applicationId, currentStatus) {
    const steps = [];

    switch (currentStatus) {
      case 'pending_approval':
        steps.push('Waiting for approval from next level');
        steps.push('Risk assessment may be updated');
        break;
      case 'approved':
        steps.push('Loan account will be created');
        steps.push('Disbursement process will begin');
        steps.push('Customer will be notified');
        break;
      case 'rejected':
        steps.push('Customer will be notified of rejection');
        steps.push('Feedback provided for future applications');
        break;
    }

    return steps;
  }

  /**
   * Send approval notifications (placeholder)
   * @param {Object} application - Application data
   * @param {string} decision - Approval decision
   * @param {number} approvedBy - ID of approver
   */
  async sendApprovalNotifications(application, decision, approvedBy) {
    // TODO: Implement notification system
    // This would send emails, SMS, or in-app notifications
    console.log(`Notification: Loan ${application.application_id} ${decision} by user ${approvedBy}`);
  }

  /**
   * Log approval activity
   * @param {Object} client - Database client
   * @param {number} applicationId - Loan application ID
   * @param {number} userId - User ID
   * @param {string} action - Action performed
   * @param {Object} details - Additional details
   */
  async logApprovalActivity(client, applicationId, userId, action, details) {
    await client.query(`
      INSERT INTO audit_logs (user_id, action, resource, resource_id, details, success)
      VALUES ($1, $2, 'loan_approval', $3, $4, true)
    `, [userId, action, applicationId.toString(), JSON.stringify(details)]);
  }

  /**
   * Get approval statistics for reporting
   * @param {Object} filters - Filter criteria
   * @returns {Object} Approval statistics
   */
  async getApprovalStatistics(filters = {}) {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_applications,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
          COUNT(CASE WHEN status = 'pending_approval' THEN 1 END) as pending_count,
          AVG(CASE WHEN approved_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 86400 
          END) as avg_approval_days,
          SUM(CASE WHEN status = 'approved' THEN requested_amount ELSE 0 END) as approved_amount,
          AVG(CASE WHEN status = 'approved' THEN requested_amount END) as avg_approved_amount
        FROM loan_applications
        WHERE submitted_at IS NOT NULL
        ${filters.start_date ? "AND submitted_at >= '" + filters.start_date + "'" : ''}
        ${filters.end_date ? "AND submitted_at <= '" + filters.end_date + "'" : ''}
        ${filters.branch_id ? "AND branch_id = " + filters.branch_id : ''}
      `);

      return result.rows[0];
    } catch (error) {
      console.error('Error getting approval statistics:', error);
      throw error;
    }
  }
}

module.exports = new LoanApprovalService();