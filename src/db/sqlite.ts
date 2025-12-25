/**
 * SQLite Database Adapter
 *
 * PostgreSQL 대신 SQLite를 사용하여 Dorothy가 즉시 동작하도록 함.
 * 별도 서버 설치 없이 파일 기반 DB로 작동.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQLite 데이터베이스 파일 경로
const DB_PATH = path.join(process.cwd(), 'war-room.db');

let db: Database.Database | null = null;

/**
 * SQLite 데이터베이스 초기화
 */
export function initializeSQLite(): Database.Database {
  if (db) {
    return db;
  }

  console.log(`📁 Initializing SQLite database at: ${DB_PATH}`);

  db = new Database(DB_PATH);

  // WAL 모드 활성화 (동시성 향상)
  db.pragma('journal_mode = WAL');

  // Foreign keys 활성화
  db.pragma('foreign_keys = ON');

  // 스키마 초기화
  initializeSchema();

  console.log('✅ SQLite database initialized successfully');

  return db;
}

/**
 * 데이터베이스 스키마 초기화
 */
function initializeSchema(): void {
  if (!db) {
    throw new Error('Database not initialized');
  }

  console.log('📋 Creating database schema...');

  // shared schema tables
  db.exec(`
    -- Companies table
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      industry TEXT,
      website TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Projects table
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      company_id INTEGER REFERENCES companies(id),
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Dorothy finance schema
    -- SEC Filings table
    CREATE TABLE IF NOT EXISTS sec_filings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      cik TEXT NOT NULL,
      filing_type TEXT NOT NULL,
      filing_date DATE NOT NULL,
      report_date DATE NOT NULL,
      accession_number TEXT NOT NULL UNIQUE,
      file_url TEXT,
      raw_content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sec_filings_company ON sec_filings(company_id);
    CREATE INDEX IF NOT EXISTS idx_sec_filings_type_date ON sec_filings(filing_type, filing_date DESC);

    -- Financial data extracted from filings
    CREATE TABLE IF NOT EXISTS financial_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filing_id INTEGER NOT NULL REFERENCES sec_filings(id),
      metric_name TEXT NOT NULL,
      metric_value REAL,
      metric_unit TEXT,
      period_start DATE,
      period_end DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Amy tracker schema
    -- Activity timeline
    CREATE TABLE IF NOT EXISTS activity_timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      agent_name TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      activity_description TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_timeline(project_id);
    CREATE INDEX IF NOT EXISTS idx_activity_agent ON activity_timeline(agent_name);

    -- Elsa risk schema
    -- Guardrails
    CREATE TABLE IF NOT EXISTS guardrails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      rule_type TEXT NOT NULL,
      rule_config TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('✅ Database schema created successfully');
}

/**
 * PostgreSQL 호환 query 함수
 * pg 모듈과 동일한 인터페이스 제공
 */
export async function query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> {
  if (!db) {
    db = initializeSQLite();
  }

  try {
    // PostgreSQL의 $1, $2 형식을 SQLite의 ? 형식으로 변환
    const sqliteQuery = text.replace(/\$(\d+)/g, '?');

    // SELECT 쿼리인지 확인
    const isSelect = sqliteQuery.trim().toUpperCase().startsWith('SELECT');

    if (isSelect) {
      const stmt = db.prepare(sqliteQuery);
      const rows = params ? stmt.all(...params) : stmt.all();
      return {
        rows,
        rowCount: rows.length
      };
    } else {
      // INSERT, UPDATE, DELETE
      const stmt = db.prepare(sqliteQuery);
      const result = params ? stmt.run(...params) : stmt.run();

      // INSERT의 경우 RETURNING 절 처리
      if (sqliteQuery.toUpperCase().includes('RETURNING')) {
        // RETURNING 절에서 반환할 컬럼 추출
        const returningMatch = sqliteQuery.match(/RETURNING\s+(.+?)(?:;|$)/i);
        if (returningMatch) {
          // 방금 INSERT된 row를 가져옴
          const lastId = result.lastInsertRowid;
          const tableName = sqliteQuery.match(/INSERT\s+INTO\s+(\S+)/i)?.[1];

          if (tableName && lastId) {
            const selectStmt = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
            const row = selectStmt.get(lastId);
            return {
              rows: row ? [row] : [],
              rowCount: row ? 1 : 0
            };
          }
        }
      }

      return {
        rows: [],
        rowCount: result.changes
      };
    }
  } catch (error: any) {
    console.error('Query error', {
      text,
      params,
      error
    });
    throw error;
  }
}

/**
 * 데이터베이스 연결 닫기
 */
export function closeSQLite(): void {
  if (db) {
    db.close();
    db = null;
    console.log('✅ SQLite database closed');
  }
}

/**
 * 데이터베이스 인스턴스 가져오기
 */
export function getDatabase(): Database.Database {
  if (!db) {
    db = initializeSQLite();
  }
  return db;
}
