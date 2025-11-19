const express = require('express');
const Joi = require('joi');
const customerService = require('../services/customerService');
const { 
  authenticateToken, 
  requirePermission,
  auditLog,
  validateInput,
  rateLimitByUser
} = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const createCustomerSchema = Joi.object({
  first_name: Joi.string().min(2).max(50).required(),
  last_name: Joi.string().min(2).max(50).required(),
  nic: Joi.string().pattern(/^[0-9]{9}[vVxX]$|^[0-9]{12}$/).required()
    .messages({
      'string.pattern.base': 'NIC must be in format 123456789V or 123456789012'
    }),
  date_of_birth: Joi.date().max('now').optional(),
  gender: Joi.string().valid('male', 'female', 'other').optional(),
  marital_status: Joi.string().valid('single', 'married', 'divorced', 'widowed').optional(),
  phone_number: Joi.string().pattern(/^\+?[0-9\s\-\(\)]+$/).min(10).max(20).required()
    .messages({
      'string.pattern.base': 'Phone number format is invalid'
    }),
  email: Joi.string().email().optional(),
  address_line1: Joi.string().min(5).max(200).required(),
  address_line2: Joi.string().max(200).optional(),
  city: Joi.string().min(2).max(50).required(),
  district: Joi.string().min(2).max(50).required(),
  province: Joi.string().min(2).max(50).required(),
  postal_code: Joi.string().max(10).optional(),
  occupation: Joi.string().max(100).optional(),
  monthly_income: Joi.number().positive().optional(),
  employer_name: Joi.string().max(100).optional(),
  employer_address: Joi.string().max(200).optional(),
  emergency_contact_name: Joi.string().min(2).max(100).required(),
  emergency_contact_phone: Joi.string().pattern(/^\+?[0-9\s\-\(\)]+$/).min(10).max(20).required(),
  emergency_contact_relationship: Joi.string().min(2).max(50).required(),
  branch_id: Joi.number().integer().positive().required()
});

const updateCustomerSchema = Joi.object({
  first_name: Joi.string().min(2).max(50).optional(),
  last_name: Joi.string().min(2).max(50).optional(),
  nic: Joi.string().pattern(/^[0-9]{9}[vVxX]$|^[0-9]{12}$/).optional()
    .messages({
      'string.pattern.base': 'NIC must be in format 123456789V or 123456789012'
    }),
  date_of_birth: Joi.date().max('now').optional(),
  gender: Joi.string().valid('male', 'female', 'other').optional(),
  marital_status: Joi.string().valid('single', 'married', 'divorced', 'widowed').optional(),
  phone_number: Joi.string().pattern(/^\+?[0-9\s\-\(\)]+$/).min(10).max(20).optional(),
  email: Joi.string().email().optional(),
  address_line1: Joi.string().min(5).max(200).optional(),
  address_line2: Joi.string().max(200).optional(),
  city: Joi.string().min(2).max(50).optional(),
  district: Joi.string().min(2).max(50).optional(),
  province: Joi.string().min(2).max(50).optional(),
  postal_code: Joi.string().max(10).optional(),
  occupation: Joi.string().max(100).optional(),
  monthly_income: Joi.number().positive().optional(),
  employer_name: Joi.string().max(100).optional(),
  employer_address: Joi.string().max(200).optional(),
  emergency_contact_name: Joi.string().min(2).max(100).optional(),
  emergency_contact_phone: Joi.string().pattern(/^\+?[0-9\s\-\(\)]+$/).min(10).max(20).optional(),
  emergency_contact_relationship: Joi.string().min(2).max(50).optional()
});

const searchCustomersSchema = Joi.object({
  search: Joi.string().max(100).optional(),
  kyc_status: Joi.string().valid('pending', 'approved', 'rejected', 'under_review').optional(),
  branch_id: Joi.number().integer().positive().optional(),
  city: Joi.string().max(50).optional(),
  district: Joi.string().max(50).optional(),
  page: Joi.number().integer().positive().default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  sort_by: Joi.string().valid('first_name', 'last_name', 'customer_id', 'created_at', 'kyc_status', 'city', 'district').default('created_at'),
  sort_order: Joi.string().valid('ASC', 'DESC').default('DESC')
});

const updateKYCSchema = Joi.object({
  status: Joi.string().valid('pending', 'approved', 'rejected', 'under_review').required(),
  notes: Joi.string().max(500).optional()
});

// @route   POST /api/customers
// @desc    Create a new customer
// @access  Private (Customer Management - Create)
router.post('/',
  authenticateToken,
  requirePermission('customer_management', 'create'),
  rateLimitByUser(50, 60 * 60 * 1000), // 50 creates per hour
  validateInput(createCustomerSchema),
  auditLog('customer_create', 'customer_management'),
  async (req, res) => {
    try {
      const customerData = req.body;
      
      // Use user's branch if not super admin
      if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        customerData.branch_id = req.user.branch_id;
      }

      const customer = await customerService.createCustomer(customerData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: { customer }
      });

    } catch (error) {
      console.error('Create customer error:', error);
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: error.message,
          code: 'CUSTOMER_EXISTS'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create customer',
        code: 'CUSTOMER_CREATE_FAILED'
      });
    }
  }
);

