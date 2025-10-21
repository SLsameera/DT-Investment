const { query, transaction } = require('../config/database');
// const customerService = require('./customerService'); // reserved for future integration

class RiskAssessmentService {
  constructor() {
    this.riskLevels = {
      'very_low': { score: 100, label: 'Very Low Risk', color: '#4CAF50' },
      'low': { score: 80, label: 'Low Risk', color: '#8BC34A' },
      'medium': { score: 60, label: 'Medium Risk', color: '#FFC107' },
      'high': { score: 40, label: 'High Risk', color: '#FF9800' },
      'very_high': { score: 20, label: 'Very High Risk', color: '#F44336' }
    };

    this.riskFactors = {
      // Credit history factors
      credit_score: { weight: 0.25, max_score: 100 },
      payment_history: { weight: 0.20, max_score: 100 },
      existing_loans: { weight: 0.15, max_score: 100 },
      
      // Income and employment factors
      income_stability: { weight: 0.15, max_score: 100 },
      debt_to_income_ratio: { weight: 0.10, max_score: 100 },
      employment_history: { weight: 0.05, max_score: 100 },
      
      // Collateral and guarantor factors
      collateral_value: { weight: 0.05, max_score: 100 },
      guarantor_strength: { weight: 0.03, max_score: 100 },
      
      // Behavioral factors
      kyc_completeness: { weight: 0.02, max_score: 100 }
    };
  }

  /**
   * Perform comprehensive risk assessment for loan application
   * @param {number} applicationId - Loan application ID
   * @param {number} assessedBy - ID of user performing assessment
   * @returns {Object} Risk assessment result
   */
  async performRiskAssessment(applicationId, assessedBy) {
    try {
      return await transaction(async (client) => {
        // Get loan application with customer data
        const appResult = await client.query(`
          SELECT 
            la.*,
            c.id as customer_id, c.customer_id as customer_code,
            c.first_name, c.last_name, c.phone_number, c.email,
            c.address, c.kyc_status, c.kyc_approved_at,
            lp.name as product_name, lp.risk_category
          FROM loan_applications la
          JOIN customers c ON la.customer_id = c.id
          JOIN loan_products lp ON la.loan_product_id = lp.id
          WHERE la.id = $1
        `, [applicationId]);

        if (appResult.rows.length === 0) {
          throw new Error('Loan application not found');
        }

        const application = appResult.rows[0];

        // Get customer's financial history
        const financialHistory = await this.getCustomerFinancialHistory(application.customer_id);

        // Perform individual risk factor assessments
        const riskFactorScores = await this.calculateRiskFactorScores(application, financialHistory);

        // Calculate overall risk score
        const overallScore = this.calculateOverallRiskScore(riskFactorScores);

        // Determine risk level
        const riskLevel = this.determineRiskLevel(overallScore);

        // Generate risk assessment details
        const assessment = {
          application_id: applicationId,
          customer_id: application.customer_id,
          overall_score: overallScore,
          risk_level: riskLevel,
          risk_factors: riskFactorScores,
          recommendations: this.generateRecommendations(riskLevel, riskFactorScores, application),
          assessment_date: new Date(),
          assessed_by: assessedBy,
          ai_insights: await this.generateAIInsights(application, riskFactorScores)
        };

        // Save risk assessment to database
        const savedAssessment = await this.saveRiskAssessment(client, assessment);

        // Log risk assessment
        await this.logRiskAssessmentActivity(client, applicationId, assessedBy, 'risk_assessment_completed', {
          risk_level: riskLevel,
          overall_score: overallScore,
          assessment_id: savedAssessment.id
        });

        return savedAssessment;
      });
    } catch (error) {
      console.error('Error performing risk assessment:', error);
      throw error;
    }
  }

