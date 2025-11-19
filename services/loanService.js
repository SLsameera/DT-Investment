const { query, transaction } = require('../config/database');
const customerService = require('./customerService');
const moment = require('moment');

class LoanService {
  constructor() {
    this.loanStatuses = {
      'draft': 'Draft',
      'submitted': 'Submitted',
      'under_review': 'Under Review',
      'pending_approval': 'Pending Approval',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'disbursed': 'Disbursed',
      'active': 'Active',
      'completed': 'Completed',
      'defaulted': 'Defaulted',
      'written_off': 'Written Off'
    };

    this.paymentFrequencies = {
      'weekly': 'Weekly',
      'bi_weekly': 'Bi-weekly',
      'monthly': 'Monthly',
      'quarterly': 'Quarterly'
    };

    this.collateralTypes = {
      'none': 'No Collateral',
      'property': 'Property/Real Estate',
      'vehicle': 'Vehicle',
      'gold': 'Gold/Jewelry',
      'fixed_deposit': 'Fixed Deposit',
      'guarantee': 'Personal Guarantee',
      'business_assets': 'Business Assets',
      'other': 'Other'
    };
  }

  /**
   * Create a new loan application
   * @param {Object} applicationData - Loan application data
   * @param {number} createdBy - ID of user creating the application
   * @returns {Object} Created loan application
   */
  async createLoanApplication(applicationData, createdBy) {
    try {
      return await transaction(async (client) => {
        // Generate unique loan application ID
        const appIdResult = await client.query(
          `SELECT 'LA' || LPAD(NEXTVAL('loan_application_id_seq')::text, 8, '0') as application_id`
        );
        
        if (appIdResult.rows.length === 0) {
          // Create sequence if it doesn't exist
          await client.query(`CREATE SEQUENCE IF NOT EXISTS loan_application_id_seq START 1`);
          const retryResult = await client.query(
            `SELECT 'LA' || LPAD(NEXTVAL('loan_application_id_seq')::text, 8, '0') as application_id`
          );
          applicationData.application_id = retryResult.rows[0].application_id;
        } else {
          applicationData.application_id = appIdResult.rows[0].application_id;
        }

        // Validate application data
        await this.validateLoanApplication(applicationData);

        // Get customer information
        const customer = await customerService.getCustomerById(applicationData.customer_id);
        if (!customer) {
          throw new Error('Customer not found');
        }

        // Check customer KYC status
        if (customer.kyc.status !== 'approved') {
          throw new Error('Customer KYC must be approved before loan application');
        }

        // Get loan product details
        const loanProduct = await this.getLoanProductById(applicationData.loan_product_id);
        if (!loanProduct || !loanProduct.is_active) {
          throw new Error('Invalid or inactive loan product');
        }

        // Validate loan amount against product limits
        if (applicationData.requested_amount < loanProduct.min_amount || 
            applicationData.requested_amount > loanProduct.max_amount) {
          throw new Error(`Loan amount must be between ${loanProduct.min_amount} and ${loanProduct.max_amount}`);
        }

        // Validate loan term against product limits
        if (applicationData.term_months < loanProduct.min_term_months || 
            applicationData.term_months > loanProduct.max_term_months) {
          throw new Error(`Loan term must be between ${loanProduct.min_term_months} and ${loanProduct.max_term_months} months`);
        }

        // Calculate payment schedule
        const paymentSchedule = await this.calculatePaymentSchedule({
          principal: applicationData.requested_amount,
          interestRate: applicationData.interest_rate || loanProduct.interest_rate,
          termMonths: applicationData.term_months,
          paymentFrequency: applicationData.payment_frequency || 'monthly',
          startDate: applicationData.proposed_start_date || new Date()
        });

        // Calculate fees
        const processingFee = (applicationData.requested_amount * (loanProduct.processing_fee_rate || 0)) / 100;
        const totalAmount = applicationData.requested_amount + processingFee;

        // Insert loan application
        const result = await client.query(`
          INSERT INTO loan_applications (
            application_id, customer_id, loan_product_id, requested_amount,
            term_months, interest_rate, payment_frequency, purpose,
            employment_status, monthly_income, existing_debts,
            collateral_type, collateral_value, collateral_description,
            guarantor_name, guarantor_phone, guarantor_relationship,
            processing_fee, total_amount, monthly_payment,
            proposed_start_date, branch_id, created_by, status
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19, $20, $21, $22, $23, 'draft'
          ) RETURNING *
        `, [
          applicationData.application_id,
          applicationData.customer_id,
          applicationData.loan_product_id,
          applicationData.requested_amount,
          applicationData.term_months,
          applicationData.interest_rate || loanProduct.interest_rate,
          applicationData.payment_frequency || 'monthly',
          applicationData.purpose,
          applicationData.employment_status,
          applicationData.monthly_income,
          applicationData.existing_debts || 0,
          applicationData.collateral_type || 'none',
          applicationData.collateral_value || 0,
          applicationData.collateral_description,
          applicationData.guarantor_name,
          applicationData.guarantor_phone,
          applicationData.guarantor_relationship,
          processingFee,
          totalAmount,
          paymentSchedule.monthlyPayment,
          applicationData.proposed_start_date || new Date(),
          applicationData.branch_id || customer.branch.id,
          createdBy
        ]);

        const loanApplication = result.rows[0];

        // Store payment schedule
        await this.savePaymentSchedule(client, loanApplication.id, paymentSchedule.schedule);

        // Log application creation
        await this.logLoanActivity(client, loanApplication.id, createdBy, 'application_created', {
          application_id: loanApplication.application_id,
          customer_id: customer.customer_id,
          amount: applicationData.requested_amount,
          product: loanProduct.name
        });

        return this.formatLoanApplicationResponse(loanApplication, customer, loanProduct);
      });
    } catch (error) {
      console.error('Error creating loan application:', error);
      throw error;
    }
  }