// @route   GET /api/customers/search
// @desc    Search customers with filters and pagination
// @access  Private (Customer Management - Read)
router.get('/search',
  authenticateToken,
  requirePermission('customer_management', 'read'),
  rateLimitByUser(200, 60 * 60 * 1000), // 200 searches per hour
  async (req, res) => {
    try {
      // Validate query parameters
      const { error, value } = searchCustomersSchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message,
          code: 'VALIDATION_ERROR'
        });
      }

      const filters = {
        search: value.search,
        kyc_status: value.kyc_status,
        branch_id: value.branch_id,
        city: value.city,
        district: value.district
      };

      const pagination = {
        page: value.page,
        limit: value.limit,
        sortBy: value.sort_by,
        sortOrder: value.sort_order
      };

      // Branch access control for non-admin users
      let userBranchId = null;
      if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        userBranchId = req.user.branch_id;
      }

      const result = await customerService.searchCustomers(filters, pagination, userBranchId);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Search customers error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to search customers',
        code: 'CUSTOMER_SEARCH_FAILED'
      });
    }
  }
);

// @route   GET /api/customers/:id
// @desc    Get customer by ID with optional related data
// @access  Private (Customer Management - Read)
router.get('/:id',
  authenticateToken,
  requirePermission('customer_management', 'read'),
  rateLimitByUser(300, 60 * 60 * 1000), // 300 gets per hour
  async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      
      if (isNaN(customerId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid customer ID',
          code: 'INVALID_CUSTOMER_ID'
        });
      }

      // Parse include options from query
      const options = {
        includeLoanHistory: req.query.include_loans === 'true',
        includeTransactionHistory: req.query.include_transactions === 'true',
        includeDocuments: req.query.include_documents === 'true'
      };

      const customer = await customerService.getCustomerById(customerId, options);

      // Branch access control for non-admin users
      if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        if (customer.branch.id !== req.user.branch_id) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to customer from different branch',
            code: 'BRANCH_ACCESS_DENIED'
          });
        }
      }

      res.json({
        success: true,
        data: { customer }
      });

    } catch (error) {
      console.error('Get customer error:', error);
      
      if (error.message === 'Customer not found') {
        return res.status(404).json({
          success: false,
          error: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to get customer',
        code: 'CUSTOMER_GET_FAILED'
      });
    }
  }
);

// @route   PUT /api/customers/:id
// @desc    Update customer information
// @access  Private (Customer Management - Update)
router.put('/:id',
  authenticateToken,
  requirePermission('customer_management', 'update'),
  rateLimitByUser(100, 60 * 60 * 1000), // 100 updates per hour
  validateInput(updateCustomerSchema),
  auditLog('customer_update', 'customer_management'),
  async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      
      if (isNaN(customerId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid customer ID',
          code: 'INVALID_CUSTOMER_ID'
        });
      }

      // First check if customer exists and user has access
      const existingCustomer = await customerService.getCustomerById(customerId);
      
      // Branch access control for non-admin users
      if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        if (existingCustomer.branch.id !== req.user.branch_id) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to customer from different branch',
            code: 'BRANCH_ACCESS_DENIED'
          });
        }
      }

      const updateData = req.body;
      const updatedCustomer = await customerService.updateCustomer(customerId, updateData, req.user.id);

      res.json({
        success: true,
        message: 'Customer updated successfully',
        data: { customer: updatedCustomer }
      });

    } catch (error) {
      console.error('Update customer error:', error);
      
      if (error.message === 'Customer not found') {
        return res.status(404).json({
          success: false,
          error: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND'
        });
      }

      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: error.message,
          code: 'CUSTOMER_EXISTS'
        });
      }

      if (error.message === 'No valid fields to update') {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: 'NO_UPDATE_FIELDS'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update customer',
        code: 'CUSTOMER_UPDATE_FAILED'
      });
    }
  }
);

// @route   PATCH /api/customers/:id/kyc
// @desc    Update customer KYC status
// @access  Private (Customer Management - Update)
router.patch('/:id/kyc',
  authenticateToken,
  requirePermission('customer_management', 'update'),
  rateLimitByUser(50, 60 * 60 * 1000), // 50 KYC updates per hour
  validateInput(updateKYCSchema),
  auditLog('customer_kyc_update', 'customer_management'),
  async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      
      if (isNaN(customerId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid customer ID',
          code: 'INVALID_CUSTOMER_ID'
        });
      }

      const { status, notes } = req.body;

      // First check if customer exists and user has access
      const existingCustomer = await customerService.getCustomerById(customerId);
      
      // Branch access control for non-admin users
      if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        if (existingCustomer.branch.id !== req.user.branch_id) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to customer from different branch',
            code: 'BRANCH_ACCESS_DENIED'
          });
        }
      }

      const updatedCustomer = await customerService.updateKYCStatus(
        customerId, 
        status, 
        req.user.id, 
        notes
      );

      res.json({
        success: true,
        message: `Customer KYC status updated to ${status}`,
        data: { customer: updatedCustomer }
      });

    } catch (error) {
      console.error('Update KYC status error:', error);
      
      if (error.message === 'Customer not found') {
        return res.status(404).json({
          success: false,
          error: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND'
        });
      }

      if (error.message === 'Invalid KYC status') {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: 'INVALID_KYC_STATUS'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update KYC status',
        code: 'KYC_UPDATE_FAILED'
      });
    }
  }
);

module.exports = router;