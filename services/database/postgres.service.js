/**
 * PostgreSQL Database Service
 * Manages connection pooling and database operations
 */

const { Pool } = require('pg');
const dbConfig = require('../../config/database.config');

class PostgresService {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  /**
   * Initialize database connection pool
   */
  async initialize() {
    try {
      if (this.pool) {
        console.log('PostgreSQL pool already initialized');
        return this.pool;
      }

      // Create connection pool with adaptive configuration
      const poolConfig = dbConfig.getPoolConfig();
      this.pool = new Pool(poolConfig);

      // Test connection
      const connected = await dbConfig.testConnection(this.pool);
      if (!connected) {
        throw new Error('Failed to connect to database');
      }

      this.isConnected = true;

      // Handle pool errors
      this.pool.on('error', (err, client) => {
        console.error('Unexpected error on idle client', err);
        this.isConnected = false;
      });

      // Handle pool connection
      this.pool.on('connect', (client) => {
        console.log('New client connected to pool');
      });

      // Handle pool removal
      this.pool.on('remove', (client) => {
        console.log('Client removed from pool');
      });

      return this.pool;
    } catch (error) {
      console.error('Failed to initialize PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Get pool instance
   */
  getPool() {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  /**
   * Execute a query with automatic client management
   */
  async query(text, params) {
    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (!dbConfig.isProduction) {
        console.log('Query executed:', { text, duration, rows: result.rowCount });
      }
      
      return result;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from pool for manual transaction control
   */
  async getClient() {
    return await this.pool.connect();
  }

  /**
   * Check if database is connected
   */
  async checkConnection() {
    try {
      await this.pool.query('SELECT 1');
      this.isConnected = true;
      return true;
    } catch (error) {
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Close all connections in the pool
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      console.log('PostgreSQL pool closed');
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    if (!this.pool) {
      return null;
    }
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
}

// Create singleton instance
const postgresService = new PostgresService();

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Closing database connections...');
  await postgresService.close();
  process.exit(0);
});

module.exports = postgresService;