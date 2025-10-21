const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const documentRoutes = require('./routes/documents');
const loanRoutes = require('./routes/loanRoutes');
const docsRoutes = require('./routes/docs');
const { securityHeaders } = require('./middleware/auth');

const app = express();

// Expose swagger-ui static distribution under /api to satisfy root-relative asset paths
try {
  const swaggerUiDist = require('swagger-ui-dist');
  const swaggerDistPath = swaggerUiDist.getAbsoluteFSPath();
  app.use('/api', express.static(swaggerDistPath));
  // also expose under /api/docs so relative paths from the docs HTML resolve
  app.use('/api/docs', express.static(swaggerDistPath));
} catch (err) {
  // devDependency may not be installed in some environments; log at debug level
  console.warn('swagger-ui-dist not available:', err.message);
}

// Trust proxy for proper IP detection
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 
    process.env.FRONTEND_URL : 
    ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(globalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Apply global security headers
app.use(securityHeaders);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'TD Investment System API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/docs', docsRoutes);

// Static files (if needed)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    code: 'NOT_FOUND'
  });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Global error handler:', err);

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: err.message,
      code: 'VALIDATION_ERROR'
    });
  }

  // Database connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      success: false,
      error: 'Database connection failed',
      code: 'DATABASE_ERROR'
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 
      'Internal server error' : 
      err.message,
    code: 'INTERNAL_SERVER_ERROR'
  });
});

const PORT = process.env.PORT || 5000;

let server;

if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`
🚀 TD Investment System API Server Started
📊 Environment: ${process.env.NODE_ENV || 'development'}
🌐 Port: ${PORT}
⏰ Started at: ${new Date().toLocaleString()}
🔗 Health Check: http://localhost:${PORT}/health
  `);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('Process terminated');
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
      console.log('Process terminated');
    });
  });
}

module.exports = app;