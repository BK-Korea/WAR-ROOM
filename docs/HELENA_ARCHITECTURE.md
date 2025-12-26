# Helena - The Librarian Agent

## Overview

**Helena**는 WAR-ROOM의 SEC 데이터 큐레이션 전담 agent로, **골드만삭스급 금융기관의 신뢰도 요구사항**을 충족하기 위해 설계되었습니다.

### 핵심 역할
- ✅ SEC Edgar로부터 **사전에** 데이터 수집 (실시간 부담 제거)
- ✅ **XBRL 파싱**을 통한 100% 정확한 재무 숫자 추출
- ✅ 구조화된 DB 저장으로 **빠른 조회** (0.1초)
- ✅ **Audit Trail** 구축 - 모든 데이터 출처 추적 가능
- ✅ Dorothy 및 다른 agents를 위한 **신뢰할 수 있는 데이터 소스** 제공

### 신뢰도 우선 원칙 (Goldman Sachs Standard)

| 원칙 | 구현 방법 |
|------|----------|
| **할루시네이션 제로** | XBRL 파싱 - LLM 추론 최소화 |
| **데이터 무결성** | Source citation 필수, 검증 가능한 출처 |
| **정확도 100%** | 재무 숫자는 XBRL에서 직접 추출 |
| **추적 가능성** | 모든 데이터 포인트에 filing_accession + section 기록 |
| **감사 가능성** | 완전한 audit trail (누가, 언제, 어디서) |

---

## Architecture

### High-Level Overview

```
┌──────────────────────────────────────────────────────────┐
│                      User Request                         │
│              "Joby 2025 R&D 비용은?"                      │
└────────────────────┬─────────────────────────────────────┘
                     ↓
         ┌───────────────────────┐
         │  Dorothy (Coordinator) │ ← 실시간 응답 (0.1초)
         └───────┬───────────────┘
                 ↓
    ┌────────────┴──────────────┐
    ↓                           ↓
[재무 숫자 질문?]          [정성적 질문?]
    ↓                           ↓
┌──────────────┐          ┌─────────────┐
│  Supabase    │          │  Supabase   │
│  PostgreSQL  │          │  (Sections) │
│  (Financials)│          │  + LLM      │
└──────┬───────┘          └──────┬──────┘
       │                         │
       └──────────┬──────────────┘
                  ↓
            ┌─────────┐
            │   LLM   │ ← 종합, 해석, 컨텍스트
            └────┬────┘
                 ↓
              답변 + Source Citation


[백그라운드: Helena Agent]
┌─────────────────────────────────────────────────┐
│  User: "Helena, Joby 데이터 준비해줘"           │
│         or Cron Job (매일 자동)                  │
└────────────────┬────────────────────────────────┘
                 ↓
    ┌────────────────────────┐
    │  1. SEC Edgar Fetch    │ ← All filings (no timeout)
    └────────┬───────────────┘
             ↓
    ┌────────────────────────┐
    │  2. XBRL Parsing       │ ← 정확한 숫자 추출
    │     (sec-api.io)       │
    └────────┬───────────────┘
             ↓
    ┌────────────────────────┐
    │  3. Section Extraction │ ← MD&A, Risk Factors 등
    │     + LLM Summarization│
    └────────┬───────────────┘
             ↓
    ┌────────────────────────┐
    │  4. Supabase Storage   │ ← company_financials
    │                        │   filing_sections
    │                        │   audit_trail
    └────────────────────────┘
```

---

## Data Layers

### Layer 1: Raw Data Ingestion

**SEC Edgar API**
- Filing types: 10-K, 10-Q, 20-F (재무제표 포함만)
- XBRL files: Financial data in structured XML
- HTML/Text files: Narrative sections (MD&A, Risk Factors)

**Download Strategy**:
```typescript
// Helena task: prepare_company_data
{
  ticker: "JOBY",
  years: 3,              // Last 3 years
  filingTypes: ["10-K", "10-Q", "20-F"],
  includeXBRL: true,     // ✅ CRITICAL for accuracy
  includeText: true      // For MD&A, Risk Factors
}
```

### Layer 2: Processing & Normalization

#### 2A. XBRL Parsing (숫자 데이터)

**XBRL Tags → SQL Table**:
```xml
<!-- SEC XBRL Filing -->
<us-gaap:ResearchAndDevelopmentExpense contextRef="Q3_2025">
  89200000
</us-gaap:ResearchAndDevelopmentExpense>
```