  /**
   * Calculate risk factor scores
   * @param {Object} application - Loan application data
   * @param {Object} financialHistory - Customer financial history
   * @returns {Object} Risk factor scores
   */
  async calculateRiskFactorScores(application, financialHistory) {
    const scores = {};

    // Credit Score Assessment
    scores.credit_score = this.assessCreditScore(financialHistory.credit_history);

    // Payment History Assessment
    scores.payment_history = this.assessPaymentHistory(financialHistory.payment_history);

    // Existing Loans Assessment
    scores.existing_loans = this.assessExistingLoans(application.existing_debts, application.monthly_income);

    // Income Stability Assessment
    scores.income_stability = this.assessIncomeStability(application.employment_status, application.monthly_income);

    // Debt-to-Income Ratio Assessment
    scores.debt_to_income_ratio = this.assessDebtToIncomeRatio(application.existing_debts, application.monthly_income);

    // Employment History Assessment
    scores.employment_history = this.assessEmploymentHistory(application.employment_status);

    // Collateral Value Assessment
    scores.collateral_value = this.assessCollateralValue(application.collateral_type, application.collateral_value, application.requested_amount);

    // Guarantor Strength Assessment
    scores.guarantor_strength = this.assessGuarantorStrength(application.guarantor_name, application.guarantor_phone);

    // KYC Completeness Assessment
    scores.kyc_completeness = this.assessKYCCompleteness(application.kyc_status, application.kyc_approved_at);

    return scores;
  }

