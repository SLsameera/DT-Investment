const request = require('supertest');

describe('Loan API integration (service-mocked)', () => {
  let app;

  beforeAll(() => {
    jest.resetModules();

    // Mock services
    jest.doMock('../../services/loanService', () => ({
      createLoanApplication: jest.fn(async (payload, _userId) => ({ id: 10, status: 'pending', ...payload })),
      getLoanApplicationById: jest.fn(async (id) => ({ id, status: 'pending', requested_amount: 10000 })),
      submitLoanApplication: jest.fn(async (applicationId, _userId) => ({ id: applicationId, status: 'submitted' }))
    }));

    jest.doMock('../../services/riskAssessmentService', () => ({
      performRiskAssessment: jest.fn(async (_appId, _userId) => ({ id: 1, overall_score: 70, risk_level: 'medium' }))
    }));

    jest.doMock('../../services/loanApprovalService', () => ({
      processApproval: jest.fn(async (_applicationId, _level, _data, _userId) => ({ application_status: 'approved' }))
    }));

    // Mock auth middleware to bypass authentication & permissions in tests
    jest.doMock('../../middleware/auth', () => ({
      authenticateToken: (req, res, next) => { req.user = { id: 1, role: 'loan_officer' }; return next(); },
      requirePermission: () => (req, res, next) => next(),
      requireRole: () => (req, res, next) => next(),
      securityHeaders: (req, res, next) => next(),
      rateLimitByUser: (_max, _windowMs) => (req, res, next) => next(),
      validateInput: (_schema) => (req, res, next) => next(),
      auditLog: (_action, _resource) => (req, res, next) => next()
    }));

    app = require('../../app');
  });

  test('POST /api/loans/applications creates application', async () => {
    const res = await request(app)
      .post('/api/loans/applications')
      // include required fields per Joi schema used by the route
      .send({
        customer_id: 1,
        loan_product_id: 2,
        requested_amount: 10000,
        term_months: 12,
        purpose: 'Working capital for retail inventory',
        employment_status: 'employed',
        monthly_income: 50000
      });

    expect(res.statusCode).toBe(201);
    // route wraps the created application under data.application
    expect(res.body).toHaveProperty('data.application.id');
  });

  test('GET /api/loans/applications/:id returns application', async () => {
    const res = await request(app).get('/api/loans/applications/10');
    expect(res.statusCode).toBe(200);
    // route returns application inside data
    expect(res.body).toHaveProperty('data.id', 10);
  });

  test('POST /api/loans/applications/:id/submit queues assessment', async () => {
    const res = await request(app).post('/api/loans/applications/10/submit');
    expect(res.statusCode).toBe(200);
    // route includes the submitted application under data.application
    expect(res.body).toHaveProperty('data.application.id', 10);
  });

  test('POST /api/loans/applications/:id/approve records approval', async () => {
    const res = await request(app)
      .post('/api/loans/applications/10/approve')
      .send({ approval_level: 1, decision: 'approved', comments: 'Looks good' });

    expect(res.statusCode).toBe(200);
    // the mocked service returns application_status inside data
    expect(res.body).toHaveProperty('data.application_status');
  });
});