↓ Helena 파싱

```sql
INSERT INTO company_financials (
  ticker, filing_date, period_end_date,
  metric_name, metric_value, xbrl_tag, unit
) VALUES (
  'JOBY', '2025-11-06', '2025-09-30',
  'R&D Expense', 89200000, 'us-gaap:ResearchAndDevelopmentExpense', 'USD'
);
```

**XBRL 파싱 전략**:
- **Option A**: Direct parsing (Python `arelle` library via API endpoint)
- **Option B**: Use sec-api.io (검증된 commercial API) ← **추천**
- **Option C**: Financial Modeling Prep API (무료 tier)

**추천 이유 (sec-api.io)**:
- ✅ 이미 파싱되어 있어 에러 없음
- ✅ 모든 XBRL 태그 표준화
- ✅ API로 바로 사용 가능 (Vercel serverless 호환)
- ✅ 골드만삭스 등 금융권에서도 사용

#### 2B. Text Section Extraction (정성적 데이터)

**Sections to Extract**:
- Item 1: Business Description
- Item 1A: Risk Factors
- Item 7: Management Discussion & Analysis (MD&A)
- Item 8: Financial Statements (보조 노트)

**Processing**:
1. HTML 파싱으로 section 분리
2. 각 section → Markdown 변환
3. LLM 요약 (optional, 검색 개선용)
4. 원본 + 요약 모두 저장

---

## Database Schema (Supabase PostgreSQL)

### Table 1: `company_financials`

**재무 숫자 전용 테이블** (XBRL 파싱 결과)

```sql
CREATE TABLE company_financials (
  id BIGSERIAL PRIMARY KEY,

  -- Company identifiers
  ticker TEXT NOT NULL,
  cik TEXT NOT NULL,
  company_name TEXT NOT NULL,

  -- Filing metadata
  filing_type TEXT NOT NULL,           -- '10-K', '10-Q', '20-F'
  filing_date DATE NOT NULL,           -- Filed date
  filing_accession TEXT NOT NULL,      -- SEC accession number (unique)
  period_end_date DATE NOT NULL,       -- Reporting period end
  fiscal_year INTEGER NOT NULL,
  fiscal_quarter INTEGER,              -- NULL for annual (10-K)

  -- Financial metric
  metric_name TEXT NOT NULL,           -- 'Revenue', 'R&D Expense', 'Net Income'
  metric_value NUMERIC(20, 2) NOT NULL,
  metric_unit TEXT DEFAULT 'USD',      -- 'USD', 'shares', 'percentage'

  -- XBRL traceability (CRITICAL for audit)
  xbrl_tag TEXT NOT NULL,              -- 'us-gaap:ResearchAndDevelopmentExpense'
  xbrl_context TEXT,                   -- Context ref in XBRL

  -- Audit trail
  source_url TEXT NOT NULL,            -- Original SEC filing URL
  processed_at TIMESTAMP DEFAULT NOW(),
  processed_by TEXT DEFAULT 'Helena',

  -- Indexes
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_financials_ticker_date ON company_financials(ticker, filing_date DESC);
CREATE INDEX idx_financials_metric ON company_financials(ticker, metric_name, fiscal_year);
CREATE INDEX idx_financials_accession ON company_financials(filing_accession);
```

**Example Queries**:
```sql
-- Dorothy: "Joby 2025년 R&D 비용은?"
SELECT
  fiscal_quarter,
  period_end_date,
  metric_value,
  filing_accession
FROM company_financials
WHERE ticker = 'JOBY'
  AND metric_name = 'R&D Expense'
  AND fiscal_year = 2025
ORDER BY period_end_date;

-- Result:
-- Q1 2025: $85.3M (0001819848-25-000338)
-- Q2 2025: $93.1M (0001819848-25-000499)
-- Q3 2025: $89.2M (0001819848-25-000596)
```

### Table 2: `filing_sections`

**텍스트 섹션 전용 테이블** (MD&A, Risk Factors 등)

