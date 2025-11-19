const { query, transaction } = require('../config/database');
const moment = require('moment');

class CustomerService {
  /**
   * Create a new customer with KYC information
   * @param {Object} customerData - Customer information
   * @param {number} createdBy - ID of the user creating the customer
   * @returns {Object} Created customer object
   */
  async createCustomer(customerData, createdBy) {
    try {
      return await transaction(async (client) => {
        // Generate unique customer ID
        const customerIdResult = await client.query(
          `SELECT 'CUST' || LPAD(NEXTVAL('customer_id_seq')::text, 6, '0') as customer_id`
        );
        
        if (customerIdResult.rows.length === 0) {
          // Create sequence if it doesn't exist
          await client.query(`CREATE SEQUENCE IF NOT EXISTS customer_id_seq START 1`);
          const retryResult = await client.query(
            `SELECT 'CUST' || LPAD(NEXTVAL('customer_id_seq')::text, 6, '0') as customer_id`
          );
          customerData.customer_id = retryResult.rows[0].customer_id;
        } else {
          customerData.customer_id = customerIdResult.rows[0].customer_id;
        }

        // Validate required fields
        this.validateCustomerData(customerData);

        // Check for duplicate NIC
        const existingNIC = await client.query(
          'SELECT id FROM customers WHERE nic = $1',
          [customerData.nic]
        );
        
        if (existingNIC.rows.length > 0) {
          throw new Error(`Customer with NIC ${customerData.nic} already exists`);
        }

        // Check for duplicate phone number
        const existingPhone = await client.query(
          'SELECT id FROM customers WHERE phone_number = $1',
          [customerData.phone_number]
        );
        
        if (existingPhone.rows.length > 0) {
          throw new Error(`Customer with phone number ${customerData.phone_number} already exists`);
        }

        // Insert customer
        const result = await client.query(`
          INSERT INTO customers (
            customer_id, first_name, last_name, nic, date_of_birth, gender,
            marital_status, phone_number, email, address_line1, address_line2,
            city, district, province, postal_code, occupation, monthly_income,
            employer_name, employer_address, emergency_contact_name,
            emergency_contact_phone, emergency_contact_relationship,
            branch_id, created_by, kyc_status
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23, $24, 'pending'
          ) RETURNING *
        `, [
          customerData.customer_id,
          customerData.first_name,
          customerData.last_name,
          customerData.nic,
          customerData.date_of_birth,
          customerData.gender,
          customerData.marital_status,
          customerData.phone_number,
          customerData.email || null,
          customerData.address_line1,
          customerData.address_line2 || null,
          customerData.city,
          customerData.district,
          customerData.province,
          customerData.postal_code || null,
          customerData.occupation,
          customerData.monthly_income || null,
          customerData.employer_name || null,
          customerData.employer_address || null,
          customerData.emergency_contact_name,
          customerData.emergency_contact_phone,
          customerData.emergency_contact_relationship,
          customerData.branch_id,
          createdBy
        ]);

        const customer = result.rows[0];

        // Log customer creation
        await this.logCustomerActivity(client, customer.id, createdBy, 'customer_created', {
          customer_id: customer.customer_id,
          action: 'Customer profile created'
        });

        return this.formatCustomerResponse(customer);
      });
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  /**
   * Get customer by ID with optional related data
   * @param {number} customerId - Customer ID
   * @param {Object} options - Options for including related data
   * @returns {Object} Customer object with related data
   */
  async getCustomerById(customerId, options = {}) {
    try {
      const customer = await query(`
        SELECT 
          c.*,
          b.name as branch_name,
          b.code as branch_code,
          u.first_name as created_by_first_name,
          u.last_name as created_by_last_name,
          kv.first_name as kyc_verified_by_first_name,
          kv.last_name as kyc_verified_by_last_name
        FROM customers c
        LEFT JOIN branches b ON c.branch_id = b.id
        LEFT JOIN users u ON c.created_by = u.id
        LEFT JOIN users kv ON c.kyc_verified_by = kv.id
        WHERE c.id = $1
      `, [customerId]);

      if (customer.rows.length === 0) {
        throw new Error('Customer not found');
      }

      const customerData = this.formatCustomerResponse(customer.rows[0]);

      // Include loan history if requested
      if (options.includeLoanHistory) {
        customerData.loan_history = await this.getCustomerLoanHistory(customerId);
      }

      // Include transaction history if requested
      if (options.includeTransactionHistory) {
        customerData.transaction_history = await this.getCustomerTransactionHistory(customerId);
      }

      // Include documents if requested
      if (options.includeDocuments) {
        customerData.documents = await this.getCustomerDocuments(customerId);
      }

      return customerData;
    } catch (error) {
      console.error('Error getting customer:', error);
      throw error;
    }
  }

  /**
   * Update customer information
   * @param {number} customerId - Customer ID
   * @param {Object} updateData - Data to update
   * @param {number} updatedBy - ID of user making the update
   * @returns {Object} Updated customer object
   */
  async updateCustomer(customerId, updateData, updatedBy) {
    try {
      return await transaction(async (client) => {
        // Get current customer data
        const currentCustomer = await client.query(
          'SELECT * FROM customers WHERE id = $1',
          [customerId]
        );

        if (currentCustomer.rows.length === 0) {
          throw new Error('Customer not found');
        }

        // Validate update data
        this.validateCustomerUpdateData(updateData);

        // Check for duplicate NIC if updating
        if (updateData.nic && updateData.nic !== currentCustomer.rows[0].nic) {
          const existingNIC = await client.query(
            'SELECT id FROM customers WHERE nic = $1 AND id != $2',
            [updateData.nic, customerId]
          );
          
          if (existingNIC.rows.length > 0) {
            throw new Error(`Customer with NIC ${updateData.nic} already exists`);
          }
        }

        // Check for duplicate phone if updating
        if (updateData.phone_number && updateData.phone_number !== currentCustomer.rows[0].phone_number) {
          const existingPhone = await client.query(
            'SELECT id FROM customers WHERE phone_number = $1 AND id != $2',
            [updateData.phone_number, customerId]
          );
          
          if (existingPhone.rows.length > 0) {
            throw new Error(`Customer with phone number ${updateData.phone_number} already exists`);
          }
        }

        // Build dynamic update query
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        const allowedFields = [
          'first_name', 'last_name', 'nic', 'date_of_birth', 'gender',
          'marital_status', 'phone_number', 'email', 'address_line1',
          'address_line2', 'city', 'district', 'province', 'postal_code',
          'occupation', 'monthly_income', 'employer_name', 'employer_address',
          'emergency_contact_name', 'emergency_contact_phone',
          'emergency_contact_relationship'
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

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(customerId);

        const updateQuery = `
          UPDATE customers 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `;

        const result = await client.query(updateQuery, updateValues);
        const updatedCustomer = result.rows[0];

        // Log the update
        await this.logCustomerActivity(client, customerId, updatedBy, 'customer_updated', {
          updated_fields: Object.keys(updateData),
          changes: updateData
        });

        return this.formatCustomerResponse(updatedCustomer);
      });
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  /**
   * Search customers with filters and pagination
   * @param {Object} filters - Search filters
   * @param {Object} pagination - Pagination options
   * @param {number} userBranchId - User's branch ID for access control
   * @returns {Object} Search results with pagination info
   */
  async searchCustomers(filters = {}, pagination = {}, userBranchId = null) {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = pagination;

      const offset = (page - 1) * limit;

      // Build WHERE clause
      const whereConditions = [];
      const queryParams = [];
      let paramCount = 1;

      // Branch access control
      if (userBranchId) {
        whereConditions.push(`c.branch_id = $${paramCount}`);
        queryParams.push(userBranchId);
        paramCount++;
      }

      // Apply filters
      if (filters.search) {
        whereConditions.push(`(
          c.first_name ILIKE $${paramCount} OR 
          c.last_name ILIKE $${paramCount} OR 
          c.customer_id ILIKE $${paramCount} OR 
          c.nic ILIKE $${paramCount} OR 
          c.phone_number ILIKE $${paramCount}
        )`);
        queryParams.push(`%${filters.search}%`);
        paramCount++;
      }

      if (filters.kyc_status) {
        whereConditions.push(`c.kyc_status = $${paramCount}`);
        queryParams.push(filters.kyc_status);
        paramCount++;
      }

      if (filters.branch_id) {
        whereConditions.push(`c.branch_id = $${paramCount}`);
        queryParams.push(filters.branch_id);
        paramCount++;
      }

      if (filters.city) {
        whereConditions.push(`c.city ILIKE $${paramCount}`);
        queryParams.push(`%${filters.city}%`);
        paramCount++;
      }

      if (filters.district) {
        whereConditions.push(`c.district ILIKE $${paramCount}`);
        queryParams.push(`%${filters.district}%`);
        paramCount++;
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Validate sort column
      const allowedSortColumns = [
        'first_name', 'last_name', 'customer_id', 'created_at',
        'kyc_status', 'city', 'district'
      ];
      
      const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
      const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) 
        ? sortOrder.toUpperCase() 
        : 'DESC';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM customers c
        ${whereClause}
      `;
      
      const countResult = await query(countQuery, queryParams);
      const totalRecords = parseInt(countResult.rows[0].total);

      // Get customers
      const customersQuery = `
        SELECT 
          c.id, c.customer_id, c.first_name, c.last_name, c.nic,
          c.phone_number, c.email, c.city, c.district, c.kyc_status,
          c.created_at, b.name as branch_name, b.code as branch_code
        FROM customers c
        LEFT JOIN branches b ON c.branch_id = b.id
        ${whereClause}
        ORDER BY c.${validSortBy} ${validSortOrder}
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;

      queryParams.push(limit, offset);
      
      const customersResult = await query(customersQuery, queryParams);

      return {
        customers: customersResult.rows.map(customer => ({
          id: customer.id,
          customer_id: customer.customer_id,
          first_name: customer.first_name,
          last_name: customer.last_name,
          full_name: `${customer.first_name} ${customer.last_name}`,
          nic: customer.nic,
          phone_number: customer.phone_number,
          email: customer.email,
          city: customer.city,
          district: customer.district,
          kyc_status: customer.kyc_status,
          branch: {
            name: customer.branch_name,
            code: customer.branch_code
          },
          created_at: customer.created_at
        })),
        pagination: {
          current_page: page,
          total_pages: Math.ceil(totalRecords / limit),
          total_records: totalRecords,
          per_page: limit,
          has_next: page < Math.ceil(totalRecords / limit),
          has_prev: page > 1
        }
      };
    } catch (error) {
      console.error('Error searching customers:', error);
      throw error;
    }
  }

  /**
   * Update customer KYC status
   * @param {number} customerId - Customer ID
   * @param {string} status - New KYC status (pending, approved, rejected)
   * @param {number} verifiedBy - ID of user updating status
   * @param {string} notes - Optional notes
   * @returns {Object} Updated customer
   */
  async updateKYCStatus(customerId, status, verifiedBy, notes = null) {
    try {
      return await transaction(async (client) => {
        // Validate status
        const validStatuses = ['pending', 'approved', 'rejected', 'under_review'];
        if (!validStatuses.includes(status)) {
          throw new Error('Invalid KYC status');
        }

        const updateData = {
          kyc_status: status,
          kyc_verified_by: verifiedBy,
          kyc_verified_at: new Date()
        };

        const result = await client.query(`
          UPDATE customers 
          SET kyc_status = $1, kyc_verified_by = $2, kyc_verified_at = $3, updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
          RETURNING *
        `, [status, verifiedBy, updateData.kyc_verified_at, customerId]);

        if (result.rows.length === 0) {
          throw new Error('Customer not found');
        }

        const customer = result.rows[0];

        // Log KYC status change
        await this.logCustomerActivity(client, customerId, verifiedBy, 'kyc_status_updated', {
          old_status: 'pending',
          new_status: status,
          notes: notes
        });

        return this.formatCustomerResponse(customer);
      });
    } catch (error) {
      console.error('Error updating KYC status:', error);
      throw error;
    }
  }

  /**
   * Validate customer data
   * @param {Object} customerData - Customer data to validate
   */
  validateCustomerData(customerData) {
    const required = [
      'first_name', 'last_name', 'nic', 'phone_number', 'address_line1',
      'city', 'district', 'province', 'emergency_contact_name',
      'emergency_contact_phone', 'emergency_contact_relationship', 'branch_id'
    ];

    for (const field of required) {
      if (!customerData[field] || customerData[field].toString().trim() === '') {
        throw new Error(`${field.replace('_', ' ')} is required`);
      }
    }

    // Validate NIC format (basic validation)
    const nicPattern = /^[0-9]{9}[vVxX]$|^[0-9]{12}$/;
    if (!nicPattern.test(customerData.nic)) {
      throw new Error('Invalid NIC format');
    }

    // Validate phone number format
    const phonePattern = /^\+?[0-9\s\-\(\)]+$/;
    if (!phonePattern.test(customerData.phone_number)) {
      throw new Error('Invalid phone number format');
    }

    // Validate email if provided
    if (customerData.email) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(customerData.email)) {
        throw new Error('Invalid email format');
      }
    }

    // Validate date of birth if provided
    if (customerData.date_of_birth) {
      const dob = moment(customerData.date_of_birth);
      if (!dob.isValid() || dob.isAfter(moment())) {
        throw new Error('Invalid date of birth');
      }
    }
  }

  /**
   * Validate customer update data
   * @param {Object} updateData - Data to validate
   */
  validateCustomerUpdateData(updateData) {
    // Only validate fields that are being updated
    if (updateData.nic) {
      const nicPattern = /^[0-9]{9}[vVxX]$|^[0-9]{12}$/;
      if (!nicPattern.test(updateData.nic)) {
        throw new Error('Invalid NIC format');
      }
    }

    if (updateData.phone_number) {
      const phonePattern = /^\+?[0-9\s\-\(\)]+$/;
      if (!phonePattern.test(updateData.phone_number)) {
        throw new Error('Invalid phone number format');
      }
    }

    if (updateData.email) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(updateData.email)) {
        throw new Error('Invalid email format');
      }
    }

    if (updateData.date_of_birth) {
      const dob = moment(updateData.date_of_birth);
      if (!dob.isValid() || dob.isAfter(moment())) {
        throw new Error('Invalid date of birth');
      }
    }
  }

