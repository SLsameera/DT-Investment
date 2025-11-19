const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Simple test server without database dependency
const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Test route
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'TD Investment System API - Test Mode',
    timestamp: new Date().toISOString(),
    status: 'Authentication system ready for database connection'
  });
});

// Authentication system structure info
app.get('/api/auth/info', (req, res) => {
  res.json({
    success: true,
    message: 'Authentication System Information',
    features: [
      'JWT-based Authentication',
      'Role-based Access Control (16 roles)',
      'Permission-based Authorization',
      'Session Management',
      'Audit Logging',
      'Rate Limiting',
      'Security Headers',
      'Input Validation'
    ],
    endpoints: [
      'POST /api/auth/login - User login',
      'POST /api/auth/logout - User logout',
      'POST /api/auth/register - Register new user (Admin only)',
      'POST /api/auth/refresh - Refresh access token',
      'POST /api/auth/change-password - Change password',
      'GET /api/auth/me - Get current user info',
      'GET /api/auth/permissions - Get user permissions'
    ],
    next_steps: [
      '1. Set up PostgreSQL database',
      '2. Run npm run migrate to create tables',
      '3. Run npm run seed to create admin user',
      '4. Start full server with npm run dev'
    ]
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`
🧪 TD Investment System - Test Server
📍 Running on: http://localhost:${PORT}
🔍 Health Check: http://localhost:${PORT}/health
📋 Auth Info: http://localhost:${PORT}/api/auth/info

⚠️  This is a test server. For full functionality:
1. Set up PostgreSQL database
2. Update .env file with database credentials
3. Run: npm run migrate
4. Run: npm run seed
5. Start: npm run dev
  `);
});

module.exports = app;