const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'td_investment',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'admin123'
});

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

class AuthService {
  // Hash password
  static async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Verify password
  static async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Generate JWT tokens
  static generateTokens(user) {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      department_id: user.department_id,
      branch_id: user.branch_id,
      permissions: user.permissions || []
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { 
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'td-investment-system',
      audience: 'td-investment-users'
    });

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' }, 
      JWT_SECRET, 
      { 
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
        issuer: 'td-investment-system'
      }
    );

    return { accessToken, refreshToken };
  }

  // Verify JWT token
  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET, {
        issuer: 'td-investment-system',
        audience: 'td-investment-users'
      });
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Register new user
  static async register(userData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if username or email already exists
      const existingUser = await client.query(
        'SELECT id FROM staff WHERE username = $1 OR email = $2',
        [userData.username, userData.email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('Username or email already exists');
      }

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);

      // Insert new user
      const userResult = await client.query(`
        INSERT INTO staff (
          username, email, password_hash, first_name, last_name,
          role, department_id, branch_id, phone_number, 
          hire_date, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, username, email, first_name, last_name, role, department_id, branch_id
      `, [
        userData.username,
        userData.email,
        hashedPassword,
        userData.firstName,
        userData.lastName,
        userData.role || 'staff',
        userData.departmentId,
        userData.branchId,
        userData.phoneNumber,
        new Date(),
        'active',
        userData.createdBy || 1
      ]);

      const newUser = userResult.rows[0];

      // Create user session record
      await client.query(`
        INSERT INTO user_sessions (user_id, session_type, created_at)
        VALUES ($1, 'registration', NOW())
      `, [newUser.id]);

      await client.query('COMMIT');
      return newUser;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Login user
  static async login(username, password, ipAddress, userAgent) {
    const client = await pool.connect();
    try {
      // Get user with role permissions
      const userResult = await client.query(`
        SELECT 
          s.id, s.username, s.email, s.password_hash, s.first_name, s.last_name,
          s.role, s.department_id, s.branch_id, s.status, s.last_login,
          d.name as department_name,
          b.name as branch_name,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'permission', rp.permission_name,
                'resource', rp.resource_type,
                'actions', rp.allowed_actions
              )
            ) FILTER (WHERE rp.permission_name IS NOT NULL), 
            '[]'
          ) as permissions
        FROM staff s
        LEFT JOIN departments d ON s.department_id = d.id
        LEFT JOIN branches b ON s.branch_id = b.id
        LEFT JOIN role_permissions rp ON s.role = rp.role_name
        WHERE s.username = $1 OR s.email = $1
        GROUP BY s.id, d.name, b.name
      `, [username]);

      if (userResult.rows.length === 0) {
        throw new Error('Invalid credentials');
      }

      const user = userResult.rows[0];

      // Check if user is active
      if (user.status !== 'active') {
        throw new Error('Account is inactive. Please contact administrator.');
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(password, user.password_hash);
      if (!isPasswordValid) {
        // Log failed login attempt
        await client.query(`
          INSERT INTO audit_logs (
            user_id, action, resource_type, resource_id, 
            details, ip_address, user_agent
          ) VALUES ($1, 'failed_login', 'authentication', $1, $2, $3, $4)
        `, [user.id, JSON.stringify({ reason: 'invalid_password' }), ipAddress, userAgent]);
        
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Update last login
      await client.query(
        'UPDATE staff SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      // Create user session
      const sessionResult = await client.query(`
        INSERT INTO user_sessions (
          user_id, session_token, refresh_token, ip_address, 
          user_agent, session_type, expires_at
        ) VALUES ($1, $2, $3, $4, $5, 'login', NOW() + INTERVAL '24 hours')
        RETURNING id
      `, [user.id, tokens.accessToken, tokens.refreshToken, ipAddress, userAgent]);

      // Log successful login
      await client.query(`
        INSERT INTO audit_logs (
          user_id, action, resource_type, resource_id,
          details, ip_address, user_agent
        ) VALUES ($1, 'login', 'authentication', $1, $2, $3, $4)
      `, [user.id, JSON.stringify({ session_id: sessionResult.rows[0].id }), ipAddress, userAgent]);

          // Return user data without password
      const { password_hash, ...userWithoutPassword } = user;
      void password_hash; // intentionally not returned to callers
      return {
        user: userWithoutPassword,
        tokens
      };

    } finally {
      client.release();
    }
  }

  // Refresh token
  static async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      const client = await pool.connect();
      try {
        // Get user data
        const userResult = await client.query(`
          SELECT s.*, 
            COALESCE(
              json_agg(
                DISTINCT jsonb_build_object(
                  'permission', rp.permission_name,
                  'resource', rp.resource_type,
                  'actions', rp.allowed_actions
                )
              ) FILTER (WHERE rp.permission_name IS NOT NULL), 
              '[]'
            ) as permissions
          FROM staff s
          LEFT JOIN role_permissions rp ON s.role = rp.role_name
          WHERE s.id = $1 AND s.status = 'active'
          GROUP BY s.id
        `, [decoded.id]);

        if (userResult.rows.length === 0) {
          throw new Error('User not found or inactive');
        }

        const user = userResult.rows[0];
        const tokens = this.generateTokens(user);

        // Update session with new tokens
        await client.query(`
          UPDATE user_sessions 
          SET session_token = $1, refresh_token = $2, expires_at = NOW() + INTERVAL '24 hours'
          WHERE user_id = $3 AND refresh_token = $4
        `, [tokens.accessToken, tokens.refreshToken, user.id, refreshToken]);

        return tokens;

      } finally {
        client.release();
      }

    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  // Logout user
  static async logout(userId, sessionToken) {
    const client = await pool.connect();
    try {
      // Invalidate session
      await client.query(`
        UPDATE user_sessions 
        SET session_type = 'logged_out', expires_at = NOW()
        WHERE user_id = $1 AND session_token = $2
      `, [userId, sessionToken]);

      // Log logout
      await client.query(`
        INSERT INTO audit_logs (
          user_id, action, resource_type, resource_id, details
        ) VALUES ($1, 'logout', 'authentication', $1, $2)
      `, [userId, JSON.stringify({ session_invalidated: true })]);

      return { success: true };

    } finally {
      client.release();
    }
  }

  // Get user permissions
  static async getUserPermissions(userId) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          rp.permission_name, rp.resource_type, rp.allowed_actions,
          s.role, s.department_id, s.branch_id
        FROM staff s
        LEFT JOIN role_permissions rp ON s.role = rp.role_name
        WHERE s.id = $1 AND s.status = 'active'
      `, [userId]);

      return result.rows;

    } finally {
      client.release();
    }
  }

  // Check if user has permission
  static async hasPermission(userId, resource, action) {
    const permissions = await this.getUserPermissions(userId);
    
    return permissions.some(permission => 
      permission.resource_type === resource && 
      permission.allowed_actions.includes(action)
    );
  }

  // Change password
  static async changePassword(userId, currentPassword, newPassword) {
    const client = await pool.connect();
    try {
      // Get current password hash
      const userResult = await client.query(
        'SELECT password_hash FROM staff WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await this.verifyPassword(
        currentPassword, 
        userResult.rows[0].password_hash
      );

      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update password
      await client.query(
        'UPDATE staff SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, userId]
      );

      // Invalidate all existing sessions except current one
      await client.query(`
        UPDATE user_sessions 
        SET session_type = 'password_changed', expires_at = NOW()
        WHERE user_id = $1
      `, [userId]);

      // Log password change
      await client.query(`
        INSERT INTO audit_logs (
          user_id, action, resource_type, resource_id, details
        ) VALUES ($1, 'password_change', 'authentication', $1, $2)
      `, [userId, JSON.stringify({ timestamp: new Date() })]);

      return { success: true };

    } finally {
      client.release();
    }
  }

  // Reset password (admin function)
  static async resetPassword(adminUserId, targetUserId, newPassword) {
    const client = await pool.connect();
    try {
      // Verify admin has permission
      const hasResetPermission = await this.hasPermission(adminUserId, 'user_management', 'reset_password');
      if (!hasResetPermission) {
        throw new Error('Insufficient permissions to reset password');
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update password
      await client.query(
        'UPDATE staff SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, targetUserId]
      );

      // Invalidate all sessions for target user
      await client.query(`
        UPDATE user_sessions 
        SET session_type = 'admin_password_reset', expires_at = NOW()
        WHERE user_id = $1
      `, [targetUserId]);

      // Log password reset
      await client.query(`
        INSERT INTO audit_logs (
          user_id, action, resource_type, resource_id, details
        ) VALUES ($1, 'admin_password_reset', 'user_management', $2, $3)
      `, [adminUserId, targetUserId, JSON.stringify({ reset_by: adminUserId })]);

      return { success: true };

    } finally {
      client.release();
    }
  }

  // Get active sessions
  static async getActiveSessions(userId) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          id, ip_address, user_agent, created_at, expires_at,
          session_type, last_activity
        FROM user_sessions 
        WHERE user_id = $1 AND expires_at > NOW()
        ORDER BY created_at DESC
      `, [userId]);

      return result.rows;

    } finally {
      client.release();
    }
  }

  // Revoke session
  static async revokeSession(userId, sessionId) {
    const client = await pool.connect();
    try {
      await client.query(`
        UPDATE user_sessions 
        SET session_type = 'revoked', expires_at = NOW()
        WHERE id = $1 AND user_id = $2
      `, [sessionId, userId]);

      return { success: true };

    } finally {
      client.release();
    }
  }
}

module.exports = AuthService;