```sql
CREATE TABLE filing_sections (
  id BIGSERIAL PRIMARY KEY,

  -- Company & filing
  ticker TEXT NOT NULL,
  cik TEXT NOT NULL,
  company_name TEXT NOT NULL,
  filing_type TEXT NOT NULL,
  filing_date DATE NOT NULL,
  filing_accession TEXT NOT NULL,

  -- Section metadata
  section_type TEXT NOT NULL,          -- 'Item 1', 'Item 1A', 'Item 7', 'Item 8'
  section_name TEXT NOT NULL,          -- 'Business', 'Risk Factors', 'MD&A'

  -- Content
  full_content TEXT NOT NULL,          -- Original markdown
  summary TEXT,                        -- LLM-generated summary (optional)
  content_hash TEXT,                   -- SHA-256 for deduplication

  -- Vector search (Phase 4)
  embedding vector(1536),              -- OpenAI embedding for semantic search

  -- Audit trail
  source_url TEXT NOT NULL,
  processed_at TIMESTAMP DEFAULT NOW(),
  processed_by TEXT DEFAULT 'Helena',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sections_ticker ON filing_sections(ticker, filing_date DESC);
CREATE INDEX idx_sections_type ON filing_sections(section_type);
CREATE INDEX idx_sections_accession ON filing_sections(filing_accession);

-- Vector search index (Phase 4)
-- CREATE INDEX idx_sections_embedding ON filing_sections USING ivfflat (embedding vector_cosine_ops);
```

### Table 3: `audit_trail`

**모든 데이터 접근 기록** (금융권 필수)

```sql
CREATE TABLE audit_trail (
  id BIGSERIAL PRIMARY KEY,

  -- What
  action_type TEXT NOT NULL,           -- 'data_ingestion', 'query', 'update', 'delete'
  entity_type TEXT NOT NULL,           -- 'company_financials', 'filing_sections'
  entity_id BIGINT,                    -- Related record ID

  -- Who
  agent_name TEXT NOT NULL,            -- 'Helena', 'Dorothy', 'Alice'
  user_id TEXT,                        -- End user (if applicable)

  -- When
  timestamp TIMESTAMP DEFAULT NOW(),

  -- Where
  source_filing TEXT,                  -- Filing accession number
  source_url TEXT,                     -- Original SEC URL

  -- Details
  details JSONB,                       -- Flexible metadata

  -- Result
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT
);

CREATE INDEX idx_audit_timestamp ON audit_trail(timestamp DESC);
CREATE INDEX idx_audit_agent ON audit_trail(agent_name, timestamp DESC);
```

---

## Helena Agent Implementation

### Core Tasks

#### Task 1: `prepare_company_data`

**사전 데이터 수집 및 가공**

```typescript
// User request or Cron Job
await helena.executeTask({
  task: 'prepare_company_data',
  params: {
    ticker: 'JOBY',
    years: 3,                          // Last 3 years
    filingTypes: ['10-K', '10-Q'],
    forceRefresh: false                // Use cached if available
  }
});
```

**Processing Steps**:
1. ✅ Check DB for existing data
2. ✅ Fetch missing filings from SEC Edgar
3. ✅ Download XBRL files
4. ✅ Parse XBRL → Extract all financial metrics
5. ✅ Insert into `company_financials` table
6. ✅ Extract text sections (Item 1, 1A, 7, 8)
7. ✅ Insert into `filing_sections` table
8. ✅ Log to `audit_trail`
9. ✅ Return summary

**Response**:
```typescript
{
  success: true,
  data: {
    company: "Joby Aviation, Inc.",
    ticker: "JOBY",
    cik: "0001819848",
    filingsProcessed: 12,              // 3 years × 4 quarters
    metricsExtracted: 847,             // Total financial data points
    sectionsExtracted: 36,             // 12 filings × 3 sections
    processingTime: "4m 32s",
    readyForQuery: true
  }
}
```

#### Task 2: `refresh_company_data`

**최신 filing 자동 업데이트** (Cron Job용)

```typescript
// Vercel Cron: Daily at 6 AM
// GET /api/cron/refresh-sec-data

await helena.executeTask({
  task: 'refresh_company_data',
  params: {
    tickers: ['JOBY', 'AAPL', 'TSLA'],  // Watchlist
    daysBack: 7                          // Check last 7 days
  }
});
```

#### Task 3: `query_financials`

**Dorothy가 호출하는 SQL 쿼리 헬퍼**