  /**
   * Format customer response
   * @param {Object} customer - Raw customer data
   * @returns {Object} Formatted customer data
   */
  formatCustomerResponse(customer) {
    return {
      id: customer.id,
      customer_id: customer.customer_id,
      full_name: `${customer.first_name} ${customer.last_name}`,
      first_name: customer.first_name,
      last_name: customer.last_name,
      nic: customer.nic,
      date_of_birth: customer.date_of_birth,
      gender: customer.gender,
      marital_status: customer.marital_status,
      phone_number: customer.phone_number,
      email: customer.email,
      address: {
        line1: customer.address_line1,
        line2: customer.address_line2,
        city: customer.city,
        district: customer.district,
        province: customer.province,
        postal_code: customer.postal_code
      },
      employment: {
        occupation: customer.occupation,
        monthly_income: customer.monthly_income,
        employer_name: customer.employer_name,
        employer_address: customer.employer_address
      },
      emergency_contact: {
        name: customer.emergency_contact_name,
        phone: customer.emergency_contact_phone,
        relationship: customer.emergency_contact_relationship
      },
      kyc: {
        status: customer.kyc_status,
        verified_at: customer.kyc_verified_at,
        verified_by: customer.kyc_verified_by_first_name && customer.kyc_verified_by_last_name
          ? `${customer.kyc_verified_by_first_name} ${customer.kyc_verified_by_last_name}`
          : null
      },
      branch: {
        id: customer.branch_id,
        name: customer.branch_name,
        code: customer.branch_code
      },
      created_by: customer.created_by_first_name && customer.created_by_last_name
        ? `${customer.created_by_first_name} ${customer.created_by_last_name}`
        : null,
      created_at: customer.created_at,
      updated_at: customer.updated_at
    };
  }