  /**
   * Assess credit score based on credit history
   * @param {Object} creditHistory - Credit history data
   * @returns {number} Credit score (0-100)
   */
  assessCreditScore(creditHistory) {
    if (!creditHistory) {return 50;} // Default score for no history

    let score = 50; // Base score

    // Previous loan performance
    if (creditHistory.successful_loans > 0) {
      score += Math.min(creditHistory.successful_loans * 10, 30);
    }

    // Default history penalty
    if (creditHistory.defaulted_loans > 0) {
      score -= creditHistory.defaulted_loans * 20;
    }

    // Late payment penalty
    if (creditHistory.late_payments > 0) {
      score -= Math.min(creditHistory.late_payments * 5, 25);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess payment history
   * @param {Object} paymentHistory - Payment history data
   * @returns {number} Payment history score (0-100)
   */
  assessPaymentHistory(paymentHistory) {
    if (!paymentHistory) {return 60;} // Default for new customers

    let score = 60;

    // On-time payment rate
    if (paymentHistory.total_payments > 0) {
      const onTimeRate = (paymentHistory.on_time_payments / paymentHistory.total_payments) * 100;
      score = Math.min(100, 20 + (onTimeRate * 0.8));
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess existing loans burden
   * @param {number} existingDebts - Existing debt amount
   * @param {number} monthlyIncome - Monthly income
   * @returns {number} Existing loans score (0-100)
   */
  assessExistingLoans(existingDebts, monthlyIncome) {
    if (!existingDebts || existingDebts === 0) {return 100;}

    const debtRatio = (existingDebts / monthlyIncome) * 100;

    if (debtRatio <= 20) {return 100;}
    if (debtRatio <= 40) {return 80;}
    if (debtRatio <= 60) {return 60;}
    if (debtRatio <= 80) {return 40;}
    return 20;
  }

  /**
   * Assess income stability
   * @param {string} employmentStatus - Employment status
   * @param {number} monthlyIncome - Monthly income
   * @returns {number} Income stability score (0-100)
   */
  assessIncomeStability(employmentStatus, monthlyIncome) {
    let score = 50; // Base score

    // Employment status scoring
    switch (employmentStatus) {
      case 'employed':
        score = 85;
        break;
      case 'self_employed':
        score = 70;
        break;
      case 'retired':
        score = 60;
        break;
      case 'unemployed':
        score = 20;
        break;
      case 'student':
        score = 30;
        break;
      default:
        score = 40;
    }

    // Income level adjustment
    if (monthlyIncome >= 100000) {score += 10;}
    else if (monthlyIncome >= 50000) {score += 5;}
    else if (monthlyIncome < 20000) {score -= 10;}

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess debt-to-income ratio
   * @param {number} existingDebts - Existing debt amount
   * @param {number} monthlyIncome - Monthly income
   * @returns {number} DTI score (0-100)
   */
  assessDebtToIncomeRatio(existingDebts, monthlyIncome) {
    const dtiRatio = ((existingDebts || 0) / monthlyIncome) * 100;

    if (dtiRatio <= 15) {return 100;}
    if (dtiRatio <= 25) {return 90;}
    if (dtiRatio <= 35) {return 75;}
    if (dtiRatio <= 45) {return 60;}
    if (dtiRatio <= 55) {return 40;}
    return 20;
  }

  /**
   * Assess employment history
   * @param {string} employmentStatus - Employment status
   * @returns {number} Employment history score (0-100)
   */
  assessEmploymentHistory(employmentStatus) {
    // Simplified assessment based on employment status
    switch (employmentStatus) {
      case 'employed': return 90;
      case 'self_employed': return 75;
      case 'retired': return 70;
      case 'unemployed': return 10;
      case 'student': return 40;
      default: return 50;
    }
  }

  /**
   * Assess collateral value
   * @param {string} collateralType - Collateral type
   * @param {number} collateralValue - Collateral value
   * @param {number} loanAmount - Requested loan amount
   * @returns {number} Collateral score (0-100)
   */
  assessCollateralValue(collateralType, collateralValue, loanAmount) {
    if (!collateralType || collateralType === 'none') {return 20;}

    if (!collateralValue || collateralValue === 0) {return 30;}

    const collateralRatio = (collateralValue / loanAmount) * 100;

    // Collateral type multiplier
    let typeMultiplier = 1;
    switch (collateralType) {
      case 'property': typeMultiplier = 1.2; break;
      case 'fixed_deposit': typeMultiplier = 1.1; break;
      case 'gold': typeMultiplier = 1.0; break;
      case 'vehicle': typeMultiplier = 0.9; break;
      case 'business_assets': typeMultiplier = 0.8; break;
      case 'guarantee': typeMultiplier = 0.7; break;
      default: typeMultiplier = 0.6;
    }

    let score = 20; // Base score for having collateral

    if (collateralRatio >= 150) {score = 100;}
    else if (collateralRatio >= 120) {score = 90;}
    else if (collateralRatio >= 100) {score = 80;}
    else if (collateralRatio >= 80) {score = 70;}
    else if (collateralRatio >= 60) {score = 60;}
    else {score = 40;}

    return Math.min(100, score * typeMultiplier);
  }

  /**
   * Assess guarantor strength
   * @param {string} guarantorName - Guarantor name
   * @param {string} guarantorPhone - Guarantor phone
   * @returns {number} Guarantor score (0-100)
   */
  assessGuarantorStrength(guarantorName, guarantorPhone) {
    if (!guarantorName || !guarantorPhone) {return 40;}

    // Basic guarantor presence scoring
    let score = 70; // Base score for having a guarantor

    // TODO: Implement guarantor credit check and relationship verification
    // This would involve checking guarantor's financial status and relationship strength

    return score;
  }

  /**
   * Assess KYC completeness
   * @param {string} kycStatus - KYC status
   * @param {Date} kycApprovedAt - KYC approval date
   * @returns {number} KYC score (0-100)
   */
  assessKYCCompleteness(kycStatus, _kycApprovedAt) {
    switch (kycStatus) {
      case 'approved': return 100;
      case 'pending': return 50;
      case 'rejected': return 0;
      default: return 20;
    }
  }

  /**
   * Calculate overall risk score
   * @param {Object} riskFactorScores - Individual risk factor scores
   * @returns {number} Overall risk score (0-100)
   */
  calculateOverallRiskScore(riskFactorScores) {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [factor, score] of Object.entries(riskFactorScores)) {
      if (this.riskFactors[factor]) {
        const weight = this.riskFactors[factor].weight;
        totalScore += score * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 50;
  }

  /**
   * Determine risk level based on score
   * @param {number} score - Overall risk score
   * @returns {string} Risk level
   */
  determineRiskLevel(score) {
    if (score >= 90) {return 'very_low';}
    if (score >= 75) {return 'low';}
    if (score >= 60) {return 'medium';}
    if (score >= 40) {return 'high';}
    return 'very_high';
  }

  /**
   * Generate recommendations based on risk assessment
   * @param {string} riskLevel - Risk level
   * @param {Object} riskFactorScores - Risk factor scores
   * @param {Object} application - Loan application
   * @returns {Array} Recommendations
   */
  generateRecommendations(riskLevel, _riskFactorScores, _application) {
    const recommendations = [];

    // Risk level specific recommendations
    switch (riskLevel) {
      case 'very_low':
        recommendations.push({
          type: 'approval',
          priority: 'high',
          message: 'Recommend approval with standard terms',
          action: 'Proceed with loan approval process'
        });
        break;

      case 'low':
        recommendations.push({
          type: 'approval',
          priority: 'medium',
          message: 'Recommend approval with standard terms',
          action: 'Minor documentation review recommended'
        });
        break;

      case 'medium':
        recommendations.push({
          type: 'conditional',
          priority: 'medium',
          message: 'Conditional approval - consider additional security',
          action: 'Require additional collateral or guarantor'
        });
        break;

      case 'high':
        recommendations.push({
          type: 'review',
          priority: 'high',
          message: 'Requires senior management review',
          action: 'Detailed financial assessment needed'
        });
        break;

      case 'very_high':
        recommendations.push({
          type: 'rejection',
          priority: 'high',
          message: 'Recommend rejection or significant risk mitigation',
          action: 'Consider alternative loan products or declined'
        });
        break;
    }

    // Factor-specific recommendations
    if ((_riskFactorScores && _riskFactorScores.debt_to_income_ratio || 0) < 60) {
      recommendations.push({
        type: 'concern',
        priority: 'medium',
        message: 'High debt-to-income ratio detected',
        action: 'Verify all income sources and existing debts'
      });
    }

    if ((_riskFactorScores && _riskFactorScores.collateral_value || 0) < 50) {
      recommendations.push({
        type: 'requirement',
        priority: 'medium',
        message: 'Insufficient collateral coverage',
        action: 'Require additional collateral or reduce loan amount'
      });
    }

    if ((_riskFactorScores && _riskFactorScores.income_stability || 0) < 60) {
      recommendations.push({
        type: 'verification',
        priority: 'high',
        message: 'Income stability concerns',
        action: 'Verify employment and income documentation'
      });
    }

    return recommendations;
  }

  /**
   * Generate AI insights (placeholder for future ML integration)
   * @param {Object} application - Loan application
   * @param {Object} riskFactorScores - Risk factor scores
   * @returns {Object} AI insights
   */
  async generateAIInsights(_application, _riskFactorScores) {
    // Placeholder for future AI/ML integration
    // use the provided _application parameter locally when calling helper scorers
    const app = _application || {};
    return {
      fraud_score: this.calculateFraudScore(app),
      behavioral_score: this.calculateBehavioralScore(app),
      market_risk_score: this.calculateMarketRiskScore(app),
      recommendations: [
        'Consider seasonal income variations for self-employed applicants',
        'Monitor for early payment indicators',
        'Assess local economic conditions impact'
      ]
    };
  }

  /**
   * Calculate fraud score (basic implementation)
   * @param {Object} application - Loan application
   * @returns {number} Fraud score (0-100, higher = more suspicious)
   */
  calculateFraudScore(_application) {
    const application = _application || {};
    let fraudScore = 0;

    // Basic fraud indicators
    if (application.monthly_income > (application.requested_amount || 0) * 2) {
      fraudScore += 10; // Unusually high income vs loan amount
    }

    if ((application.requested_amount || 0) > 1000000 && application.employment_status === 'unemployed') {
      fraudScore += 30; // High amount with no employment
    }

    // TODO: Implement more sophisticated fraud detection
    // - Phone number validation
    // - Address verification
    // - Income consistency checks
    // - Document authenticity verification

    return Math.min(100, fraudScore);
  }

  /**
   * Calculate behavioral score
   * @param {Object} application - Loan application
   * @returns {number} Behavioral score (0-100)
   */
  calculateBehavioralScore(_application) {
    // Placeholder for behavioral analysis
    // This would analyze customer behavior patterns
    return Math.floor(Math.random() * 40) + 60; // Random score 60-100
  }

  /**
   * Calculate market risk score
   * @param {Object} application - Loan application
   * @returns {number} Market risk score (0-100)
   */
  calculateMarketRiskScore(_application) {
    // Placeholder for market risk analysis
    // This would consider economic conditions, industry risks, etc.
    return Math.floor(Math.random() * 30) + 50; // Random score 50-80
  }

  /**
   * Get customer financial history
   * @param {number} customerId - Customer ID
   * @returns {Object} Financial history data
   */
  async getCustomerFinancialHistory(_customerId) {
    // Placeholder implementation — returns a default empty financial history.
    // Replace with real DB queries when integrating with transaction data.
    return {
      credit_history: {
        successful_loans: 0,
        defaulted_loans: 0,
        late_payments: 0
      },
      payment_history: {
        total_payments: 0,
        on_time_payments: 0,
        late_payments: 0
      }
    };
  }

  /**
   * Save risk assessment to database
   * @param {Object} client - Database client
   * @param {Object} assessment - Risk assessment data
   * @returns {Object} Saved assessment
   */
  async saveRiskAssessment(client, assessment) {
    try {
      const result = await client.query(`
        INSERT INTO loan_risk_assessments (
          loan_application_id, customer_id, overall_score, risk_level,
          risk_factors, recommendations, ai_insights, assessed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        assessment.application_id,
        assessment.customer_id,
        assessment.overall_score,
        assessment.risk_level,
        JSON.stringify(assessment.risk_factors),
        JSON.stringify(assessment.recommendations),
        JSON.stringify(assessment.ai_insights),
        assessment.assessed_by
      ]);

      return {
        ...result.rows[0],
        risk_factors: assessment.risk_factors,
        recommendations: assessment.recommendations,
        ai_insights: assessment.ai_insights
      };
    } catch (error) {
      console.error('Error saving risk assessment:', error);
      throw error;
    }
  }

  /**
   * Get risk assessment for loan application
   * @param {number} applicationId - Loan application ID
   * @returns {Object} Risk assessment
   */
  async getRiskAssessment(applicationId) {
    try {
      const result = await query(`
        SELECT 
          lra.*,
          u.first_name, u.last_name
        FROM loan_risk_assessments lra
        LEFT JOIN users u ON lra.assessed_by = u.id
        WHERE lra.loan_application_id = $1
        ORDER BY lra.created_at DESC
        LIMIT 1
      `, [applicationId]);

      if (result.rows.length === 0) {
        return null;
      }

      const assessment = result.rows[0];
      return {
        ...assessment,
        risk_factors: JSON.parse(assessment.risk_factors || '{}'),
        recommendations: JSON.parse(assessment.recommendations || '[]'),
        ai_insights: JSON.parse(assessment.ai_insights || '{}'),
        assessed_by_name: assessment.first_name && assessment.last_name 
          ? `${assessment.first_name} ${assessment.last_name}` 
          : null
      };
    } catch (error) {
      console.error('Error getting risk assessment:', error);
      return null;
    }
  }

  /**
   * Log risk assessment activity
   * @param {Object} client - Database client
   * @param {number} applicationId - Loan application ID
   * @param {number} userId - User ID
   * @param {string} action - Action performed
   * @param {Object} details - Additional details
   */
  async logRiskAssessmentActivity(client, applicationId, userId, action, details) {
    await client.query(`
      INSERT INTO audit_logs (user_id, action, resource, resource_id, details, success)
      VALUES ($1, $2, 'loan_risk_assessment', $3, $4, true)
    `, [userId, action, applicationId.toString(), JSON.stringify(details)]);
  }

  /**
   * Get risk levels with metadata
   * @returns {Object} Risk levels
   */
  getRiskLevels() {
    return this.riskLevels;
  }

  /**
   * Get risk factors with weights
   * @returns {Object} Risk factors
   */
  getRiskFactors() {
    return this.riskFactors;
  }
}

module.exports = new RiskAssessmentService();