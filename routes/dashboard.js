const express = require('express');
const router = express.Router();

// @route   GET /api/dashboard/overview
// @desc    Get dashboard overview data
// @access  Private
router.get('/overview', async (req, res) => {
  try {
    // Mock data for now - will be replaced with database queries
    const overview = {
      totalActiveLoans: {
        personal: 150,
        business: 85,
        microcredit: 200,
        total: 435
      },
      dailyCollections: {
        target: 250000,
        actual: 185000,
        percentage: 74
      },
      aiRiskAlerts: {
        highRisk: 12,
        mediumRisk: 28,
        lowRisk: 395
      },
      pendingApprovals: {
        kyc: 15,
        loans: 8,
        total: 23
      },
      branchProfitLoss: {
        revenue: 1250000,
        expenses: 850000,
        profit: 400000,
        margin: 32
      },
      customerSatisfaction: {
        score: 4.2,
        totalFeedback: 156,
        sentiment: 'positive'
      },
      staffAttendance: {
        present: 18,
        total: 20,
        percentage: 90
      }
    };

    res.json({
      success: true,
      data: overview,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard overview'
    });
  }
});

// @route   GET /api/dashboard/notifications
// @desc    Get real-time notifications
// @access  Private
router.get('/notifications', async (req, res) => {
  try {
    const notifications = [
      {
        id: 1,
        type: 'alert',
        title: 'High Risk Loan Alert',
        message: 'Customer ID #2156 shows increased default risk',
        timestamp: new Date().toISOString(),
        priority: 'high'
      },
      {
        id: 2,
        type: 'info',
        title: 'Daily Target Achievement',
        message: 'Collection target 74% achieved - Rs. 185,000 collected',
        timestamp: new Date().toISOString(),
        priority: 'medium'
      },
      {
        id: 3,
        type: 'success',
        title: 'KYC Verification Complete',
        message: '5 new customer KYC verifications completed',
        timestamp: new Date().toISOString(),
        priority: 'low'
      }
    ];

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

module.exports = router;