  /**
   * Get loan application by ID
   * @param {number} applicationId - Loan application ID
   * @param {Object} options - Options for including related data
   * @returns {Object} Loan application with related data
   */
  async getLoanApplicationById(applicationId, options = {}) {
    try {
      const result = await query(`
        SELECT 
          la.*,
          c.customer_id, c.first_name, c.last_name, c.phone_number, c.email,
          lp.name as product_name, lp.code as product_code,
          b.name as branch_name, b.code as branch_code,
          u.first_name as created_by_first_name, u.last_name as created_by_last_name
        FROM loan_applications la
        LEFT JOIN customers c ON la.customer_id = c.id
        LEFT JOIN loan_products lp ON la.loan_product_id = lp.id
        LEFT JOIN branches b ON la.branch_id = b.id
        LEFT JOIN users u ON la.created_by = u.id
        WHERE la.id = $1
      `, [applicationId]);

      if (result.rows.length === 0) {
        throw new Error('Loan application not found');
      }

      const application = result.rows[0];
      const formattedApplication = this.formatLoanApplicationResponse(application);

      // Include payment schedule if requested
      if (options.includePaymentSchedule) {
        formattedApplication.payment_schedule = await this.getPaymentSchedule(applicationId);
      }

      // Include documents if requested
      if (options.includeDocuments) {
        formattedApplication.documents = await this.getLoanDocuments(applicationId);
      }

      // Include approval history if requested
      if (options.includeApprovalHistory) {
        formattedApplication.approval_history = await this.getApprovalHistory(applicationId);
      }

      return formattedApplication;
    } catch (error) {
      console.error('Error getting loan application:', error);
      throw error;
    }
  }

