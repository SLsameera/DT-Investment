const express = require('express');
const router = express.Router();

// @route   GET /api/loans
// @desc    Get all loans
// @access  Private
router.get('/', async (req, res) => {
  try {
    // Mock loan data
    const loans = [
      {
        id: 1,
        customerId: 'CUST001',
        customerName: 'John Doe',
        loanType: 'personal',
        amount: 500000,
        status: 'active',
        aiRiskScore: 0.75,
        riskLevel: 'medium',
        disbursedDate: '2024-01-15',
        dueDate: '2025-01-15'
      },
      {
        id: 2,
        customerId: 'CUST002',
        customerName: 'Jane Smith',
        loanType: 'business',
        amount: 1500000,
        status: 'pending',
        aiRiskScore: 0.45,
        riskLevel: 'low',
        appliedDate: '2024-10-20'
      }
    ];

    res.json({
      success: true,
      data: loans,
      count: loans.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch loans'
    });
  }
});

// @route   POST /api/loans
// @desc    Create new loan application
// @access  Private
router.post('/', async (req, res) => {
  try {
    const loanData = req.body;
    
    // Mock loan creation
    const newLoan = {
      id: Date.now(),
      ...loanData,
      status: 'pending',
      appliedDate: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      data: newLoan,
      message: 'Loan application created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create loan application'
    });
  }
});

module.exports = router;