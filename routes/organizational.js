// ================================
// TD Investment - Organizational API Routes
// ================================

const express = require('express');
const router = express.Router();

// ================================
// EXECUTIVE TEAM ROUTES
// ================================

// Get Executive Team Structure
router.get('/executive-team', async (req, res) => {
    try {
        const executiveTeam = [
            {
                id: 'EXE001',
                name: 'Mr. Kamal Dissanayake',
                position: 'CEO/Managing Director',
                email: 'ceo@tdinvestment.lk',
                department: 'Executive Management',
                reportsTo: null,
                directReports: ['EXE002', 'EXE003', 'EXE004', 'EXE005'],
                responsibilities: [
                    'Strategic Leadership',
                    'Overall Operations Oversight',
                    'Board Relations',
                    'Stakeholder Management'
                ]
            },
            {
                id: 'EXE002',
                name: 'Ms. Shanti Kumari',
                position: 'CFO/Finance Director',
                email: 'cfo@tdinvestment.lk',
                department: 'Finance & Accounting',
                reportsTo: 'EXE001',
                directReports: ['FIN001', 'FIN002'],
                responsibilities: [
                    'Financial Control',
                    'Central Finance Database Management',
                    'External System Integrations (Xero/QuickBooks/CBSL)',
                    'Financial Reporting'
                ]
            },
            {
                id: 'EXE003',
                name: 'Mr. Nimal Silva',
                position: 'Risk Officer',
                email: 'risk@tdinvestment.lk',
                department: 'Risk & Compliance',
                reportsTo: 'EXE001',
                directReports: ['RISK001', 'AUDIT001'],
                responsibilities: [
                    'Risk & Compliance Management',
                    'Auditor Dashboard Oversight',
                    'Regulatory Authority Interface',
                    'Compliance Monitoring'
                ]
            },
            {
                id: 'EXE004',
                name: 'Ms. Kamala Rajapaksa',
                position: 'HR/Training Manager',
                email: 'hr@tdinvestment.lk',
                department: 'Human Resources',
                reportsTo: 'EXE001',
                directReports: ['HR001', 'TRAIN001'],
                responsibilities: [
                    'Human Resource Management',
                    'Staff Training & Development',
                    'Performance Management',
                    'Recruitment & Retention'
                ]
            },
            {
                id: 'EXE005',
                name: 'Mr. Thilan Perera',
                position: 'Marketing Manager',
                email: 'marketing@tdinvestment.lk',
                department: 'Marketing',
                reportsTo: 'EXE001',
                directReports: ['MKT001', 'MKT002'],
                responsibilities: [
                    'Marketing Strategy',
                    'Customer Acquisition',
                    'Brand Management',
                    'Digital Marketing'
                ]
            }
        ];

        res.json({
            success: true,
            data: executiveTeam,
            orgChart: {
                totalExecutives: executiveTeam.length,
                departments: ['Executive Management', 'Finance & Accounting', 'Risk & Compliance', 'Human Resources', 'Marketing']
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================
// BRANCH OPERATIONS ROUTES
// ================================

// Get Branch Manager Structure
router.get('/branch-operations', async (req, res) => {
    try {
        const branchOperations = {
            totalBranches: 5,
            branches: [
                {
                    branchCode: 'BR001',
                    branchName: 'Colombo Main Branch',
                    manager: {
                        id: 'BM001',
                        name: 'Mr. Ranjith Fernando',
                        email: 'ranjith.fernando@tdinvestment.lk'
                    },
                    modules: {
                        loanOfficerModule: {
                            description: 'Loan Operations Management',
                            staff: [
                                { id: 'LO001', name: 'Ms. Priya Wijesinghe', role: 'Senior Loan Officer' },
                                { id: 'LO002', name: 'Mr. Saman Perera', role: 'Loan Officer' },
                                { id: 'LO003', name: 'Ms. Neesha Silva', role: 'Loan Officer' }
                            ],
                            metrics: {
                                activeLoans: 145,
                                monthlyTarget: 50,
                                currentAchievement: 38
                            }
                        },
                        collectionModule: {
                            description: 'Collections & Repayment Management',
                            staff: [
                                { id: 'CO001', name: 'Mr. Kamal Jayawardena', role: 'Collection Officer' },
                                { id: 'CO002', name: 'Ms. Sujatha Mendis', role: 'Collection Officer' },
                                { id: 'FA001', name: 'Mr. Thisara Bandara', role: 'Field Agent' }
                            ],
                            metrics: {
                                collectionRate: 87.5,
                                monthlyTarget: 2500000,
                                currentCollections: 2187500
                            }
                        },
                        customerRelationshipHub: {
                            description: 'Customer Services & Relationship Management',
                            staff: [
                                { id: 'CS001', name: 'Ms. Dilini Rajapaksa', role: 'Customer Service Representative' },
                                { id: 'RM001', name: 'Mr. Nalaka Gunasekara', role: 'Relationship Manager' }
                            ],
                            metrics: {
                                activeCustomers: 324,
                                newCustomersThisMonth: 28,
                                satisfactionScore: 4.2
                            }
                        },
                        financeAccountingModule: {
                            description: 'Branch Finance & Accounting',
                            staff: [
                                { id: 'CA001', name: 'Ms. Sanduni Perera', role: 'Cashier' },
                                { id: 'AC001', name: 'Mr. Janaka Silva', role: 'Accountant' }
                            ],
                            metrics: {
                                dailyCashBalance: 1250000,
                                monthlyRevenue: 4850000,
                                expenseRatio: 0.23
                            }
                        },
                        staffAgentManagement: {
                            description: 'Staff & Agent Performance Management',
                            totalStaff: 12,
                            performanceMetrics: {
                                avgPerformanceScore: 88.5,
                                targetAchievementRate: 92.3,
                                trainingCompletionRate: 96.8
                            }
                        }
                    }
                }
            ]
        };

        res.json({
            success: true,
            data: branchOperations
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================
// AI SERVICES ROUTES
// ================================

// Get AI Services Architecture
router.get('/ai-services', async (req, res) => {
    try {
        const aiServices = {
            microservices: [
                {
                    id: 'T1',
                    name: 'AI Loan Risk Engine',
                    description: 'Loan Risk Prediction',
                    endpoint: 'http://localhost:5000/predict-risk',
                    status: 'active',
                    lastModelUpdate: '2024-01-15',
                    accuracy: 89.2,
                    predictions24h: 147
                },
                {
                    id: 'T2',
                    name: 'AI Sentiment Analysis',
                    description: 'Customer Sentiment Analysis',
                    endpoint: 'http://localhost:5000/analyze-sentiment',
                    status: 'active',
                    lastModelUpdate: '2024-01-10',
                    accuracy: 92.1,
                    predictions24h: 89
                },
                {
                    id: 'T3',
                    name: 'Predictive Analytics',
                    description: 'Default Forecast',
                    endpoint: 'http://localhost:5000/predict-default',
                    status: 'active',
                    lastModelUpdate: '2024-01-12',
                    accuracy: 85.7,
                    predictions24h: 203
                },
                {
                    id: 'T4',
                    name: 'Investment Advisory AI',
                    description: 'Business Intelligence',
                    endpoint: 'http://localhost:5000/investment-advice',
                    status: 'active',
                    lastModelUpdate: '2024-01-14',
                    accuracy: 87.9,
                    predictions24h: 34
                }
            ],
            knowledgeBase: {
                totalModels: 12,
                totalInsights: 2847,
                lastUpdate: '2024-01-15T10:30:00Z',
                categories: ['risk_models', 'customer_patterns', 'market_trends', 'fraud_patterns']
            }
        };

        res.json({
            success: true,
            data: aiServices
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================
// MOBILE INTERFACES ROUTES
// ================================

// Get Mobile Interface Statistics
router.get('/mobile-interfaces', async (req, res) => {
    try {
        const mobileStats = {
            customerMobileApp: {
                name: 'TD Customer App',
                totalUsers: 1247,
                activeUsers24h: 189,
                appVersion: '2.1.3',
                platforms: {
                    android: 789,
                    ios: 458
                },
                features: [
                    'Account Balance View',
                    'Payment History',
                    'Loan Application',
                    'Payment Reminders',
                    'Customer Support Chat'
                ],
                avgRating: 4.3,
                lastUpdate: '2024-01-10'
            },
            agentFieldApp: {
                name: 'TD Field Agent App',
                totalAgents: 45,
                activeAgents24h: 32,
                appVersion: '1.8.7',
                features: [
                    'GPS Location Tracking',
                    'Customer Visit Logging',
                    'Photo & Document Capture',
                    'Offline Data Sync',
                    'Collection Recording'
                ],
                activitiesLogged24h: 127,
                avgVisitsPerAgent: 8.3,
                lastUpdate: '2024-01-08'
            }
        };

        res.json({
            success: true,
            data: mobileStats
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================
// REPORTING LAYER ROUTES
// ================================

// Get Report Engine Status
router.get('/reporting', async (req, res) => {
    try {
        const reportingStatus = {
            engine: {
                name: 'PDF/Excel Report Engine',
                status: 'active',
                version: '3.2.1',
                lastMaintenance: '2024-01-12'
            },
            reportTypes: [
                {
                    category: 'Financial Reports',
                    templates: ['P&L Statement', 'Balance Sheet', 'Cash Flow', 'Portfolio Summary'],
                    frequency: ['daily', 'monthly', 'quarterly'],
                    lastGenerated: '2024-01-15T08:00:00Z'
                },
                {
                    category: 'Operational Reports',
                    templates: ['Loan Portfolio', 'Collection Performance', 'Branch Operations', 'Staff Performance'],
                    frequency: ['daily', 'weekly', 'monthly'],
                    lastGenerated: '2024-01-15T06:30:00Z'
                },
                {
                    category: 'Regulatory Reports',
                    templates: ['CBSL Returns', 'FIU Reports', 'Compliance Summary'],
                    frequency: ['monthly', 'quarterly'],
                    lastGenerated: '2024-01-01T09:00:00Z'
                }
            ],
            statistics: {
                reportsGenerated24h: 23,
                totalTemplates: 18,
                avgGenerationTime: '3.2 seconds',
                totalReportsGenerated: 1847
            }
        };

        res.json({
            success: true,
            data: reportingStatus
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================
// SYSTEM MONITORING ROUTES
// ================================

// Get System Health and Infrastructure
router.get('/system-health', async (req, res) => {
    try {
        const systemHealth = {
            infrastructure: {
                powerShellAutoRecovery: {
                    status: 'active',
                    lastCheck: '2024-01-15T14:25:00Z',
                    servicesMonitored: ['frontend:3000', 'backend:4000', 'ai_service:5000'],
                    restarts24h: 2,
                    uptime: '99.97%'
                },
                cicdPipeline: {
                    status: 'active',
                    platform: 'GitHub Actions + Docker',
                    lastDeployment: '2024-01-14T16:20:00Z',
                    deploymentSuccess: '98.5%',
                    environments: ['production', 'staging', 'development']
                },
                databases: {
                    mainPostgreSQL: {
                        status: 'healthy',
                        connections: 24,
                        responseTime: '12ms',
                        diskUsage: '45%'
                    },
                    aiKnowledgeBase: {
                        status: 'healthy',
                        connections: 8,
                        responseTime: '8ms',
                        diskUsage: '23%'
                    }
                }
            },
            integrations: {
                xero: { status: 'connected', lastSync: '2024-01-15T02:00:00Z' },
                quickbooks: { status: 'connected', lastSync: '2024-01-15T02:15:00Z' },
                cbslApi: { status: 'connected', lastSync: '2024-01-15T01:00:00Z' },
                bankGateway: { status: 'connected', transactions24h: 156 }
            }
        };

        res.json({
            success: true,
            data: systemHealth
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ================================
// SUPER ADMIN DASHBOARD ROUTE
// ================================

// Get Complete Organizational Overview
router.get('/super-admin-dashboard', async (req, res) => {
    try {
        const superAdminData = {
            organizational: {
                totalExecutives: 5,
                totalBranches: 5,
                totalStaff: 67,
                totalCustomers: 1847,
                boardMembers: 3
            },
            financial: {
                totalPortfolio: 125500000,
                monthlyRevenue: 12750000,
                collectionRate: 87.5,
                profitMargin: 18.3
            },
            operational: {
                activeLoans: 435,
                newApplications24h: 12,
                collectionsToday: 2100000,
                systemUptime: 99.97
            },
            ai: {
                modelsActive: 4,
                predictions24h: 473,
                avgAccuracy: 88.7,
                insightsGenerated: 23
            },
            risk: {
                portfolioAtRisk: 8.2,
                highRiskAccounts: 12,
                complianceScore: 96.8,
                auditFindings: 2
            }
        };

        res.json({
            success: true,
            data: superAdminData,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;