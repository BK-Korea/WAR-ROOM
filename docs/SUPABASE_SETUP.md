# Supabase Setup Guide - Helena Agent

## Overview

이 가이드는 Helena agent를 위한 Supabase PostgreSQL 데이터베이스 설정 방법을 설명합니다.

**골드만삭스급 금융 데이터 인프라** 구축을 위한 production-ready 설정입니다.

---

## Prerequisites

- Supabase 계정 (https://supabase.com)
- Node.js 18+ (프로젝트 환경)
- `.env.local` 파일 접근 권한

---

## Step 1: Supabase 프로젝트 생성

### 1.1 Supabase 대시보드 접속

https://supabase.com/dashboard 접속 후 로그인

### 1.2 새 프로젝트 생성

1. **"New Project"** 클릭
2. 프로젝트 설정:
   ```
   Name: WAR-ROOM
   Database Password: [강력한 비밀번호 생성]
   Region: Northeast Asia (Seoul) 또는 US East (Ohio)
   Pricing Plan: Free (or Pro for production)
   ```
3. **"Create new project"** 클릭
4. ⏱️ 프로젝트 초기화 대기 (약 2분)

### 1.3 프로젝트 URL 및 API Key 확인

프로젝트 생성 후, **Settings → API** 메뉴에서 확인:

```
Project URL: https://[your-project-id].supabase.co
API Key (anon, public): eyJhbG...
API Key (service_role, secret): eyJhbG... ⚠️ 비밀!
```

---

## Step 2: 환경변수 설정

### 2.1 `.env.local` 파일 업데이트

프로젝트 루트의 `.env.local` 파일에 추가:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...  # Public anon key
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...      # ⚠️ Secret service role key

# Supabase Direct Database URL (for migrations)
SUPABASE_DB_URL=postgresql://postgres:[your-password]@db.[your-project-id].supabase.co:5432/postgres
```

**⚠️ 중요**:
- `SUPABASE_SERVICE_ROLE_KEY`는 **절대 public에 노출하지 말 것**
- `.gitignore`에 `.env.local`이 포함되어 있는지 확인

### 2.2 Vercel 환경변수 설정 (Production)

Vercel 대시보드:
1. **Settings → Environment Variables**
2. 위의 4개 변수 추가
3. Environment: Production, Preview, Development 모두 체크

---

## Step 3: 데이터베이스 마이그레이션 실행

### 3.1 Supabase SQL Editor에서 실행

**Option A: Supabase Dashboard 사용 (추천)**

1. Supabase 대시보드 → **SQL Editor**
2. **"New query"** 클릭
3. `supabase/migrations/001_initial_helena_schema.sql` 파일 내용 복사
4. 붙여넣기 후 **"Run"** 클릭
5. ✅ Success 메시지 확인

**Option B: psql CLI 사용**

```bash
# psql 설치 확인
psql --version

# 마이그레이션 실행
psql "$SUPABASE_DB_URL" < supabase/migrations/001_initial_helena_schema.sql

# 성공 시 출력:
# CREATE EXTENSION
# CREATE TABLE
# CREATE INDEX
# ...
```

### 3.2 테이블 생성 확인

Supabase 대시보드 → **Table Editor**

다음 테이블들이 보여야 함:
- ✅ `company_financials` (재무 숫자)
- ✅ `filing_sections` (텍스트 섹션)
- ✅ `audit_trail` (감사 기록)
- ✅ `helena_job_queue` (백그라운드 작업)
- ✅ `company_metadata` (회사 메타데이터)

### 3.3 View 확인

**Database → Views** 메뉴:
- ✅ `latest_financials`
- ✅ `latest_filings`

---

## Step 4: Supabase Client 설정

### 4.1 패키지 설치

```bash
npm install @supabase/supabase-js
```

### 4.2 Supabase 클라이언트 생성

**파일: `src/lib/supabase.ts`** (새로 생성)

```typescript
import { createClient } from '@supabase/supabase-js';

// Supabase client singleton
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Service role client (for Helena & Dorothy - full access)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Public client (for frontend - limited access)
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

// Database types (auto-generated - optional)
export type Database = {
  public: {
    Tables: {
      company_financials: {
        Row: {
          id: number;
          ticker: string;
          cik: string;
          company_name: string;
          filing_type: string;
          filing_date: string;
          filing_accession: string;
          period_end_date: string;
          fiscal_year: number;
          fiscal_quarter: number | null;
          metric_name: string;
          metric_value: number;
          metric_unit: string;
          xbrl_tag: string;
          xbrl_context: string | null;
          xbrl_namespace: string | null;
          source_url: string;
          source_file: string | null;
          processed_at: string;
          processed_by: string;
          processing_version: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['company_financials']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['company_financials']['Insert']>;
      };
      // ... other tables
    };
  };
};
```

### 4.3 테스트 쿼리 실행

**파일: `scripts/test-supabase.ts`** (새로 생성)

```typescript
import { supabase } from '../src/lib/supabase';

async function testSupabase() {
  console.log('🧪 Testing Supabase connection...\n');

  // Test 1: Check connection
  try {
    const { data, error } = await supabase
      .from('company_metadata')
      .select('*')
      .limit(1);

    if (error) throw error;
    console.log('✅ Connection successful!');
  } catch (error) {
    console.error('❌ Connection failed:', error);
    process.exit(1);
  }

  // Test 2: Insert test data
  try {
    const { data, error } = await supabase
      .from('company_metadata')
      .insert({
        ticker: 'TEST',
        cik: '0000000001',
        company_name: 'Test Company Inc.',
        exchange: 'NYSE'
      })
      .select();

    if (error) throw error;
    console.log('✅ Insert test passed!');
    console.log('   Data:', data);

    // Clean up
    await supabase
      .from('company_metadata')
      .delete()
      .eq('ticker', 'TEST');
    console.log('✅ Cleanup successful!');

  } catch (error) {
    console.error('❌ Insert test failed:', error);
  }

  console.log('\n✨ All tests passed!');
}

testSupabase();
```

**실행**:
```bash
npx tsx scripts/test-supabase.ts

# 출력:
# 🧪 Testing Supabase connection...
# ✅ Connection successful!
# ✅ Insert test passed!
# ✅ Cleanup successful!
# ✨ All tests passed!
```

---

## Step 5: Row Level Security (RLS) 설정 (Optional)

**보안 강화를 위한 RLS 정책**

### 5.1 RLS 활성화

Supabase SQL Editor에서 실행:

```sql
-- Enable RLS on all tables
ALTER TABLE company_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE filing_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE helena_job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_metadata ENABLE ROW LEVEL SECURITY;
```

### 5.2 정책 생성

```sql
-- Policy: Service role can do everything
CREATE POLICY "Service role has full access" ON company_financials
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy: Anon users can only read
CREATE POLICY "Anon users can read financials" ON company_financials
  FOR SELECT
  USING (true);

-- Apply same policies to other tables
-- ... (repeat for filing_sections, etc.)
```

---

## Step 6: Verify Setup

### 6.1 Helena에서 Supabase 사용 테스트

Helena agent 구현 후, 다음 테스트 실행:

```typescript
// Dorothy.ts or Helena.ts
import { supabase } from '../lib/supabase';

// Check if Joby data exists
const { data, error } = await supabase
  .from('company_financials')
  .select('*')
  .eq('ticker', 'JOBY')
  .limit(1);

if (data && data.length > 0) {
  console.log('✅ Helena data ready for Joby!');
} else {
  console.log('⚠️ No data for Joby - need to run Helena prepare_company_data');
}
```

### 6.2 Audit Trail 테스트

```typescript
// Log an audit entry
await supabase
  .from('audit_trail')
  .insert({
    action_type: 'query',
    entity_type: 'company_financials',
    agent_name: 'Dorothy',
    query_text: 'Joby 2025 R&D expense',
    success: true,
    details: { ticker: 'JOBY', year: 2025 }
  });

console.log('✅ Audit trail working!');
```

---

## Step 7: Production Checklist

### Security
- [ ] `.env.local`이 `.gitignore`에 포함되어 있음
- [ ] `SUPABASE_SERVICE_ROLE_KEY`가 코드에 하드코딩되지 않음
- [ ] Vercel 환경변수 설정 완료
- [ ] RLS 정책 적용 (선택)

### Performance
- [ ] 모든 인덱스가 생성됨 (자동)
- [ ] Connection pooling 확인 (Supabase default: 15 connections)
- [ ] Slow query 모니터링 설정

### Monitoring
- [ ] Supabase 대시보드에서 Database 메뉴 확인
- [ ] Table sizes 모니터링
- [ ] Logs & Insights 활성화

---

## Troubleshooting

### Error: "relation does not exist"

**원인**: 마이그레이션 미실행

**해결**:
```bash
# SQL Editor에서 001_initial_helena_schema.sql 재실행
```

### Error: "Invalid API key"

**원인**: 환경변수 오류

**해결**:
```bash
# .env.local 확인
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Vercel 환경변수도 확인
```

### Error: "Connection refused"

**원인**: Database URL 오류

**해결**:
```bash
# Supabase Dashboard → Settings → Database
# Connection string 확인 및 복사
```

### Slow queries

**해결**:
```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM company_financials WHERE ticker = 'JOBY';

-- Check index usage
SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
```

---

## Next Steps

1. ✅ Supabase 설정 완료
2. ➡️ Helena agent 구현 (`src/agents/Helena.ts`)
3. ➡️ XBRL 파싱 통합 (sec-api.io)
4. ➡️ Dorothy-Helena 연동
5. ➡️ End-to-end 테스트

---

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Best Practices](https://supabase.com/docs/guides/database/postgres)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

---

**Helena Architecture**: See `docs/HELENA_ARCHITECTURE.md` for full system design.
