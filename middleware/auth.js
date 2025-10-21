const AuthService = require('../services/authService');

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    const decoded = AuthService.verifyToken(token);
    
    // Check if session is still valid
    const permissions = await AuthService.getUserPermissions(decoded.id);
    if (permissions.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid session or user inactive',
        code: 'INVALID_SESSION'
      });
    }

    req.user = decoded;
    req.user.permissions = permissions;
    next();

  } catch (error) {
    console.error('Authentication error:', error.message);
    
    if (error.message.includes('expired')) {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(403).json({ 
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

// Role-based authorization middleware
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Insufficient role permissions',
        code: 'INSUFFICIENT_ROLE',
        required: allowedRoles,
        current: userRole
      });
    }

    next();
  };
};

// Permission-based authorization middleware
const requirePermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const hasPermission = await AuthService.hasPermission(req.user.id, resource, action);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSION',
          required: { resource, action }
        });
      }

      next();

    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ 
        error: 'Permission verification failed',
        code: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
};

// Branch access control middleware
const requireBranchAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const userBranchId = req.user.branch_id;
  const requestedBranchId = req.params.branchId || req.body.branchId || req.query.branchId;

  // System administrators and executives can access all branches
  const globalRoles = ['admin', 'ceo', 'cfo', 'board_member', 'auditor'];
  
  if (globalRoles.includes(req.user.role)) {
    return next();
  }

  // Check if user is trying to access their own branch or no specific branch requested
  if (!requestedBranchId || parseInt(requestedBranchId) === userBranchId) {
    return next();
  }

  return res.status(403).json({ 
    error: 'Branch access denied',
    code: 'BRANCH_ACCESS_DENIED',
    userBranch: userBranchId,
    requestedBranch: requestedBranchId
  });
};

// Department access control middleware
const requireDepartmentAccess = (allowedDepartments) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userDepartmentId = req.user.department_id;
    
    // System administrators can access all departments
    if (req.user.role === 'admin') {
      return next();
    }

    if (!allowedDepartments.includes(userDepartmentId)) {
      return res.status(403).json({ 
        error: 'Department access denied',
        code: 'DEPARTMENT_ACCESS_DENIED',
        userDepartment: userDepartmentId,
        allowedDepartments
      });
    }

    next();
  };
};

// Rate limiting middleware (simple implementation)
const rateLimitByUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    const userRequests = requests.get(userId) || [];
    const validRequests = userRequests.filter(time => time > windowStart);

    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000)
      });
    }

    validRequests.push(now);
    requests.set(userId, validRequests);
    
    next();
  };
};

// Audit logging middleware
const auditLog = (action, resourceType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    const startTime = Date.now();

    res.send = function(data) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Log the action
      setImmediate(async () => {
        try {
          const { Pool } = require('pg');
          const pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'td_investment',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASS || 'admin123'
          });

          const client = await pool.connect();
          
          await client.query(`
            INSERT INTO audit_logs (
              user_id, action, resource_type, resource_id,
              details, ip_address, user_agent, response_time
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            req.user?.id || null,
            action,
            resourceType,
            req.params.id || null,
            JSON.stringify({
              method: req.method,
              url: req.originalUrl,
              body: req.body,
              query: req.query,
              statusCode: res.statusCode,
              responseTime
            }),
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent'),
            responseTime
          ]);

          client.release();
        } catch (error) {
          console.error('Audit logging error:', error);
        }
      });

      originalSend.call(this, data);
    };

    next();
  };
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict Transport Security (for HTTPS)
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:;"
  );
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  next();
};

// Input validation and sanitization
const validateInput = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true 
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors
      });
    }

    req.body = value;
    next();
  };
};

// Session management
const sessionManagement = async (req, res, next) => {
  if (req.user && req.headers.authorization) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      
      // Update last activity for session tracking
      const { Pool } = require('pg');
      const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'td_investment',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS || 'admin123'
      });

      const client = await pool.connect();
      
      await client.query(`
        UPDATE user_sessions 
        SET last_activity = NOW()
        WHERE session_token = $1 AND user_id = $2
      `, [token, req.user.id]);

      client.release();
    } catch (error) {
      console.error('Session update error:', error);
    }
  }
  
  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission,
  requireBranchAccess,
  requireDepartmentAccess,
  rateLimitByUser,
  auditLog,
  securityHeaders,
  validateInput,
  sessionManagement
};