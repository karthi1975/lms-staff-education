/**
 * Adaptive Database Configuration
 * Supports both local PostgreSQL and Google Cloud SQL
 * Automatically switches based on environment variables
 */

require('dotenv').config();

module.exports = {
  // Environment detection
  isProduction: process.env.NODE_ENV === 'production',
  isCloudSQL: process.env.INSTANCE_CONNECTION_NAME ? true : false,
  
  // Get configuration based on environment
  getConfig() {
    if (this.isCloudSQL) {
      // Cloud SQL configuration for production
      return {
        host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
        database: process.env.DB_NAME || 'teachers_training',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: 5432,
        // Higher limits for production
        max: 25, // Maximum number of clients in the pool
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 2000,
        ssl: false, // Cloud SQL proxy handles SSL
      };
    } else {
      // Local PostgreSQL configuration for development
      return {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'teachers_training',
        user: process.env.DB_USER || 'karthi', // Your local user
        password: process.env.DB_PASSWORD || '',
        // Lower limits for local development
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        ssl: false,
      };
    }
  },

  // Helper to get connection string
  getConnectionString() {
    const config = this.getConfig();
    if (this.isCloudSQL) {
      return `postgresql://${config.user}:${config.password}@${config.host}/${config.database}`;
    }
    // Local connection string
    const password = config.password ? `:${config.password}` : '';
    return `postgresql://${config.user}${password}@${config.host}:${config.port}/${config.database}`;
  },

  // Pool configuration options
  getPoolConfig() {
    const config = this.getConfig();
    return {
      ...config,
      // Additional pool settings
      min: this.isProduction ? 5 : 2,
      log: !this.isProduction, // Enable logging in development
      allowExitOnIdle: !this.isProduction,
    };
  },

  // Test connection helper
  async testConnection(pool) {
    try {
      const result = await pool.query('SELECT NOW()');
      console.log(`✅ Database connected: ${this.isCloudSQL ? 'Cloud SQL' : 'Local PostgreSQL'}`);
      console.log(`   Time: ${result.rows[0].now}`);
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }
};