```typescript
// Dorothy internally calls Helena
const result = await helena.executeTask({
  task: 'query_financials',
  params: {
    ticker: 'JOBY',
    metrics: ['R&D Expense', 'Revenue', 'Operating Expense'],
    fiscalYear: 2025,
    quarters: [1, 2, 3]
  }
});

// Returns:
{
  success: true,
  data: {
    metrics: [
      {
        metric: 'R&D Expense',
        Q1: { value: 85300000, source: '10-Q filed 2025-05-08' },
        Q2: { value: 93100000, source: '10-Q filed 2025-08-07' },
        Q3: { value: 89200000, source: '10-Q filed 2025-11-06' }
      },
      // ...
    ],
    sources: [
      { filing: '10-Q', date: '2025-05-08', accession: '0001819848-25-000338', url: '...' },
      // ...
    ]
  }
}
```

---

## Dorothy ↔ Helena Integration

### Current Flow (문제)
```
User → Dorothy → SEC Download (30s) → Truncate (99% loss) → LLM → ❌
```

### New Flow (해결)
```
User → Dorothy → Helena.query_financials (0.1s) → LLM → ✅
```

### Dorothy 수정 사항

**`src/agents/Dorothy.ts` - answerQuestion() method**:

```typescript
async answerQuestion(params: any, context: AgentContext): Promise<TaskResult> {
  const { question } = params;

  // STEP 1: Extract company & year
  const extracted = await this.extractCompanyInfo(question, context);

  // STEP 2: Check if Helena has data ready
  const helenaData = await this.checkHelenaCache(extracted.ticker, extracted.year);

  if (helenaData.available) {
    // ✅ Fast path: Use Helena's preprocessed data
    return await this.answerWithHelenaData(question, helenaData, context);
  } else {
    // ⚠️ Slow path: Fallback to current method
    progress('Helena 데이터 없음 - 실시간 다운로드 중... (느림)');
    return await this.answerWithRealTimeDownload(question, extracted, context);
  }
}

private async checkHelenaCache(ticker: string, year?: number): Promise<any> {
  // Query Supabase: Do we have data for this ticker/year?
  const { data, error } = await supabase
    .from('company_financials')
    .select('filing_date')
    .eq('ticker', ticker)
    .gte('fiscal_year', year || new Date().getFullYear())
    .limit(1);

  return {
    available: data && data.length > 0,
    ticker,
    year
  };
}

private async answerWithHelenaData(
  question: string,
  helenaData: any,
  context: AgentContext
): Promise<TaskResult> {
  progress('Helena DB에서 데이터 조회 중...');

  // Classify question type
  const questionType = await this.classifyQuestion(question);

  if (questionType === 'financial_metrics') {
    // SQL query for exact numbers
    const metrics = await helena.executeTask({
      task: 'query_financials',
      params: {
        ticker: helenaData.ticker,
        question: question,  // Helena will parse and extract metrics
        year: helenaData.year
      }
    });

    // LLM interprets the numbers
    const answer = await this.llm.chat([
      { role: 'system', content: DOROTHY_SYSTEM_PROMPT },
      { role: 'user', content: `
QUESTION: ${question}

FINANCIAL DATA (from SEC XBRL filings):
${JSON.stringify(metrics.data, null, 2)}

⚠️ CRITICAL: These numbers are from verified XBRL data. DO NOT modify them.
Provide analysis and interpretation, and ALWAYS cite the source filing.
` }
    ]);

    return {
      success: true,
      data: {
        answer: answer.content,
        sources: metrics.data.sources,  // Auto-citation
        dataSource: 'Helena (XBRL)',
        confidence: 'HIGH'
      }
    };
  } else {
    // Text-based questions: Vector search or section retrieval
    // ... (Phase 4)
  }
}
```

---

## XBRL Parsing Strategy

### Option A: sec-api.io (추천)

**Pros**:
- ✅ Commercial-grade accuracy
- ✅ API로 바로 사용 (Vercel 호환)
- ✅ All XBRL tags already parsed
- ✅ Support team

**Cons**:
- ❌ 유료 ($99/month for 1000 requests)

