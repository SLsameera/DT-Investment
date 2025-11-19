const { testConnection } = require('./config/database');

console.log('🔍 Testing database connection...');
testConnection();