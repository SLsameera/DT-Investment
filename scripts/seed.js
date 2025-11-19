const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

const createAdminUser = async () => {
  const client = await pool.connect();
  
  try {
    console.log('👤 Creating admin user...');

    // Check if admin user already exists
    const existingAdmin = await client.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      ['admin', 'admin@tdinvestment.lk']
    );

    if (existingAdmin.rows.length > 0) {
      console.log('⚠️  Admin user already exists. Skipping creation.');
      return;
    }

    // Get the super_admin role ID
    const roleResult = await client.query(
      'SELECT id FROM roles WHERE name = $1',
      ['super_admin']
    );

    if (roleResult.rows.length === 0) {
      throw new Error('Super admin role not found. Please run migration first.');
    }

    const roleId = roleResult.rows[0].id;

    // Get the first branch and department IDs
    const branchResult = await client.query('SELECT id FROM branches ORDER BY id LIMIT 1');
    const departmentResult = await client.query('SELECT id FROM departments ORDER BY id LIMIT 1');

    if (branchResult.rows.length === 0 || departmentResult.rows.length === 0) {
      throw new Error('No branches or departments found. Please run migration first.');
    }

    const branchId = branchResult.rows[0].id;
    const departmentId = departmentResult.rows[0].id;

    // Hash the default password
    const defaultPassword = 'Admin@123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);

    // Create admin user
    const result = await client.query(`
      INSERT INTO users (
        username, 
        email, 
        password_hash, 
        first_name, 
        last_name, 
        phone_number,
        role_id, 
        department_id, 
        branch_id,
        is_active,
        email_verified,
        phone_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, username, email
    `, [
      'admin',
      'admin@tdinvestment.lk',
      hashedPassword,
      'System',
      'Administrator',
      '+94112345678',
      roleId,
      departmentId,
      branchId,
      true,
      true,
      true
    ]);

    const adminUser = result.rows[0];

    // Assign all permissions to super_admin role
    const allPermissions = await client.query('SELECT id FROM permissions');
    
    for (const permission of allPermissions.rows) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id) 
        VALUES ($1, $2) 
        ON CONFLICT (role_id, permission_id) DO NOTHING
      `, [roleId, permission.id]);
    }

    console.log('✅ Admin user created successfully');
    console.log('📧 Email: admin@tdinvestment.lk');
    console.log('🔐 Username: admin');
    console.log('🔑 Password: Admin@123456');
    console.log('⚠️  Please change the default password after first login!');

    return adminUser;

  } catch (error) {
    console.error('❌ Admin user creation failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

const createTestUsers = async () => {
  const client = await pool.connect();
  
  try {
    console.log('👥 Creating test users...');

    const testUsers = [
      {
        username: 'branch_mgr_colombo',
        email: 'branch.manager@tdinvestment.lk',
        firstName: 'John',
        lastName: 'Manager',
        phone: '+94112345679',
        role: 'branch_manager',
        password: 'Manager@123'
      },
      {
        username: 'loan_officer_01',
        email: 'loan.officer@tdinvestment.lk',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+94112345680',
        role: 'loan_officer',
        password: 'Loan@123'
      },
      {
        username: 'finance_mgr',
        email: 'finance.manager@tdinvestment.lk',
        firstName: 'Michael',
        lastName: 'Finance',
        phone: '+94112345681',
        role: 'finance_manager',
        password: 'Finance@123'
      },
      {
        username: 'hr_manager',
        email: 'hr.manager@tdinvestment.lk',
        firstName: 'Sarah',
        lastName: 'HR',
        phone: '+94112345682',
        role: 'hr_manager',
        password: 'HR@123'
      },
      {
        username: 'customer_service_01',
        email: 'customer.service@tdinvestment.lk',
        firstName: 'David',
        lastName: 'Support',
        phone: '+94112345683',
        role: 'customer_service',
        password: 'Support@123'
      }
    ];

    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [userData.username, userData.email]
      );

      if (existingUser.rows.length > 0) {
        console.log(`⚠️  User ${userData.username} already exists. Skipping.`);
        continue;
      }

      // Get role ID
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        [userData.role]
      );

      if (roleResult.rows.length === 0) {
        console.log(`⚠️  Role ${userData.role} not found. Skipping user ${userData.username}.`);
        continue;
      }

      const roleId = roleResult.rows[0].id;

      // Get appropriate department and branch
      const branchResult = await client.query('SELECT id FROM branches ORDER BY id LIMIT 1');
      let departmentId;

      // Assign department based on role
      const departmentMap = {
        'branch_manager': 'Administration',
        'loan_officer': 'Loans',
        'finance_manager': 'Finance',
        'hr_manager': 'HR',
        'customer_service': 'Customer Service'
      };

      const departmentResult = await client.query(
        'SELECT id FROM departments WHERE name = $1',
        [departmentMap[userData.role] || 'Administration']
      );

      departmentId = departmentResult.rows[0]?.id || 1;
      const branchId = branchResult.rows[0]?.id || 1;

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      // Create user
      await client.query(`
        INSERT INTO users (
          username, 
          email, 
          password_hash, 
          first_name, 
          last_name, 
          phone_number,
          role_id, 
          department_id, 
          branch_id,
          is_active,
          email_verified,
          phone_verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        userData.username,
        userData.email,
        hashedPassword,
        userData.firstName,
        userData.lastName,
        userData.phone,
        roleId,
        departmentId,
        branchId,
        true,
        true,
        true
      ]);

      console.log(`✅ Created test user: ${userData.username}`);
    }

    console.log('✅ Test users created successfully');

  } catch (error) {
    console.error('❌ Test user creation failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

const seedDatabase = async () => {
  try {
    await createAdminUser();
    await createTestUsers();
    console.log('🎉 Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('💥 Database seeding failed:', error);
    process.exit(1);
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = {
  createAdminUser,
  createTestUsers,
  seedDatabase
};