**Implementation**:
```typescript
// Helena XBRL parsing
import axios from 'axios';

async function parseXBRL(accessionNumber: string): Promise<FinancialMetrics[]> {
  const response = await axios.get(
    `https://api.sec-api.io/xbrl-to-json`,
    {
      params: {
        accession_no: accessionNumber,
        token: process.env.SEC_API_KEY
      }
    }
  );

  const xbrlData = response.data;
  const metrics: FinancialMetrics[] = [];

  // Extract standard metrics
  const standardTags = [
    'us-gaap:Revenues',
    'us-gaap:ResearchAndDevelopmentExpense',
    'us-gaap:OperatingExpenses',
    'us-gaap:NetIncomeLoss',
    'us-gaap:Assets',
    'us-gaap:Liabilities',
    // ... 100+ tags
  ];

  for (const tag of standardTags) {
    if (xbrlData[tag]) {
      metrics.push({
        metricName: tagToMetricName(tag),
        metricValue: xbrlData[tag].value,
        xbrlTag: tag,
        xbrlContext: xbrlData[tag].context,
        unit: xbrlData[tag].unit || 'USD'
      });
    }
  }

  return metrics;
}
```

### Option B: Financial Modeling Prep (무료 대안)

**Pros**:
- ✅ 무료 tier (250 requests/day)
- ✅ API 간단

**Cons**:
- ❌ Limited to major companies
- ❌ 일부 metrics만 제공

### Option C: Direct Python Parsing (미래 옵션)

**Pros**:
- ✅ 완전 무료
- ✅ 모든 control

**Cons**:
- ❌ Vercel serverless에서 Python 실행 어려움
- ❌ 별도 서버 필요 (Railway, Fly.io)

---

## Deployment & Operations

### Phase 1: Manual Trigger
```typescript
// User explicitly requests
User: "Helena, Joby Aviation 데이터 준비해줘"
Helena: "작업 시작! 예상 5분 소요..."
[Background processing]
Helena: "완료! Joby 데이터 12 filings, 847 metrics 준비됨."
```

### Phase 2: Cron Jobs (Vercel)

**Daily refresh** - 매일 오전 6시
```typescript
// /api/cron/refresh-sec-data
export async function GET(request: Request) {
  // Watchlist tickers
  const watchlist = ['JOBY', 'AAPL', 'TSLA', 'NVDA'];

  for (const ticker of watchlist) {
    await helena.executeTask({
      task: 'refresh_company_data',
      params: { ticker, daysBack: 7 }
    });
  }

  return Response.json({ success: true });
}
```

**vercel.json**:
```json
{
  "crons": [
    {
      "path": "/api/cron/refresh-sec-data",
      "schedule": "0 6 * * *"
    }
  ]
}
```

### Phase 3: Event-Driven (미래)

**SEC Edgar RSS Feed** → Webhook → Helena auto-processes

---

## Success Metrics

### Accuracy
- ✅ Financial numbers: **100% match with SEC XBRL**
- ✅ Source citation: **100% of responses have filing reference**
- ✅ Hallucination rate: **0%** (for financial metrics)

### Performance
- ✅ Dorothy response time: **< 1 second** (with Helena data)
- ✅ Helena preprocessing: **< 5 minutes** per company
- ✅ Database query: **< 100ms**

### Reliability
- ✅ Data freshness: **Within 24 hours** of SEC filing
- ✅ Audit trail: **100% of data access logged**
- ✅ Uptime: **99.9%** (Supabase SLA)

---

## Next Steps

### Phase 1 (Week 1) - Foundation
- [x] Dorothy 200k chars 임시 수정
- [ ] Supabase 계정 생성 및 설정
- [ ] DB 스키마 생성 (3 tables)
- [ ] Helena agent 기본 구조 (`src/agents/Helena.ts`)

### Phase 2 (Week 2) - XBRL Integration
- [ ] sec-api.io 계정 생성
- [ ] XBRL 파싱 구현
- [ ] `prepare_company_data` task 구현
- [ ] DB 저장 로직

### Phase 3 (Week 3) - Dorothy Integration
- [ ] Dorothy `checkHelenaCache()` 구현
- [ ] Dorothy `answerWithHelenaData()` 구현
- [ ] Source citation 자동 생성
- [ ] End-to-end 테스트

### Phase 4 (Week 4) - Advanced Features
- [ ] Vector search (pgvector)
- [ ] Text section summarization
- [ ] Cron jobs 설정
- [ ] Monitoring & alerts

---

## Conclusion

Helena agent는 WAR-ROOM을 **골드만삭스급 금융 분석 플랫폼**으로 업그레이드하는 핵심 인프라입니다.

**핵심 가치**:
1. **신뢰도**: XBRL 파싱으로 할루시네이션 제거
2. **속도**: 사전 처리로 실시간 부담 제거
3. **확장성**: 한 번 처리하면 모든 agent 활용
4. **감사 가능성**: 완전한 audit trail

Master, 이 아키텍처로 진행하면 Joby 같은 쿼리에 **100% 정확한 답변**을 **1초 이내**에 제공할 수 있어!