  /**
   * Update loan application
   * @param {number} applicationId - Loan application ID
   * @param {Object} updateData - Data to update
   * @param {number} updatedBy - ID of user updating the application
   * @returns {Object} Updated loan application
   */
  async updateLoanApplication(applicationId, updateData, updatedBy) {
    try {
      return await transaction(async (client) => {
        // Get current application
        const currentApp = await client.query(
          'SELECT * FROM loan_applications WHERE id = $1',
          [applicationId]
        );

        if (currentApp.rows.length === 0) {
          throw new Error('Loan application not found');
        }

        const application = currentApp.rows[0];

        // Check if application can be updated
        if (!['draft', 'submitted'].includes(application.status)) {
          throw new Error('Application cannot be updated in current status');
        }

        // Validate update data
        this.validateLoanApplicationUpdate(updateData);

        // Build dynamic update query
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        const allowedFields = [
          'requested_amount', 'term_months', 'interest_rate', 'payment_frequency',
          'purpose', 'employment_status', 'monthly_income', 'existing_debts',
          'collateral_type', 'collateral_value', 'collateral_description',
          'guarantor_name', 'guarantor_phone', 'guarantor_relationship',
          'proposed_start_date'
        ];

        for (const field of allowedFields) {
          if (Object.prototype.hasOwnProperty.call(updateData, field)) {
            updateFields.push(`${field} = $${paramCount}`);
            updateValues.push(updateData[field]);
            paramCount++;
          }
        }

        if (updateFields.length === 0) {
          throw new Error('No valid fields to update');
        }

        // Recalculate payment schedule if loan terms changed
        let newPaymentSchedule = null;
        if (updateData.requested_amount || updateData.term_months || updateData.interest_rate || updateData.payment_frequency) {
          newPaymentSchedule = await this.calculatePaymentSchedule({
            principal: updateData.requested_amount || application.requested_amount,
            interestRate: updateData.interest_rate || application.interest_rate,
            termMonths: updateData.term_months || application.term_months,
            paymentFrequency: updateData.payment_frequency || application.payment_frequency,
            startDate: updateData.proposed_start_date || application.proposed_start_date
          });

          updateFields.push(`monthly_payment = $${paramCount}`);
          updateValues.push(newPaymentSchedule.monthlyPayment);
          paramCount++;
        }

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(applicationId);

        const updateQuery = `
          UPDATE loan_applications 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `;

        const result = await client.query(updateQuery, updateValues);
        const updatedApplication = result.rows[0];

        // Update payment schedule if recalculated
        if (newPaymentSchedule) {
          await this.updatePaymentSchedule(client, applicationId, newPaymentSchedule.schedule);
        }

        // Log the update
        await this.logLoanActivity(client, applicationId, updatedBy, 'application_updated', {
          updated_fields: Object.keys(updateData),
          changes: updateData
        });

        return this.formatLoanApplicationResponse(updatedApplication);
      });
    } catch (error) {
      console.error('Error updating loan application:', error);
      throw error;
    }
  }

