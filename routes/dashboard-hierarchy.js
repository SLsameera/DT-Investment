// ================================
// TD Investment - Dashboard Hierarchy Routes
// ================================

const express = require('express');
const router = express.Router();

// ================================
// EXECUTIVE LEVEL DASHBOARDS
// ================================

// Board of Directors Dashboard
router.get('/board-of-directors', async (req, res) => {
    try {
        const boardDashboard = {
            dashboardType: 'Board of Directors',
            level: 'Executive',
            accessLevel: 'Strategic Oversight',
            widgets: {
                companyPerformance: {
                    totalRevenue: 156750000,
                    annualGrowth: 18.5,
                    netProfitMargin: 22.3,
                    returnOnEquity: 24.7
                },
                strategicMetrics: {
                    totalBranches: 5,
                    totalEmployees: 67,
                    totalCustomers: 1847,
                    portfolioSize: 125500000
                },
                riskOverview: {
                    portfolioAtRisk: 8.2,
                    capitalAdequacyRatio: 15.8,
                    liquidityRatio: 12.4,
                    complianceScore: 96.8
                },
                boardMeetings: {
                    nextMeeting: '2024-02-15',
                    lastResolution: 'Approve Q4 2023 Financial Statements',
                    pendingApprovals: 3,
                    quarterlyReports: 4
                }
            },
            reports: [
                'Annual Financial Report',
                'Risk Assessment Report',
                'Governance Report',
                'Audit Committee Report'
            ],
            permissions: ['strategic_decisions', 'policy_approval', 'executive_oversight']
        };

        res.json({ success: true, data: boardDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// CEO/Managing Director Dashboard
router.get('/ceo', async (req, res) => {
    try {
        const ceoDashboard = {
            dashboardType: 'CEO/Managing Director',
            level: 'Executive',
            accessLevel: 'Full System Access',
            widgets: {
                executiveSummary: {
                    monthlyRevenue: 12750000,
                    monthlyProfit: 2842500,
                    activeLoans: 435,
                    collectionRate: 87.5,
                    staffProductivity: 92.3
                },
                departmentOverview: {
                    finance: { performance: 94.2, budget_utilization: 87.5 },
                    operations: { performance: 89.7, target_achievement: 92.1 },
                    risk: { performance: 96.8, compliance_score: 98.2 },
                    hr: { performance: 91.5, employee_satisfaction: 88.9 },
                    marketing: { performance: 87.3, customer_acquisition: 115.2 }
                },
                branchPerformance: [
                    { branch: 'Colombo Main', performance: 94.5, revenue: 4250000 },
                    { branch: 'Kandy', performance: 89.2, revenue: 3180000 },
                    { branch: 'Galle', performance: 91.7, revenue: 2850000 },
                    { branch: 'Kurunegala', performance: 87.3, revenue: 1920000 },
                    { branch: 'Jaffna', performance: 85.9, revenue: 1550000 }
                ],
                alerts: [
                    { type: 'high', message: 'Kurunegala branch below target by 12%' },
                    { type: 'medium', message: '3 regulatory reports due this week' },
                    { type: 'low', message: 'Staff training completion at 96.8%' }
                ]
            },
            permissions: ['full_access', 'strategic_decisions', 'budget_approval', 'policy_changes']
        };

        res.json({ success: true, data: ceoDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// CFO/Finance Director Dashboard
router.get('/cfo', async (req, res) => {
    try {
        const cfoDashboard = {
            dashboardType: 'CFO/Finance Director',
            level: 'Executive',
            accessLevel: 'Financial Control',
            widgets: {
                financialSummary: {
                    totalAssets: 189750000,
                    totalLiabilities: 147230000,
                    shareholderEquity: 42520000,
                    debtToEquityRatio: 3.46,
                    currentRatio: 1.23
                },
                cashFlow: {
                    operatingCashFlow: 8950000,
                    investingCashFlow: -2150000,
                    financingCashFlow: -1200000,
                    netCashFlow: 5600000
                },
                profitAndLoss: {
                    revenue: 12750000,
                    operatingExpenses: 8420000,
                    interestExpense: 1487500,
                    netIncome: 2842500,
                    profitMargin: 22.3
                },
                externalIntegrations: {
                    xero: { status: 'synced', lastSync: '2024-01-15T02:00:00Z' },
                    quickbooks: { status: 'synced', lastSync: '2024-01-15T02:15:00Z' },
                    cbslReporting: { status: 'compliant', nextDue: '2024-02-01' },
                    bankReconciliation: { status: 'balanced', variance: 0 }
                }
            },
            permissions: ['financial_data', 'budget_management', 'reporting', 'external_integrations']
        };

        res.json({ success: true, data: cfoDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Risk & Compliance Officer Dashboard
router.get('/risk-officer', async (req, res) => {
    try {
        const riskDashboard = {
            dashboardType: 'Risk & Compliance Officer',
            level: 'Executive',
            accessLevel: 'Risk & Compliance',
            widgets: {
                riskMetrics: {
                    portfolioAtRisk: 8.2,
                    defaultRate: 3.1,
                    riskWeightedAssets: 145890000,
                    capitalAdequacyRatio: 15.8,
                    concentrationRisk: 12.4
                },
                complianceStatus: {
                    overallScore: 96.8,
                    cbslCompliance: 98.5,
                    fiuCompliance: 94.2,
                    internalAudit: 97.3,
                    pendingActions: 3
                },
                fraudDetection: {
                    alertsToday: 2,
                    investigationsActive: 5,
                    casesClosed: 18,
                    falsePositiveRate: 8.7
                },
                regulatoryReporting: [
                    { authority: 'CBSL', report: 'Monthly MFI Return', due: '2024-02-05', status: 'pending' },
                    { authority: 'FIU', report: 'Cash Transaction Report', due: '2024-02-10', status: 'draft' },
                    { authority: 'DRC', report: 'Annual Return', due: '2024-03-31', status: 'not_started' }
                ]
            },
            permissions: ['risk_data', 'compliance_reports', 'audit_access', 'regulatory_interface']
        };

        res.json({ success: true, data: riskDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Auditor Dashboard
router.get('/auditor', async (req, res) => {
    try {
        const auditorDashboard = {
            dashboardType: 'Auditor',
            level: 'Executive',
            accessLevel: 'Audit & Review',
            widgets: {
                auditOverview: {
                    activeAudits: 3,
                    completedThisMonth: 7,
                    findingsOpen: 12,
                    findingsClosed: 45,
                    complianceScore: 94.7
                },
                auditSchedule: [
                    { branch: 'Colombo Main', type: 'operational', date: '2024-01-22', status: 'scheduled' },
                    { branch: 'Kandy', type: 'financial', date: '2024-01-25', status: 'in_progress' },
                    { department: 'IT', type: 'security', date: '2024-01-30', status: 'scheduled' }
                ],
                findings: {
                    critical: 2,
                    high: 5,
                    medium: 15,
                    low: 23,
                    resolved: 78
                },
                systemAccess: {
                    auditTrail: 'full_access',
                    transactionHistory: 'read_only',
                    staffActivities: 'monitor',
                    reportGeneration: 'unlimited'
                }
            },
            permissions: ['audit_trail', 'system_logs', 'transaction_review', 'compliance_monitoring']
        };

        res.json({ success: true, data: auditorDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================
// OPERATIONAL LEVEL DASHBOARDS
// ================================

// Branch Manager Dashboard
router.get('/branch-manager/:branchId?', async (req, res) => {
    try {
        const branchId = req.params.branchId || 'BR001';
        const branchDashboard = {
            dashboardType: 'Branch Manager',
            level: 'Operational',
            branchId: branchId,
            branchName: 'Colombo Main Branch',
            widgets: {
                branchPerformance: {
                    monthlyTarget: 5000000,
                    currentAchievement: 4250000,
                    achievementRate: 85.0,
                    activeLoans: 145,
                    newLoansThisMonth: 28,
                    collectionRate: 89.2
                },
                staffOverview: {
                    totalStaff: 12,
                    presentToday: 11,
                    performanceAvg: 88.5,
                    targetAchievement: 92.3,
                    trainingCompletion: 96.8
                },
                moduleStatus: {
                    loanOfficerModule: { active: true, performance: 92.1 },
                    financeOfficerModule: { active: true, performance: 94.7 },
                    customerRelationshipModule: { active: true, performance: 87.3 },
                    staffAgentManagement: { active: true, performance: 91.5 }
                },
                financialSummary: {
                    cashInHand: 1250000,
                    dailyCollections: 185000,
                    monthlyRevenue: 4250000,
                    expenseRatio: 23.4
                }
            },
            permissions: ['branch_data', 'staff_management', 'customer_data', 'loan_approval_limit']
        };

        res.json({ success: true, data: branchDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Loan Officer Dashboard
router.get('/loan-officer/:staffId?', async (req, res) => {
    try {
        const staffId = req.params.staffId || 'LO001';
        const loanOfficerDashboard = {
            dashboardType: 'Loan Officer',
            level: 'Operational',
            staffId: staffId,
            staffName: 'Ms. Priya Wijesinghe',
            widgets: {
                loanPortfolio: {
                    totalLoans: 48,
                    activeLoans: 42,
                    portfolioValue: 12850000,
                    averageLoanSize: 267708,
                    defaultRate: 2.1
                },
                monthlyTargets: {
                    loanTarget: 15,
                    currentApplications: 12,
                    approvedLoans: 8,
                    disbursedAmount: 2150000,
                    targetAchievement: 80.0
                },
                pendingApplications: [
                    { customer: 'Mr. Kamal Silva', amount: 500000, status: 'under_review', days: 3 },
                    { customer: 'Ms. Neesha Fernando', amount: 300000, status: 'documentation', days: 7 },
                    { customer: 'Mr. Sunil Perera', amount: 750000, status: 'credit_check', days: 2 }
                ],
                aiAssistance: {
                    riskPredictions: 23,
                    approvalRecommendations: 15,
                    flaggedApplications: 2,
                    modelAccuracy: 89.2
                }
            },
            permissions: ['loan_data', 'customer_profiles', 'ai_predictions', 'approval_workflow']
        };

        res.json({ success: true, data: loanOfficerDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Finance Officer Dashboard
router.get('/finance-officer/:staffId?', async (req, res) => {
    try {
        const staffId = req.params.staffId || 'FO001';
        const financeOfficerDashboard = {
            dashboardType: 'Finance Officer',
            level: 'Operational',
            staffId: staffId,
            staffName: 'Mr. Janaka Silva',
            widgets: {
                dailyOperations: {
                    cashInHand: 1250000,
                    dailyCollections: 185000,
                    dailyDisbursements: 150000,
                    cashVariance: 0,
                    transactionsProcessed: 47
                },
                accountReconciliation: {
                    bankAccounts: 5,
                    reconciledToday: 4,
                    pendingItems: 3,
                    variance: 2500,
                    lastReconciliation: '2024-01-15T16:30:00Z'
                },
                reporting: {
                    dailyReports: 'completed',
                    weeklyReports: 'pending',
                    monthlyReports: 'in_progress',
                    yearEndReports: 'scheduled'
                },
                systemIntegrations: {
                    xero: 'synced',
                    bankGateway: 'connected',
                    paymentProcessor: 'active',
                    cbslReporting: 'updated'
                }
            },
            permissions: ['financial_transactions', 'account_reconciliation', 'reporting', 'payment_processing']
        };

        res.json({ success: true, data: financeOfficerDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Customer Relationship Dashboard
router.get('/customer-relationship/:staffId?', async (req, res) => {
    try {
        const staffId = req.params.staffId || 'CS001';
        const customerDashboard = {
            dashboardType: 'Customer Relationship',
            level: 'Operational',
            staffId: staffId,
            staffName: 'Ms. Dilini Rajapaksa',
            widgets: {
                customerOverview: {
                    totalCustomers: 324,
                    activeCustomers: 298,
                    newCustomersThisMonth: 28,
                    customerRetentionRate: 94.7,
                    averageRelationshipLength: 18.5
                },
                serviceMetrics: {
                    callsHandled: 23,
                    averageResponseTime: '2.3 minutes',
                    customerSatisfaction: 4.2,
                    complaintsResolved: 8,
                    pendingRequests: 5
                },
                kycStatus: {
                    verifiedCustomers: 289,
                    pendingVerification: 18,
                    documentsRequired: 12,
                    verificationRate: 94.1
                },
                mobileAppUsage: {
                    registeredUsers: 187,
                    activeUsers: 134,
                    appRating: 4.3,
                    supportTickets: 6
                }
            },
            permissions: ['customer_data', 'kyc_management', 'service_requests', 'mobile_app_support']
        };

        res.json({ success: true, data: customerDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Staff & Agent Management Dashboard
router.get('/staff-management/:managerId?', async (req, res) => {
    try {
        const managerId = req.params.managerId || 'BM001';
        const staffManagementDashboard = {
            dashboardType: 'Staff & Agent Management',
            level: 'Operational',
            managerId: managerId,
            managerName: 'Mr. Ranjith Fernando',
            widgets: {
                teamOverview: {
                    totalStaff: 12,
                    presentToday: 11,
                    onLeave: 1,
                    averagePerformance: 88.5,
                    teamProductivity: 92.3
                },
                performanceTracking: [
                    { staff: 'Ms. Priya Wijesinghe', role: 'Loan Officer', performance: 94.2, target: 92.0 },
                    { staff: 'Mr. Saman Perera', role: 'Loan Officer', performance: 87.3, target: 90.0 },
                    { staff: 'Mr. Kamal Jayawardena', role: 'Collection Officer', performance: 91.5, target: 88.0 },
                    { staff: 'Ms. Sanduni Perera', role: 'Cashier', performance: 96.1, target: 95.0 }
                ],
                fieldAgents: {
                    totalAgents: 8,
                    activeInField: 6,
                    visitsCompleted: 34,
                    collectionsToday: 185000,
                    gpsTracking: 'active'
                },
                training: {
                    trainingPrograms: 5,
                    completionRate: 96.8,
                    certificationsEarned: 23,
                    nextTrainingDate: '2024-01-25'
                }
            },
            permissions: ['staff_data', 'performance_management', 'training_records', 'field_operations']
        };

        res.json({ success: true, data: staffManagementDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================
// TECHNICAL & BUSINESS LEVEL DASHBOARDS
// ================================

// Developer/System Engineer Dashboard
router.get('/developer', async (req, res) => {
    try {
        const developerDashboard = {
            dashboardType: 'Developer/System Engineer',
            level: 'Technical & Business',
            accessLevel: 'System Administration',
            widgets: {
                systemHealth: {
                    frontendUptime: 99.97,
                    backendUptime: 99.95,
                    aiServiceUptime: 99.89,
                    databaseUptime: 99.99,
                    overallHealth: 'excellent'
                },
                infraStructure: {
                    powerShellMonitoring: 'active',
                    autoRecoveryEvents: 2,
                    cicdPipeline: 'healthy',
                    deploymentSuccess: 98.5,
                    dockerContainers: 4
                },
                aiServices: {
                    loanRiskEngine: { status: 'active', accuracy: 89.2, predictions24h: 147 },
                    sentimentAnalysis: { status: 'active', accuracy: 92.1, predictions24h: 89 },
                    predictiveAnalytics: { status: 'active', accuracy: 85.7, predictions24h: 203 },
                    investmentAdvisory: { status: 'active', accuracy: 87.9, predictions24h: 34 }
                },
                performance: {
                    apiResponseTime: '125ms',
                    databaseQueryTime: '12ms',
                    pageLoadTime: '1.8s',
                    errorRate: 0.03
                }
            },
            permissions: ['system_administration', 'deployment_control', 'monitoring_tools', 'ai_model_management']
        };

        res.json({ success: true, data: developerDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Marketing & Sales Manager Dashboard
router.get('/marketing', async (req, res) => {
    try {
        const marketingDashboard = {
            dashboardType: 'Marketing & Sales Manager',
            level: 'Technical & Business',
            accessLevel: 'Marketing Operations',
            widgets: {
                customerAcquisition: {
                    newCustomersThisMonth: 128,
                    acquisitionTarget: 150,
                    achievementRate: 85.3,
                    acquisitionCost: 8500,
                    conversionRate: 12.4
                },
                campaignPerformance: [
                    { campaign: 'New Year Loan Special', leads: 245, conversions: 34, roi: 234 },
                    { campaign: 'SME Business Loans', leads: 156, conversions: 28, roi: 187 },
                    { campaign: 'Digital Banking Promotion', leads: 189, conversions: 21, roi: 156 }
                ],
                digitalMetrics: {
                    websiteVisitors: 2847,
                    socialMediaReach: 15600,
                    emailOpenRate: 24.7,
                    mobileAppDownloads: 234
                },
                marketAnalysis: {
                    marketShare: 8.5,
                    competitorAnalysis: 'favorable',
                    brandRecognition: 67.8,
                    customerSatisfaction: 88.9
                }
            },
            permissions: ['marketing_data', 'campaign_management', 'customer_insights', 'brand_management']
        };

        res.json({ success: true, data: marketingDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// HR & Training Manager Dashboard
router.get('/hr-manager', async (req, res) => {
    try {
        const hrDashboard = {
            dashboardType: 'HR & Training Manager',
            level: 'Technical & Business',
            accessLevel: 'Human Resources',
            widgets: {
                workforce: {
                    totalEmployees: 67,
                    newHires: 5,
                    resignations: 2,
                    averageTenure: 3.2,
                    employeeRetention: 94.7
                },
                performance: {
                    averageRating: 88.5,
                    promotionsThisYear: 12,
                    performanceReviews: 'completed',
                    goalAchievement: 91.3
                },
                training: {
                    programsActive: 8,
                    completionRate: 96.8,
                    certificationsEarned: 34,
                    trainingBudgetUtilized: 78.5
                },
                recruitment: {
                    openPositions: 3,
                    candidatesInPipeline: 12,
                    timeToHire: 18,
                    offerAcceptanceRate: 87.5
                }
            },
            permissions: ['employee_data', 'performance_reviews', 'training_programs', 'recruitment_management']
        };

        res.json({ success: true, data: hrDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================
// EXTERNAL ACCESS LEVEL DASHBOARDS
// ================================

// Partner/Investor Dashboard
router.get('/partner-investor', async (req, res) => {
    try {
        const partnerDashboard = {
            dashboardType: 'Partner/Investor',
            level: 'External Access',
            accessLevel: 'Investment Overview',
            widgets: {
                financialHighlights: {
                    totalRevenue: 156750000,
                    netProfit: 34985250,
                    returnOnInvestment: 24.7,
                    dividendYield: 8.5
                },
                portfolioMetrics: {
                    totalPortfolio: 125500000,
                    portfolioGrowth: 18.5,
                    riskLevel: 'moderate',
                    diversificationScore: 87.3
                },
                marketPosition: {
                    marketShare: 8.5,
                    competitiveRanking: 3,
                    growthRate: 22.1,
                    customerBase: 1847
                },
                investmentOpportunities: [
                    { opportunity: 'Branch Expansion', investment: 15000000, roi: 28.5 },
                    { opportunity: 'Digital Platform', investment: 8000000, roi: 34.2 },
                    { opportunity: 'AI Enhancement', investment: 5000000, roi: 45.7 }
                ]
            },
            permissions: ['financial_overview', 'performance_metrics', 'investment_data']
        };

        res.json({ success: true, data: partnerDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Regulatory Authority Dashboard
router.get('/regulatory', async (req, res) => {
    try {
        const regulatoryDashboard = {
            dashboardType: 'Regulatory Authority',
            level: 'External Access',
            accessLevel: 'Compliance Monitoring',
            widgets: {
                complianceStatus: {
                    overallScore: 96.8,
                    cbslCompliance: 98.5,
                    fiuCompliance: 94.2,
                    kycCompliance: 97.1,
                    amlCompliance: 95.8
                },
                reportingStatus: [
                    { report: 'Monthly MFI Return', due: '2024-02-05', status: 'submitted', onTime: true },
                    { report: 'Cash Transaction Report', due: '2024-02-10', status: 'pending', onTime: true },
                    { report: 'Quarterly Review', due: '2024-03-31', status: 'not_due', onTime: null }
                ],
                riskMetrics: {
                    capitalAdequacyRatio: 15.8,
                    liquidityRatio: 12.4,
                    portfolioAtRisk: 8.2,
                    provisionCoverage: 78.5
                },
                auditFindings: {
                    totalFindings: 5,
                    critical: 0,
                    high: 1,
                    medium: 2,
                    low: 2,
                    resolved: 3
                }
            },
            permissions: ['compliance_data', 'regulatory_reports', 'audit_access']
        };

        res.json({ success: true, data: regulatoryDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Agent/Field Partner Dashboard
router.get('/field-agent/:agentId?', async (req, res) => {
    try {
        const agentId = req.params.agentId || 'FA001';
        const fieldAgentDashboard = {
            dashboardType: 'Agent/Field Partner',
            level: 'External Access',
            accessLevel: 'Field Operations',
            agentId: agentId,
            agentName: 'Mr. Thisara Bandara',
            widgets: {
                dailyTargets: {
                    collectionTarget: 50000,
                    collectedToday: 37500,
                    achievementRate: 75.0,
                    customersVisited: 8,
                    targetVisits: 12
                },
                fieldActivities: {
                    currentLocation: 'Colombo 05',
                    checkInTime: '08:30 AM',
                    visitLogged: 8,
                    collectionsRecorded: 6,
                    documentsUploaded: 12
                },
                customerInteractions: [
                    { customer: 'Mr. Kamal Silva', type: 'collection', amount: 15000, status: 'completed' },
                    { customer: 'Ms. Neesha Fernando', type: 'visit', amount: 0, status: 'no_payment' },
                    { customer: 'Mr. Sunil Perera', type: 'collection', amount: 22500, status: 'completed' }
                ],
                mobileAppFeatures: {
                    gpsTracking: 'active',
                    offlineMode: 'available',
                    photoCapture: 'enabled',
                    documentSync: 'auto'
                }
            },
            permissions: ['field_data', 'customer_visits', 'collection_recording', 'mobile_features']
        };

        res.json({ success: true, data: fieldAgentDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Customer Mobile App Dashboard
router.get('/customer-mobile/:customerId?', async (req, res) => {
    try {
        const customerId = req.params.customerId || 'CUST001';
        const customerMobileDashboard = {
            dashboardType: 'Customer Mobile App',
            level: 'External Access',
            accessLevel: 'Self Service',
            customerId: customerId,
            customerName: 'Mr. Ranil Wickremasinghe',
            widgets: {
                accountSummary: {
                    totalLoans: 2,
                    activeLoans: 1,
                    outstandingBalance: 285000,
                    nextPaymentDue: '2024-01-25',
                    nextPaymentAmount: 15000
                },
                loanDetails: [
                    {
                        loanNumber: 'LN2024001234',
                        principal: 300000,
                        outstanding: 285000,
                        monthlyPayment: 15000,
                        nextDue: '2024-01-25',
                        status: 'active'
                    }
                ],
                paymentHistory: [
                    { date: '2023-12-25', amount: 15000, status: 'paid', method: 'mobile_banking' },
                    { date: '2023-11-25', amount: 15000, status: 'paid', method: 'cash' },
                    { date: '2023-10-25', amount: 15000, status: 'paid', method: 'bank_transfer' }
                ],
                quickActions: [
                    'Make Payment',
                    'View Statements',
                    'Apply for Loan',
                    'Contact Support',
                    'Find Branch'
                ]
            },
            permissions: ['account_view', 'payment_history', 'loan_application', 'support_contact']
        };

        res.json({ success: true, data: customerMobileDashboard });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================
// DASHBOARD HIERARCHY OVERVIEW
// ================================

// Get Dashboard Hierarchy Information
router.get('/hierarchy', async (req, res) => {
    try {
        const hierarchyStructure = {
            levels: [
                {
                    level: 'Executive Level',
                    description: 'Strategic oversight and high-level decision making',
                    dashboards: [
                        'Board of Directors Dashboard',
                        'CEO/Managing Director Dashboard',
                        'CFO/Finance Director Dashboard',
                        'Risk & Compliance Officer Dashboard',
                        'Auditor Dashboard'
                    ],
                    accessLevel: 'Strategic',
                    permissions: ['strategic_decisions', 'policy_approval', 'full_system_access']
                },
                {
                    level: 'Operational Level',
                    description: 'Day-to-day operations and management',
                    dashboards: [
                        'Branch Manager Dashboard',
                        'Loan Officer Dashboard',
                        'Finance Officer Dashboard',
                        'Customer Relationship Dashboard',
                        'Staff & Agent Management Dashboard'
                    ],
                    accessLevel: 'Operational',
                    permissions: ['operational_data', 'staff_management', 'customer_interaction']
                },
                {
                    level: 'Technical & Business',
                    description: 'Specialized functions and support',
                    dashboards: [
                        'Developer/System Engineer Dashboard',
                        'Marketing & Sales Manager Dashboard',
                        'HR & Training Manager Dashboard'
                    ],
                    accessLevel: 'Functional',
                    permissions: ['specialized_access', 'system_administration', 'department_specific']
                },
                {
                    level: 'External Access',
                    description: 'External stakeholders and partners',
                    dashboards: [
                        'Partner/Investor Dashboard',
                        'Regulatory Authority Dashboard',
                        'Agent/Field Partner Dashboard',
                        'Customer Mobile App Dashboard'
                    ],
                    accessLevel: 'Limited',
                    permissions: ['read_only', 'specific_functions', 'self_service']
                }
            ],
            totalDashboards: 16,
            hierarchyFlow: {
                'Board of Directors': ['CEO/Managing Director'],
                'CEO/Managing Director': ['CFO', 'Risk Officer', 'Branch Manager', 'Developer', 'Marketing Manager', 'HR Manager'],
                'Branch Manager': ['Loan Officer', 'Finance Officer', 'Customer Relationship', 'Staff Management'],
                'External': ['Partner/Investor', 'Regulatory', 'Field Agent', 'Customer Mobile']
            }
        };

        res.json({
            success: true,
            data: hierarchyStructure
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;