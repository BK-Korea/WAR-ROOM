import dotenv from 'dotenv';

dotenv.config();

// Database type selection
const DB_TYPE = process.env.DATABASE_TYPE || 'sqlite'; // 'postgresql' or 'sqlite'

/**
 * Database query function
 * 자동으로 PostgreSQL 또는 SQLite 사용
 */
export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  if (DB_TYPE === 'sqlite') {
    // SQLite 사용
    const { query: sqliteQuery } = await import('./sqlite');
    return sqliteQuery(text, params) as Promise<{ rows: T[]; rowCount: number }>;
  } else {
    // PostgreSQL 사용
    const pg = await import('pg');
    const { Pool } = pg.default;

    if (!postgresPool) {
      postgresPool = new Pool({
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        database: process.env.DATABASE_NAME || 'war_room',
        user: process.env.DATABASE_USER || 'postgres',
        password: process.env.DATABASE_PASSWORD,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      postgresPool.on('error', (err) => {
        console.error('Unexpected error on idle PostgreSQL client', err);
      });
    }

    const start = Date.now();
    try {
      const res = await postgresPool.query<T>(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return {
        rows: res.rows,
        rowCount: res.rowCount || 0
      };
    } catch (error) {
      console.error('Query error', { text, error });
      throw error;
    }
  }
}

// PostgreSQL pool (lazy initialization)
let postgresPool: any = null;

export async function getClient(): Promise<any> {
  if (DB_TYPE === 'postgresql') {
    if (!postgresPool) {
      throw new Error('PostgreSQL pool not initialized');
    }
    return await postgresPool.connect();
  } else {
    throw new Error('getClient() is only available for PostgreSQL');
  }
}

export async function closePool(): Promise<void> {
  if (DB_TYPE === 'postgresql' && postgresPool) {
    await postgresPool.end();
    console.log('✅ PostgreSQL pool closed');
  } else if (DB_TYPE === 'sqlite') {
    const { closeSQLite } = await import('./sqlite');
    closeSQLite();
  }
}

// 초기화
if (DB_TYPE === 'sqlite') {
  console.log('🗄️  Using SQLite database');
  import('./sqlite').then(({ initializeSQLite }) => {
    initializeSQLite();
  });
} else {
  console.log('🐘 Using PostgreSQL database');
}
