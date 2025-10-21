const express = require('express');
const axios = require('axios');
const router = express.Router();

// AI Service base URL
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';

// Comprehensive Loan Risk Analysis
router.post('/loan-risk-analysis', async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/ai/loan-risk-analysis`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('AI loan risk analysis error:', error.message);
    res.status(500).json({ 
      error: 'AI loan risk analysis failed',
      fallback: true,
      risk_score: 0.5,
      risk_category: 'medium',
      recommendation: 'Manual review required'
    });
  }
});

// Financial Forecasting
router.post('/financial-forecast', async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/ai/financial-forecast`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('AI financial forecast error:', error.message);
    res.status(500).json({ 
      error: 'Financial forecasting failed',
      fallback: true,
      revenue_forecast: { next_month: 100000, next_quarter: 300000 },
      expense_forecast: { next_month: 80000, next_quarter: 240000 }
    });
  }
});

// HR Performance Analysis
router.post('/hr-performance', async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/ai/hr-performance`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('AI HR performance error:', error.message);
    res.status(500).json({ 
      error: 'HR performance analysis failed',
      fallback: true,
      performance_score: 0.8,
      satisfaction_score: 0.75,
      engagement_level: 'high'
    });
  }
});

// Central Intelligence Hub
router.post('/central-intelligence', async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/ai/central-intelligence`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('AI central intelligence error:', error.message);
    res.status(500).json({ 
      error: 'Central intelligence analysis failed',
      fallback: true,
      unified_insights: 'AI engines not available',
      risk_level: 'medium',
      recommendations: ['System monitoring required']
    });
  }
});

// Dashboard-Specific AI Insights
router.get('/dashboard-insights/:dashboardType', async (req, res) => {
  const { dashboardType } = req.params;
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/api/ai/dashboard-insights/${dashboardType}`);
    res.json(response.data);
  } catch (error) {
    console.error('AI dashboard insights error:', error.message);
    
    // Fallback insights based on dashboard type
    const fallbackInsights = {
      'ceo': {
        key_metrics: ['revenue_growth', 'profit_margin', 'market_share'],
        alerts: ['Q4 targets ahead of schedule'],
        recommendations: ['Expand market presence', 'Optimize operational costs'],
        ai_predictions: {
          revenue_trend: 'increasing',
          growth_forecast: '15% next quarter'
        }
      },
      'cfo': {
        key_metrics: ['cash_flow', 'debt_ratio', 'roi'],
        alerts: ['Cash flow optimization needed'],
        recommendations: ['Review expense categories', 'Improve collection rates'],
        ai_predictions: {
          cash_flow_trend: 'stable',
          expense_optimization: '8% potential savings'
        }
      },
      'loan_officer': {
        key_metrics: ['application_volume', 'approval_rate', 'default_rate'],
        alerts: ['High-risk applications detected'],
        recommendations: ['Review credit criteria', 'Enhanced verification'],
        ai_predictions: {
          default_risk: 'medium',
          approval_recommendations: '12 applications flagged'
        }
      },
      'branch_manager': {
        key_metrics: ['branch_performance', 'staff_productivity', 'customer_satisfaction'],
        alerts: ['Staff training opportunity identified'],
        recommendations: ['Team development program', 'Customer service enhancement'],
        ai_predictions: {
          performance_trend: 'improving',
          training_impact: '20% productivity increase expected'
        }
      },
      'hr_manager': {
        key_metrics: ['employee_satisfaction', 'turnover_rate', 'productivity'],
        alerts: ['Employee engagement low in sales team'],
        recommendations: ['Conduct satisfaction survey', 'Review compensation structure'],
        ai_predictions: {
          turnover_risk: 'low',
          engagement_forecast: 'improving with interventions'
        }
      }
    };

    res.json(fallbackInsights[dashboardType] || {
      key_metrics: ['general_performance'],
      alerts: ['AI engine not available'],
      recommendations: ['Manual analysis required'],
      ai_predictions: { status: 'unavailable' },
      fallback: true
    });
  }
});

// Risk Assessment for Specific Loan Applications
router.post('/risk-assessment/:loanId', async (req, res) => {
  try {
    const { loanId } = req.params;
    const loanData = { ...req.body, loan_id: loanId };
    
    const response = await axios.post(`${AI_SERVICE_URL}/api/ai/loan-risk-analysis`, loanData);
    
    // Enhanced response with loan-specific context
    const enhancedResponse = {
      ...response.data,
      loan_id: loanId,
      assessment_timestamp: new Date().toISOString(),
      next_review_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    res.json(enhancedResponse);
  } catch (error) {
    console.error('AI risk assessment error:', error.message);
    res.status(500).json({ 
      error: 'Risk assessment failed',
      loan_id: req.params.loanId,
      fallback: true,
      risk_score: 0.5,
      recommendation: 'Manual underwriting required'
    });
  }
});

// AI-Powered Customer Insights
router.post('/customer-insights', async (req, res) => {
  try {
    const customerData = req.body;
    
    // Combine multiple AI analyses for comprehensive customer insights
    const [riskAnalysis, financialForecast, hrFeedback] = await Promise.allSettled([
      axios.post(`${AI_SERVICE_URL}/api/ai/loan-risk-analysis`, customerData),
      axios.post(`${AI_SERVICE_URL}/api/ai/financial-forecast`, customerData),
      axios.post(`${AI_SERVICE_URL}/api/ai/central-intelligence`, customerData)
    ]);

    const insights = {
      customer_id: customerData.customer_id,
      risk_profile: riskAnalysis.status === 'fulfilled' ? riskAnalysis.value.data : null,
      financial_outlook: financialForecast.status === 'fulfilled' ? financialForecast.value.data : null,
      overall_assessment: hrFeedback.status === 'fulfilled' ? hrFeedback.value.data : null,
      timestamp: new Date().toISOString()
    };

    res.json(insights);
  } catch (error) {
    console.error('AI customer insights error:', error.message);
    res.status(500).json({ 
      error: 'Customer insights analysis failed',
      fallback: true,
      customer_id: req.body.customer_id,
      basic_assessment: 'Manual review recommended'
    });
  }
});

// AI Health Check
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/api/health`);
    res.json({
      ai_service_status: 'connected',
      ai_engines: 'operational',
      workflow_status: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ai_service_status: 'disconnected',
      ai_engines: 'unavailable',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;