  /**
   * Submit loan application for review
   * @param {number} applicationId - Loan application ID
   * @param {number} submittedBy - ID of user submitting the application
   * @returns {Object} Updated loan application
   */
  async submitLoanApplication(applicationId, submittedBy) {
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

        if (application.status !== 'draft') {
          throw new Error('Only draft applications can be submitted');
        }

        // Validate application completeness
        await this.validateApplicationCompleteness(application);

        // Update status to submitted
        const result = await client.query(`
          UPDATE loan_applications 
          SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING *
        `, [applicationId]);

        const updatedApplication = result.rows[0];

        // Create approval workflow
        await this.createApprovalWorkflow(client, applicationId, application.requested_amount);

        // Log submission
        await this.logLoanActivity(client, applicationId, submittedBy, 'application_submitted', {
          application_id: application.application_id,
          amount: application.requested_amount
        });

        return this.formatLoanApplicationResponse(updatedApplication);
      });
    } catch (error) {
      console.error('Error submitting loan application:', error);
      throw error;
    }
  }

  /**
   * Calculate payment schedule for a loan
   * @param {Object} loanParams - Loan parameters
   * @returns {Object} Payment schedule details
   */
  async calculatePaymentSchedule(loanParams) {
    try {
      const {
        principal,
        interestRate,
        termMonths,
        paymentFrequency = 'monthly',
        startDate = new Date()
      } = loanParams;

      // Convert annual interest rate to monthly
      const monthlyRate = (interestRate / 100) / 12;
      
      // Calculate monthly payment using formula: P * [r(1+r)^n] / [(1+r)^n - 1]
      const monthlyPayment = principal * 
        (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
        (Math.pow(1 + monthlyRate, termMonths) - 1);

      const schedule = [];
      let remainingBalance = principal;
      let currentDate = moment(startDate);

      for (let i = 1; i <= termMonths; i++) {
        const interestPayment = remainingBalance * monthlyRate;
        const principalPayment = monthlyPayment - interestPayment;
        remainingBalance -= principalPayment;

        // Ensure last payment covers any remaining balance due to rounding
        if (i === termMonths && remainingBalance > 0.01) {
          const finalPrincipalPayment = principalPayment + remainingBalance;
          const finalPayment = finalPrincipalPayment + interestPayment;
          remainingBalance = 0;

          schedule.push({
            payment_number: i,
            due_date: currentDate.format('YYYY-MM-DD'),
            payment_amount: Math.round(finalPayment * 100) / 100,
            principal_amount: Math.round(finalPrincipalPayment * 100) / 100,
            interest_amount: Math.round(interestPayment * 100) / 100,
            remaining_balance: 0,
            status: 'pending'
          });
        } else {
          schedule.push({
            payment_number: i,
            due_date: currentDate.format('YYYY-MM-DD'),
            payment_amount: Math.round(monthlyPayment * 100) / 100,
            principal_amount: Math.round(principalPayment * 100) / 100,
            interest_amount: Math.round(interestPayment * 100) / 100,
            remaining_balance: Math.round(Math.max(0, remainingBalance) * 100) / 100,
            status: 'pending'
          });
        }

        // Move to next payment date based on frequency
        switch (paymentFrequency) {
          case 'weekly':
            currentDate.add(1, 'week');
            break;
          case 'bi_weekly':
            currentDate.add(2, 'weeks');
            break;
          case 'monthly':
            currentDate.add(1, 'month');
            break;
          case 'quarterly':
            currentDate.add(3, 'months');
            break;
          default:
            currentDate.add(1, 'month');
        }
      }

      return {
        monthlyPayment: Math.round(monthlyPayment * 100) / 100,
        totalAmount: Math.round(schedule.reduce((sum, payment) => sum + payment.payment_amount, 0) * 100) / 100,
        totalInterest: Math.round(schedule.reduce((sum, payment) => sum + payment.interest_amount, 0) * 100) / 100,
        schedule
      };
    } catch (error) {
      console.error('Error calculating payment schedule:', error);
      throw error;
    }
  }

  /**
   * Get loan product by ID
   * @param {number} productId - Loan product ID
   * @returns {Object} Loan product
   */
  async getLoanProductById(productId) {
    try {
      const result = await query(
        'SELECT * FROM loan_products WHERE id = $1',
        [productId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting loan product:', error);
      throw error;
    }
  }

  /**
   * Save payment schedule to database
   * @param {Object} client - Database client
   * @param {number} applicationId - Loan application ID
   * @param {Array} schedule - Payment schedule array
   */
  async savePaymentSchedule(client, applicationId, schedule) {
    try {
      // Delete existing schedule
      await client.query(
        'DELETE FROM loan_payment_schedules WHERE loan_application_id = $1',
        [applicationId]
      );

      // Insert new schedule
      for (const payment of schedule) {
        await client.query(`
          INSERT INTO loan_payment_schedules (
            loan_application_id, payment_number, due_date, payment_amount,
            principal_amount, interest_amount, remaining_balance, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          applicationId,
          payment.payment_number,
          payment.due_date,
          payment.payment_amount,
          payment.principal_amount,
          payment.interest_amount,
          payment.remaining_balance,
          payment.status
        ]);
      }
    } catch (error) {
      console.error('Error saving payment schedule:', error);
      throw error;
    }
  }

  /**
   * Update payment schedule
   * @param {Object} client - Database client
   * @param {number} applicationId - Loan application ID
   * @param {Array} schedule - Updated payment schedule
   */
  async updatePaymentSchedule(client, applicationId, schedule) {
    await this.savePaymentSchedule(client, applicationId, schedule);
  }

  /**
   * Get payment schedule for loan application
   * @param {number} applicationId - Loan application ID
   * @returns {Array} Payment schedule
   */
  async getPaymentSchedule(applicationId) {
    try {
      const result = await query(`
        SELECT * FROM loan_payment_schedules 
        WHERE loan_application_id = $1 
        ORDER BY payment_number
      `, [applicationId]);

      return result.rows;
    } catch (error) {
      console.error('Error getting payment schedule:', error);
      return [];
    }
  }

  /**
   * Validate loan application data
   * @param {Object} applicationData - Application data to validate
   */
  async validateLoanApplication(applicationData) {
    const required = [
      'customer_id', 'loan_product_id', 'requested_amount', 'term_months',
      'purpose', 'employment_status', 'monthly_income'
    ];

    for (const field of required) {
      if (!applicationData[field]) {
        throw new Error(`${field.replace('_', ' ')} is required`);
      }
    }

    // Validate amounts
    if (applicationData.requested_amount <= 0) {
      throw new Error('Requested amount must be greater than zero');
    }

    if (applicationData.term_months <= 0 || applicationData.term_months > 240) {
      throw new Error('Term months must be between 1 and 240');
    }

    if (applicationData.monthly_income <= 0) {
      throw new Error('Monthly income must be greater than zero');
    }

    // Validate collateral if provided
    if (applicationData.collateral_type && applicationData.collateral_type !== 'none') {
      if (!applicationData.collateral_value || applicationData.collateral_value <= 0) {
        throw new Error('Collateral value is required when collateral type is specified');
      }
    }
  }

  /**
   * Validate loan application update data
   * @param {Object} updateData - Update data to validate
   */
  validateLoanApplicationUpdate(updateData) {
    if (updateData.requested_amount && updateData.requested_amount <= 0) {
      throw new Error('Requested amount must be greater than zero');
    }

    if (updateData.term_months && (updateData.term_months <= 0 || updateData.term_months > 240)) {
      throw new Error('Term months must be between 1 and 240');
    }

    if (updateData.monthly_income && updateData.monthly_income <= 0) {
      throw new Error('Monthly income must be greater than zero');
    }
  }

  /**
   * Validate application completeness before submission
   * @param {Object} application - Application data
   */
  async validateApplicationCompleteness(application) {
    // Check if all required fields are filled
    const requiredFields = [
      'customer_id', 'loan_product_id', 'requested_amount', 'term_months',
      'purpose', 'employment_status', 'monthly_income'
    ];

    for (const field of requiredFields) {
      if (!application[field]) {
        throw new Error(`${field.replace('_', ' ')} is required before submission`);
      }
    }

    // Check if customer has approved KYC
    const customer = await customerService.getCustomerById(application.customer_id);
    if (customer.kyc.status !== 'approved') {
      throw new Error('Customer KYC must be approved before loan submission');
    }

    // Check if required documents are uploaded
    // This will be implemented when document linking is ready
  }

  /**
   * Create approval workflow for loan application
   * @param {Object} client - Database client
   * @param {number} applicationId - Loan application ID
   * @param {number} amount - Loan amount
   */
  async createApprovalWorkflow(client, applicationId, amount) {
    // Define approval levels based on loan amount
    const approvalLevels = [];

    if (amount <= 100000) {
      approvalLevels.push({ level: 1, role: 'loan_officer', required: true });
    } else if (amount <= 500000) {
      approvalLevels.push({ level: 1, role: 'loan_officer', required: true });
      approvalLevels.push({ level: 2, role: 'branch_manager', required: true });
    } else {
      approvalLevels.push({ level: 1, role: 'loan_officer', required: true });
      approvalLevels.push({ level: 2, role: 'branch_manager', required: true });
      approvalLevels.push({ level: 3, role: 'finance_manager', required: true });
    }

    // Create approval workflow entries
    for (const level of approvalLevels) {
      await client.query(`
        INSERT INTO loan_approvals (
          loan_application_id, approval_level, required_role, 
          status, is_required, created_at
        ) VALUES ($1, $2, $3, 'pending', $4, CURRENT_TIMESTAMP)
      `, [applicationId, level.level, level.role, level.required]);
    }
  }

  /**
   * Get approval history for loan application
   * @param {number} applicationId - Loan application ID
   * @returns {Array} Approval history
   */
  async getApprovalHistory(applicationId) {
    try {
      const result = await query(`
        SELECT 
          la.*,
          u.first_name, u.last_name, u.role
        FROM loan_approvals la
        LEFT JOIN users u ON la.approved_by = u.id
        WHERE la.loan_application_id = $1
        ORDER BY la.approval_level
      `, [applicationId]);

      return result.rows.map(approval => ({
        id: approval.id,
        approval_level: approval.approval_level,
        required_role: approval.required_role,
        status: approval.status,
        approved_by: approval.first_name && approval.last_name 
          ? `${approval.first_name} ${approval.last_name}` 
          : null,
        approved_at: approval.approved_at,
        rejection_reason: approval.rejection_reason,
        comments: approval.comments,
        is_required: approval.is_required
      }));
    } catch (error) {
      console.error('Error getting approval history:', error);
      return [];
    }
  }

  /**
   * Get loan documents (placeholder)
   * @param {number} applicationId - Loan application ID
   * @returns {Array} Documents
   */
  async getLoanDocuments(_applicationId) {
    // TODO: Implement when loan-document linking is ready
    return [];
  }

  /**
   * Format loan application response
   * @param {Object} application - Raw application data
   * @param {Object} customer - Customer data (optional)
   * @param {Object} product - Product data (optional)
   * @returns {Object} Formatted application data
   */
  formatLoanApplicationResponse(application, customer = null, product = null) {
    return {
      id: application.id,
      application_id: application.application_id,
      customer: customer ? {
        id: customer.id,
        customer_id: customer.customer_id,
        name: customer.full_name,
        phone: customer.phone_number,
        email: customer.email
      } : {
        id: application.customer_id,
        name: application.first_name && application.last_name 
          ? `${application.first_name} ${application.last_name}` 
          : null,
        phone: application.phone_number,
        email: application.email
      },
      loan_product: product ? {
        id: product.id,
        name: product.name,
        code: product.code
      } : {
        id: application.loan_product_id,
        name: application.product_name,
        code: application.product_code
      },
      requested_amount: application.requested_amount,
      term_months: application.term_months,
      interest_rate: application.interest_rate,
      payment_frequency: application.payment_frequency,
      monthly_payment: application.monthly_payment,
      processing_fee: application.processing_fee,
      total_amount: application.total_amount,
      purpose: application.purpose,
      employment: {
        status: application.employment_status,
        monthly_income: application.monthly_income,
        existing_debts: application.existing_debts
      },
      collateral: {
        type: application.collateral_type,
        type_display: this.collateralTypes[application.collateral_type] || application.collateral_type,
        value: application.collateral_value,
        description: application.collateral_description
      },
      guarantor: {
        name: application.guarantor_name,
        phone: application.guarantor_phone,
        relationship: application.guarantor_relationship
      },
      status: application.status,
      status_display: this.loanStatuses[application.status] || application.status,
      proposed_start_date: application.proposed_start_date,
      submitted_at: application.submitted_at,
      branch: {
        id: application.branch_id,
        name: application.branch_name,
        code: application.branch_code
      },
      created_by: application.created_by_first_name && application.created_by_last_name
        ? `${application.created_by_first_name} ${application.created_by_last_name}`
        : null,
      created_at: application.created_at,
      updated_at: application.updated_at
    };
  }

  /**
   * Log loan activity
   * @param {Object} client - Database client
   * @param {number} applicationId - Loan application ID
   * @param {number} userId - User ID performing action
   * @param {string} action - Action performed
   * @param {Object} details - Additional details
   */
  async logLoanActivity(client, applicationId, userId, action, details) {
    await client.query(`
      INSERT INTO audit_logs (user_id, action, resource, resource_id, details, success)
      VALUES ($1, $2, 'loan_application', $3, $4, true)
    `, [userId, action, applicationId.toString(), JSON.stringify(details)]);
  }

  /**
   * Get loan statuses
   * @returns {Object} Loan statuses with display names
   */
  getLoanStatuses() {
    return this.loanStatuses;
  }

  /**
   * Get payment frequencies
   * @returns {Object} Payment frequencies with display names
   */
  getPaymentFrequencies() {
    return this.paymentFrequencies;
  }

  /**
   * Get collateral types
   * @returns {Object} Collateral types with display names
   */
  getCollateralTypes() {
    return this.collateralTypes;
  }
}

module.exports = new LoanService();