  /**
   * Log customer activity
   * @param {Object} client - Database client
   * @param {number} customerId - Customer ID
   * @param {number} userId - User ID performing action
   * @param {string} action - Action performed
   * @param {Object} details - Additional details
   */
  async logCustomerActivity(client, customerId, userId, action, details) {
    await client.query(`
      INSERT INTO audit_logs (user_id, action, resource, resource_id, details, success)
      VALUES ($1, $2, 'customer', $3, $4, true)
    `, [userId, action, customerId.toString(), JSON.stringify(details)]);
  }

  /**
   * Get customer loan history (placeholder)
   * @param {number} customerId - Customer ID
   * @returns {Array} Loan history
   */
  async getCustomerLoanHistory(_customerId) {
    // TODO: Implement when loan module is ready
    return [];
  }

  /**
   * Get customer transaction history (placeholder)
   * @param {number} customerId - Customer ID
   * @returns {Array} Transaction history
   */
  async getCustomerTransactionHistory(_customerId) {
    // TODO: Implement when transaction module is ready
    return [];
  }

  /**
   * Get customer documents (implementation)
   * @param {number} customerId - Customer ID
   * @returns {Array} Documents
   */
  async getCustomerDocuments(customerId) {
    try {
      const documentService = require('./documentService');
      return await documentService.getCustomerDocuments(customerId);
    } catch (error) {
      console.error('Error getting customer documents:', error);
      return [];
    }
  }
}

module.exports = new CustomerService();