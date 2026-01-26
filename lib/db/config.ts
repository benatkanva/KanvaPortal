/**
 * PostgreSQL Database Configuration
 * Connects to Google Cloud SQL for CRM data
 */

import { Pool, QueryResult } from 'pg';

let pool: Pool | null = null;

/**
 * Get or create database connection pool
 */
export function getDbPool(): Pool {
  if (!pool) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    pool = new Pool({
      user: process.env.CLOUD_SQL_USER || 'postgres',
      password: process.env.CLOUD_SQL_PASSWORD,
      database: process.env.CLOUD_SQL_DATABASE || 'crm',
      
      // Local development - direct connection
      ...(!isProduction && {
        host: process.env.CLOUD_SQL_HOST || '127.0.0.1',
        port: parseInt(process.env.CLOUD_SQL_PORT || '5432'),
      }),
      
      // Production - Unix socket connection (Cloud Functions)
      ...(isProduction && process.env.INSTANCE_CONNECTION_NAME && {
        host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
      }),
      
      // Connection pool settings
      max: 5, // Maximum connections in pool
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 10000, // Timeout after 10s
    });
    
    // Handle pool errors
    pool.on('error', (err: Error) => {
      console.error('Unexpected database error:', err);
    });
    
    console.log('✅ Database pool created');
  }
  
  return pool;
}

/**
 * Execute a SQL query
 */
export async function queryDb<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const pool = getDbPool();
  const start = Date.now();
  
  try {
    const result: QueryResult = await pool.query(text, params);
    const duration = Date.now() - start;
    
    console.log(`📊 Query executed in ${duration}ms (${result.rows.length} rows)`);
    
    return result.rows as T[];
  } catch (error) {
    console.error('❌ Database query error:', error);
    console.error('Query:', text);
    console.error('Params:', params);
    throw error;
  }
}

/**
 * Close database pool (for cleanup)
 */
export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('🔌 Database pool closed');
  }
}
