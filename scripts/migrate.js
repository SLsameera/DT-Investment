const { pool } = require('../config/database');

const createTables = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database migration...');

    // Enable UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create departments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create branches table
    await client.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(10) NOT NULL UNIQUE,
        address TEXT,
        phone VARCHAR(20),
        email VARCHAR(100),
        manager_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create permissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        resource VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create roles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        level INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create role_permissions junction table
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id SERIAL PRIMARY KEY,
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(role_id, permission_id)
      )
    `);

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        phone_number VARCHAR(20),
        role_id INTEGER NOT NULL REFERENCES roles(id),
        department_id INTEGER REFERENCES departments(id),
        branch_id INTEGER REFERENCES branches(id),
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        email_verified BOOLEAN DEFAULT false,
        phone_verified BOOLEAN DEFAULT false,
        two_factor_enabled BOOLEAN DEFAULT false,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create user_sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token VARCHAR(500) NOT NULL,
        access_token_jti VARCHAR(100) NOT NULL,
        ip_address INET,
        user_agent TEXT,
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id VARCHAR(100),
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(20) NOT NULL UNIQUE,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        nic VARCHAR(20) NOT NULL UNIQUE,
        date_of_birth DATE,
        gender VARCHAR(10),
        marital_status VARCHAR(20),
        phone_number VARCHAR(20) NOT NULL,
        email VARCHAR(100),
        address_line1 TEXT NOT NULL,
        address_line2 TEXT,
        city VARCHAR(50) NOT NULL,
        district VARCHAR(50) NOT NULL,
        province VARCHAR(50) NOT NULL,
        postal_code VARCHAR(10),
        occupation VARCHAR(100),
        monthly_income DECIMAL(15,2),
        employer_name VARCHAR(100),
        employer_address TEXT,
        emergency_contact_name VARCHAR(100),
        emergency_contact_phone VARCHAR(20),
        emergency_contact_relationship VARCHAR(50),
        kyc_status VARCHAR(20) DEFAULT 'pending',
        kyc_verified_at TIMESTAMP,
        kyc_verified_by INTEGER REFERENCES users(id),
        branch_id INTEGER NOT NULL REFERENCES branches(id),
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create loan_products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS loan_products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) NOT NULL UNIQUE,
        description TEXT,
        min_amount DECIMAL(15,2) NOT NULL,
        max_amount DECIMAL(15,2) NOT NULL,
        min_term_months INTEGER NOT NULL,
        max_term_months INTEGER NOT NULL,
        interest_rate DECIMAL(5,2) NOT NULL,
        processing_fee_rate DECIMAL(5,2) DEFAULT 0,
        late_payment_penalty_rate DECIMAL(5,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create customer_documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        file_id VARCHAR(100) NOT NULL UNIQUE,
        original_name VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_size BIGINT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        document_type VARCHAR(50) NOT NULL,
        file_hash VARCHAR(64) NOT NULL,
        thumbnail_path TEXT,
        status VARCHAR(20) DEFAULT 'uploaded',
        uploaded_by INTEGER NOT NULL REFERENCES users(id),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create loan_applications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS loan_applications (
        id SERIAL PRIMARY KEY,
        application_id VARCHAR(20) NOT NULL UNIQUE,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        loan_product_id INTEGER NOT NULL REFERENCES loan_products(id),
        requested_amount DECIMAL(15,2) NOT NULL,
        term_months INTEGER NOT NULL,
        interest_rate DECIMAL(5,2) NOT NULL,
        payment_frequency VARCHAR(20) DEFAULT 'monthly',
        monthly_payment DECIMAL(15,2),
        processing_fee DECIMAL(15,2) DEFAULT 0,
        total_amount DECIMAL(15,2),
        purpose TEXT NOT NULL,
        employment_status VARCHAR(50) NOT NULL,
        monthly_income DECIMAL(15,2) NOT NULL,
        existing_debts DECIMAL(15,2) DEFAULT 0,
        collateral_type VARCHAR(50) DEFAULT 'none',
        collateral_value DECIMAL(15,2) DEFAULT 0,
        collateral_description TEXT,
        guarantor_name VARCHAR(100),
        guarantor_phone VARCHAR(20),
        guarantor_relationship VARCHAR(50),
        proposed_start_date DATE,
        status VARCHAR(20) DEFAULT 'draft',
        submitted_at TIMESTAMP,
        approved_at TIMESTAMP,
        rejected_at TIMESTAMP,
        rejection_reason TEXT,
        branch_id INTEGER NOT NULL REFERENCES branches(id),
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create loan_payment_schedules table
    await client.query(`
      CREATE TABLE IF NOT EXISTS loan_payment_schedules (
        id SERIAL PRIMARY KEY,
        loan_application_id INTEGER NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
        payment_number INTEGER NOT NULL,
        due_date DATE NOT NULL,
        payment_amount DECIMAL(15,2) NOT NULL,
        principal_amount DECIMAL(15,2) NOT NULL,
        interest_amount DECIMAL(15,2) NOT NULL,
        remaining_balance DECIMAL(15,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create loan_approvals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS loan_approvals (
        id SERIAL PRIMARY KEY,
        loan_application_id INTEGER NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
        approval_level INTEGER NOT NULL,
        required_role VARCHAR(50) NOT NULL,
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        comments TEXT,
        rejection_reason TEXT,
        is_required BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create loan_risk_assessments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS loan_risk_assessments (
        id SERIAL PRIMARY KEY,
        loan_application_id INTEGER NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        overall_score INTEGER NOT NULL,
        risk_level VARCHAR(20) NOT NULL,
        risk_factors JSONB NOT NULL,
        recommendations JSONB,
        ai_insights JSONB,
        assessed_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create loan_documents table (for linking documents to loan applications)
    await client.query(`
      CREATE TABLE IF NOT EXISTS loan_documents (
        id SERIAL PRIMARY KEY,
        loan_application_id INTEGER NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
        document_id UUID NOT NULL REFERENCES customer_documents(id) ON DELETE CASCADE,
        document_purpose VARCHAR(100) NOT NULL,
        is_required BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(loan_application_id, document_id)
      )
    `);

    // Create indexes for better performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(refresh_token)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON customers(customer_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_customers_nic ON customers(nic)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_customers_branch_id ON customers(branch_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_customer_documents_customer_id ON customer_documents(customer_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_customer_documents_file_id ON customer_documents(file_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_customer_documents_document_type ON customer_documents(document_type)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_customer_documents_status ON customer_documents(status)');
    
    // Loan table indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_loan_applications_customer_id ON loan_applications(customer_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_loan_applications_application_id ON loan_applications(application_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_loan_applications_status ON loan_applications(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_loan_applications_branch_id ON loan_applications(branch_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_loan_payment_schedules_application_id ON loan_payment_schedules(loan_application_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_loan_payment_schedules_due_date ON loan_payment_schedules(due_date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_loan_payment_schedules_status ON loan_payment_schedules(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_loan_approvals_application_id ON loan_approvals(loan_application_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_loan_approvals_status ON loan_approvals(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_loan_risk_assessments_application_id ON loan_risk_assessments(loan_application_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_loan_documents_application_id ON loan_documents(loan_application_id)');

    // Create sequence for loan application IDs
    await client.query('CREATE SEQUENCE IF NOT EXISTS loan_application_id_seq START 1');

    console.log('✅ Database tables created successfully');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

const insertInitialData = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Seeding initial data...');

    // Insert departments
    await client.query(`
      INSERT INTO departments (name, description) VALUES
      ('Administration', 'Administrative and management functions'),
      ('Loans', 'Loan processing and management'),
      ('Finance', 'Financial operations and accounting'),
      ('HR', 'Human resources and employee management'),
      ('IT', 'Information technology and systems'),
      ('Customer Service', 'Customer support and relations'),
      ('Risk Management', 'Risk assessment and compliance'),
      ('Marketing', 'Marketing and business development')
      ON CONFLICT (name) DO NOTHING
    `);

    // Insert branches
    await client.query(`
      INSERT INTO branches (name, code, address, phone, email) VALUES
      ('Head Office', 'HO001', '123 Main Street, Colombo 01', '+94112345678', 'headoffice@tdinvestment.lk'),
      ('Kandy Branch', 'KD001', '456 Kandy Road, Kandy', '+94812345678', 'kandy@tdinvestment.lk'),
      ('Galle Branch', 'GL001', '789 Galle Road, Galle', '+94912345678', 'galle@tdinvestment.lk'),
      ('Negombo Branch', 'NG001', '321 Negombo Road, Negombo', '+94312345678', 'negombo@tdinvestment.lk')
      ON CONFLICT (code) DO NOTHING
    `);

    // Insert permissions
    const permissions = [
      ['user_management', 'users', 'create', 'Create new users'],
      ['user_management', 'users', 'read', 'View user information'],
      ['user_management', 'users', 'update', 'Update user information'],
      ['user_management', 'users', 'delete', 'Delete users'],
      
      // Loan management permissions
      ['create_loan_application', 'loans', 'create', 'Create new loan applications'],
      ['view_loan_application', 'loans', 'read', 'View loan information'],
      ['update_loan_application', 'loans', 'update', 'Update loan information'],
      ['submit_loan_application', 'loans', 'submit', 'Submit loan applications for review'],
      ['approve_loan_application', 'loans', 'approve', 'Approve loan applications'],
      ['reject_loan_application', 'loans', 'reject', 'Reject loan applications'],
      ['perform_risk_assessment', 'loans', 'assess', 'Perform loan risk assessments'],
      ['view_risk_assessment', 'loans', 'view_risk', 'View loan risk assessments'],
      ['manage_loan_workflow', 'loans', 'workflow', 'Manage loan approval workflow'],
      ['view_payment_schedule', 'loans', 'schedule', 'View loan payment schedules'],
      ['process_loan_payments', 'loans', 'payments', 'Process loan payments'],
      
      // Customer management permissions
      ['create_customer', 'customers', 'create', 'Create new customers'],
      ['view_customer', 'customers', 'read', 'View customer information'],
      ['update_customer', 'customers', 'update', 'Update customer information'],
      ['delete_customer', 'customers', 'delete', 'Delete customers'],
      ['approve_kyc', 'customers', 'kyc_approve', 'Approve customer KYC'],
      ['reject_kyc', 'customers', 'kyc_reject', 'Reject customer KYC'],
      
      // Document management permissions
      ['upload_documents', 'documents', 'upload', 'Upload documents'],
      ['view_documents', 'documents', 'read', 'View documents'],
      ['verify_documents', 'documents', 'verify', 'Verify document authenticity'],
      ['delete_documents', 'documents', 'delete', 'Delete documents'],
      
      // Financial and reporting permissions
      ['financial_reports', 'reports', 'read', 'View financial reports'],
      ['loan_reports', 'reports', 'loans', 'View loan reports'],
      ['customer_reports', 'reports', 'customers', 'View customer reports'],
      ['audit_logs', 'logs', 'read', 'View audit logs'],
      
      // System administration
      ['system_settings', 'settings', 'update', 'Update system settings'],
      ['manage_branches', 'branches', 'manage', 'Manage branch information'],
      ['manage_roles', 'roles', 'manage', 'Manage user roles and permissions']
    ];

    for (const [name, resource, action, description] of permissions) {
      await client.query(`
        INSERT INTO permissions (name, resource, action, description) 
        VALUES ($1, $2, $3, $4) 
        ON CONFLICT (name) DO NOTHING
      `, [name, resource, action, description]);
    }

    // Insert roles
    await client.query(`
      INSERT INTO roles (name, display_name, description, level) VALUES
      ('super_admin', 'Super Administrator', 'Full system access', 10),
      ('admin', 'Administrator', 'Administrative access', 9),
      ('branch_manager', 'Branch Manager', 'Branch-level management', 8),
      ('finance_manager', 'Finance Manager', 'Financial operations management', 7),
      ('loan_officer', 'Loan Officer', 'Loan processing and management', 6),
      ('hr_manager', 'HR Manager', 'Human resources management', 6),
      ('customer_service', 'Customer Service Representative', 'Customer support', 5),
      ('finance_officer', 'Finance Officer', 'Financial operations', 4),
      ('it_support', 'IT Support', 'Technical support', 4),
      ('data_entry', 'Data Entry Clerk', 'Data entry operations', 3),
      ('receptionist', 'Receptionist', 'Front desk operations', 2),
      ('security_guard', 'Security Guard', 'Security operations', 1),
      ('driver', 'Driver', 'Transportation services', 1),
      ('cleaner', 'Cleaner', 'Cleaning services', 1),
      ('auditor_internal', 'Internal Auditor', 'Internal audit functions', 7),
      ('auditor_external', 'External Auditor', 'External audit access', 6)
      ON CONFLICT (name) DO NOTHING
    `);

    // Insert loan products
    await client.query(`
      INSERT INTO loan_products (name, code, description, min_amount, max_amount, min_term_months, max_term_months, interest_rate, processing_fee_rate) VALUES
      ('Personal Loan', 'PL001', 'Personal loans for individual customers', 50000, 2000000, 6, 60, 15.5, 2.0),
      ('Business Loan', 'BL001', 'Business loans for entrepreneurs', 100000, 5000000, 12, 84, 14.5, 2.5),
      ('Vehicle Loan', 'VL001', 'Loans for vehicle purchases', 200000, 3000000, 12, 72, 13.5, 1.5),
      ('Home Improvement Loan', 'HL001', 'Loans for home improvements', 100000, 1500000, 12, 60, 16.0, 2.0),
      ('Emergency Loan', 'EL001', 'Quick emergency loans', 25000, 500000, 3, 24, 18.0, 1.0)
      ON CONFLICT (code) DO NOTHING
    `);

    console.log('✅ Initial data seeded successfully');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

const runMigration = async () => {
  try {
    await createTables();
    await insertInitialData();
    console.log('🎉 Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration();
}

module.exports = {
  createTables,
  insertInitialData,
  runMigration
};