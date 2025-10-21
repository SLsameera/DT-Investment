# TD Investment and Micro Credit System - Backend API

## 🚀 Full Development Implementation

This is the backend API for the TD Investment and Micro Credit Management System, featuring comprehensive authentication, authorization, and business logic for microfinance operations.

## 🏗️ System Architecture

### Authentication & Security Features
- ✅ **JWT-based Authentication** with access and refresh tokens
- ✅ **Role-based Access Control (RBAC)** with 16 user roles
- ✅ **Permission-based Authorization** with granular permissions
- ✅ **Branch & Department Access Control**
- ✅ **Session Management** with active session tracking
- ✅ **Audit Logging** for all user actions
- ✅ **Rate Limiting** to prevent abuse
- ✅ **Security Headers** with Helmet.js
- ✅ **Input Validation** with Joi schemas
- ✅ **Password Security** with bcrypt hashing

### Database Schema
- ✅ **Users Management** with comprehensive profiles
- ✅ **Role & Permission System** with flexible assignments
- ✅ **Branch & Department Organization**
- ✅ **Customer Management** with KYC tracking
- ✅ **Loan Products** with configurable terms
- ✅ **Audit Trails** for compliance
- ✅ **Session Tracking** for security

## 📋 Prerequisites

### Required Software
1. **Node.js** (v18.0.0 or higher)
2. **PostgreSQL** (v13 or higher)
3. **npm** (v8.0.0 or higher)

### Database Setup
1. Install PostgreSQL on your system
2. Create a database named `td_investment`
3. Ensure PostgreSQL is running on port 5432

## 🔧 Installation & Setup

### 1. Clone and Navigate
```bash
cd "TD Investment and Micro Credit (Pvt) Ltd/backend"
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and update the database credentials:
```bash
copy .env.example .env
```

Edit `.env` file:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=your_postgres_password
DB_NAME=td_investment

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
```

### 4. Database Setup
```bash
# Test database connection
node test-db.js

# Run migrations to create tables
npm run migrate

# Seed initial data and admin user
npm run seed
```

### 5. Start the Server
```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

## 👤 Default Admin User

After running the seed script, you can login with:
- **Email**: `admin@tdinvestment.lk`
- **Username**: `admin`
- **Password**: `Admin@123456`

⚠️ **Important**: Change the default password after first login!

## 🔐 User Roles & Permissions

### Management Roles
1. **Super Administrator** - Full system access
2. **Administrator** - Administrative access
3. **Branch Manager** - Branch-level management
4. **Finance Manager** - Financial operations management
5. **HR Manager** - Human resources management

### Operational Roles
6. **Loan Officer** - Loan processing and management
7. **Customer Service Representative** - Customer support
8. **Finance Officer** - Financial operations
9. **IT Support** - Technical support
10. **Data Entry Clerk** - Data entry operations

### Support Roles
11. **Receptionist** - Front desk operations
12. **Security Guard** - Security operations
13. **Driver** - Transportation services
14. **Cleaner** - Cleaning services
15. **Internal Auditor** - Internal audit functions
16. **External Auditor** - External audit access

## 🔌 API Endpoints

### Authentication Endpoints
```
POST   /api/auth/login           - User login
POST   /api/auth/logout          - User logout
POST   /api/auth/register        - Register new user (Admin only)
POST   /api/auth/refresh         - Refresh access token
POST   /api/auth/change-password - Change user password
GET    /api/auth/me              - Get current user info
GET    /api/auth/permissions     - Get user permissions
```

### Health Check
```
GET    /health                   - API health status
```

## 🛠️ Development Commands

```bash
# Development with hot reload
npm run dev

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Database operations
npm run migrate     # Create tables and initial data
npm run seed        # Create admin user and test data

# Code quality
npm run lint        # Check code style
npm run lint:fix    # Fix code style issues
```

## 🐳 Database Schema Overview

### Core Tables
- `users` - User accounts with authentication data
- `roles` - User roles with hierarchy levels
- `permissions` - System permissions
- `role_permissions` - Role-permission mappings
- `departments` - Organizational departments
- `branches` - Company branches
- `user_sessions` - Active user sessions
- `audit_logs` - System audit trail

### Business Tables
- `customers` - Customer profiles with KYC data
- `loan_products` - Available loan products
- Additional tables will be created for:
  - Loan applications
  - Payment schedules
  - Financial transactions
  - Reports and analytics

## 🔒 Security Features

### Authentication Security
- JWT tokens with configurable expiration
- Refresh token rotation
- Session invalidation on logout
- Failed login attempt tracking
- Account lockout after failed attempts

### Authorization Security
- Role-based access control
- Permission-based resource access
- Branch and department isolation
- API endpoint protection

### Data Security
- Password hashing with bcrypt
- SQL injection prevention
- XSS protection headers
- CORS configuration
- Rate limiting by IP and user

### Audit & Compliance
- Complete audit trail logging
- User action tracking
- IP address and user agent logging
- Session monitoring
- Error logging and monitoring

## 📊 System Monitoring

### Health Checks
- Database connectivity monitoring
- API endpoint health status
- System resource monitoring

### Logging
- Structured logging with Winston
- Error tracking and reporting
- Performance monitoring
- Security event logging

## 🚀 Next Development Steps

### Phase 1: Core Business Logic ✅ (Current)
- [x] Authentication & Authorization System
- [x] User Management
- [x] Role & Permission System
- [x] Database Schema & Migrations

### Phase 2: Customer Management (Next)
- [ ] Customer registration and KYC
- [ ] Document upload and verification
- [ ] Customer profile management
- [ ] Customer search and filtering

### Phase 3: Loan Management
- [ ] Loan application processing
- [ ] AI-powered risk assessment
- [ ] Approval workflow system
- [ ] Payment schedule generation
- [ ] Loan tracking and monitoring

### Phase 4: Financial Operations
- [ ] Payment processing
- [ ] Interest calculation
- [ ] Late payment penalties
- [ ] Financial reporting
- [ ] Accounting integration

### Phase 5: Advanced Features
- [ ] Mobile API endpoints
- [ ] Real-time notifications
- [ ] Advanced analytics
- [ ] Reporting dashboard
- [ ] Data export capabilities

## 🤝 Contributing

1. Follow the established code structure
2. Use proper error handling
3. Add appropriate logging
4. Include proper validation
5. Update documentation

## 📞 Support

For technical support or questions:
- Email: tech@tdinvestment.lk
- Phone: +94 11 234 5678

---

**TD Investment and Micro Credit (Pvt) Ltd**  
*Empowering Financial Growth Through Technology*