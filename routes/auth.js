const express = require('express');
const Joi = require('joi');
const AuthService = require('../services/authService');
const { 
  authenticateToken, 
  requirePermission,
  auditLog,
  validateInput,
  rateLimitByUser,
  securityHeaders
} = require('../middleware/auth');

const router = express.Router();

// Apply security headers to all auth routes
router.use(securityHeaders);

// Validation schemas
const loginSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(50).required(),
  password: Joi.string().min(6).max(100).required()
});

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required()
    .messages({
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
    }),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  role: Joi.string().valid('staff', 'loan_officer', 'branch_manager', 'finance_officer', 'hr_manager').default('staff'),
  departmentId: Joi.number().integer().positive().required(),
  branchId: Joi.number().integer().positive().required(),
  phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(20).required()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(100).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required()
    .messages({
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
    })
});

// @route   POST /api/auth/login
// @desc    Authenticate user and return JWT tokens
// @access  Public
router.post('/login', 
  rateLimitByUser(10, 15 * 60 * 1000), // 10 attempts per 15 minutes
  validateInput(loginSchema),
  auditLog('login_attempt', 'authentication'),
  async (req, res) => {
    try {
      const { username, password } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      const result = await AuthService.login(username, password, ipAddress, userAgent);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresIn: '24h'
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      
      const errorMessage = error.message === 'Invalid credentials' ? 
        'Invalid username or password' : 
        'Login failed. Please try again.';

      res.status(401).json({
        success: false,
        error: errorMessage,
        code: 'LOGIN_FAILED'
      });
    }
  }
);

// @route   POST /api/auth/register
// @desc    Register new user (admin only)
// @access  Private (Admin)
router.post('/register',
  authenticateToken,
  requirePermission('user_management', 'create'),
  validateInput(registerSchema),
  auditLog('user_registration', 'user_management'),
  async (req, res) => {
    try {
      const userData = {
        ...req.body,
        createdBy: req.user.id
      };

      const newUser = await AuthService.register(userData);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: newUser
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: error.message,
          code: 'USER_EXISTS'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Registration failed. Please try again.',
        code: 'REGISTRATION_FAILED'
      });
    }
  }
);

// @route   POST /api/auth/refresh
// @desc    Refresh access token using refresh token
// @access  Public
router.post('/refresh',
  rateLimitByUser(20, 15 * 60 * 1000),
  async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token required',
          code: 'REFRESH_TOKEN_REQUIRED'
        });
      }

      const tokens = await AuthService.refreshToken(refreshToken);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: '24h'
        }
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      
      res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }
  }
);

// @route   POST /api/auth/logout
// @desc    Logout user and invalidate session
// @access  Private
router.post('/logout',
  authenticateToken,
  auditLog('logout', 'authentication'),
  async (req, res) => {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      await AuthService.logout(req.user.id, token);

      res.json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      console.error('Logout error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Logout failed',
        code: 'LOGOUT_FAILED'
      });
    }
  }
);

// @route   GET /api/auth/me
// @desc    Get current user information
// @access  Private
router.get('/me',
  authenticateToken,
  async (req, res) => {
    try {
      const permissions = await AuthService.getUserPermissions(req.user.id);
      
      res.json({
        success: true,
        data: {
          user: {
            ...req.user,
            permissions
          }
        }
      });

    } catch (error) {
      console.error('Get user info error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to get user information',
        code: 'USER_INFO_FAILED'
      });
    }
  }
);

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password',
  authenticateToken,
  validateInput(changePasswordSchema),
  auditLog('password_change', 'authentication'),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      await AuthService.changePassword(req.user.id, currentPassword, newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Change password error:', error);
      
      if (error.message.includes('incorrect')) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect',
          code: 'INCORRECT_PASSWORD'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Password change failed',
        code: 'PASSWORD_CHANGE_FAILED'
      });
    }
  }
);

// @route   GET /api/auth/permissions
// @desc    Get user permissions
// @access  Private
router.get('/permissions',
  authenticateToken,
  async (req, res) => {
    try {
      const permissions = await AuthService.getUserPermissions(req.user.id);

      res.json({
        success: true,
        data: {
          permissions,
          role: req.user.role,
          branchId: req.user.branch_id,
          departmentId: req.user.department_id
        }
      });

    } catch (error) {
      console.error('Get permissions error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to get permissions',
        code: 'GET_PERMISSIONS_FAILED'
      });
    }
  }
);

module.exports = router;