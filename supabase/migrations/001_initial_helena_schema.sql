-- =====================================================
-- Helena Agent - Initial Database Schema
-- =====================================================
-- Goldman Sachs-grade financial data infrastructure
-- Created: 2025-12-26
-- Purpose: Store SEC XBRL data with full audit trail
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Table 1: company_financials
-- =====================================================
-- Stores parsed XBRL financial metrics
-- 100% accurate numbers from SEC structured data
-- =====================================================

CREATE TABLE IF NOT EXISTS company_financials (
  id BIGSERIAL PRIMARY KEY,

  -- Company identifiers
  ticker TEXT NOT NULL,
  cik TEXT NOT NULL,
  company_name TEXT NOT NULL,

  -- Filing metadata
  filing_type TEXT NOT NULL,           -- '10-K', '10-Q', '20-F'
  filing_date DATE NOT NULL,           -- Filed date with SEC
  filing_accession TEXT NOT NULL,      -- SEC accession number (unique identifier)
  period_end_date DATE NOT NULL,       -- Reporting period end date
  fiscal_year INTEGER NOT NULL,
  fiscal_quarter INTEGER,              -- NULL for annual reports (10-K)

  -- Financial metric
  metric_name TEXT NOT NULL,           -- Human-readable: 'Revenue', 'R&D Expense', 'Net Income'
  metric_value NUMERIC(20, 2) NOT NULL,
  metric_unit TEXT DEFAULT 'USD',      -- 'USD', 'shares', 'percentage', etc.

  -- XBRL traceability (CRITICAL for audit)
  xbrl_tag TEXT NOT NULL,              -- Full tag: 'us-gaap:ResearchAndDevelopmentExpense'
  xbrl_context TEXT,                   -- XBRL context reference
  xbrl_namespace TEXT,                 -- 'us-gaap', 'ifrs-full', 'dei', etc.

  -- Source traceability
  source_url TEXT NOT NULL,            -- Original SEC filing URL
  source_file TEXT,                    -- XBRL filename (e.g., 'joby-20250930.xml')

  -- Processing metadata
  processed_at TIMESTAMP DEFAULT NOW(),
  processed_by TEXT DEFAULT 'Helena',
  processing_version TEXT,             -- Helena version for reproducibility

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(filing_accession, xbrl_tag, xbrl_context)  -- Prevent duplicates
);

-- Indexes for fast queries
CREATE INDEX idx_financials_ticker_date ON company_financials(ticker, filing_date DESC);
CREATE INDEX idx_financials_metric ON company_financials(ticker, metric_name, fiscal_year);
CREATE INDEX idx_financials_accession ON company_financials(filing_accession);
CREATE INDEX idx_financials_period ON company_financials(period_end_date DESC);
CREATE INDEX idx_financials_xbrl_tag ON company_financials(xbrl_tag);

-- Comments for documentation
COMMENT ON TABLE company_financials IS 'XBRL-parsed financial metrics from SEC filings - 100% accurate';
COMMENT ON COLUMN company_financials.xbrl_tag IS 'Full XBRL tag for traceability and verification';
COMMENT ON COLUMN company_financials.filing_accession IS 'SEC accession number - unique filing identifier';

-- =====================================================
-- Table 2: filing_sections
-- =====================================================
-- Stores narrative sections from SEC filings
-- MD&A, Risk Factors, Business Description, etc.
-- =====================================================

CREATE TABLE IF NOT EXISTS filing_sections (
  id BIGSERIAL PRIMARY KEY,

  -- Company & filing identifiers
  ticker TEXT NOT NULL,
  cik TEXT NOT NULL,
  company_name TEXT NOT NULL,
  filing_type TEXT NOT NULL,
  filing_date DATE NOT NULL,
  filing_accession TEXT NOT NULL,

  -- Section metadata
  section_type TEXT NOT NULL,          -- 'Item 1', 'Item 1A', 'Item 7', 'Item 8', etc.
  section_name TEXT NOT NULL,          -- 'Business', 'Risk Factors', 'MD&A', 'Financial Statements'
  section_number INTEGER,              -- Order in filing

  -- Content
  full_content TEXT NOT NULL,          -- Original markdown/text content
  summary TEXT,                        -- LLM-generated summary (optional)
  content_length INTEGER,              -- Character count
  content_hash TEXT,                   -- SHA-256 hash for deduplication

  -- Vector search support (Phase 4)
  -- Uncomment when pgvector extension is enabled
  -- embedding vector(1536),           -- OpenAI embedding for semantic search

  -- Source traceability
  source_url TEXT NOT NULL,
  source_file TEXT,

  -- Processing metadata
  processed_at TIMESTAMP DEFAULT NOW(),
  processed_by TEXT DEFAULT 'Helena',
  processing_version TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(filing_accession, section_type)  -- One section per type per filing
);

-- Indexes
CREATE INDEX idx_sections_ticker ON filing_sections(ticker, filing_date DESC);
CREATE INDEX idx_sections_type ON filing_sections(section_type);
CREATE INDEX idx_sections_accession ON filing_sections(filing_accession);
CREATE INDEX idx_sections_hash ON filing_sections(content_hash);

-- Vector search index (Phase 4 - uncomment when ready)
-- CREATE INDEX idx_sections_embedding ON filing_sections USING ivfflat (embedding vector_cosine_ops);

-- Comments
COMMENT ON TABLE filing_sections IS 'Narrative sections from SEC filings for qualitative analysis';
COMMENT ON COLUMN filing_sections.content_hash IS 'SHA-256 hash to detect duplicate/unchanged sections';

-- =====================================================
-- Table 3: audit_trail
-- =====================================================
-- Complete audit trail for regulatory compliance
-- Tracks all data access and modifications
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_trail (
  id BIGSERIAL PRIMARY KEY,

  -- What happened
  action_type TEXT NOT NULL,           -- 'data_ingestion', 'query', 'update', 'delete', 'export'
  entity_type TEXT NOT NULL,           -- 'company_financials', 'filing_sections'
  entity_id BIGINT,                    -- Related record ID (if applicable)
  entity_identifier TEXT,              -- Additional identifier (ticker, accession, etc.)

  -- Who performed the action
  agent_name TEXT NOT NULL,            -- 'Helena', 'Dorothy', 'Alice', etc.
  user_id TEXT,                        -- End user identifier (if applicable)
  user_session TEXT,                   -- Session ID for tracking

  -- When it happened
  timestamp TIMESTAMP DEFAULT NOW(),

  -- Where did data come from
  source_filing TEXT,                  -- Filing accession number
  source_url TEXT,                     -- Original SEC URL

  -- Details
  details JSONB,                       -- Flexible metadata (query params, changes, etc.)
  query_text TEXT,                     -- Actual query/question asked

  -- Result
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  execution_time_ms INTEGER,           -- Performance tracking

  -- Request context
  request_id UUID DEFAULT uuid_generate_v4(),
  ip_address TEXT,
  user_agent TEXT
);

-- Indexes for audit queries
CREATE INDEX idx_audit_timestamp ON audit_trail(timestamp DESC);
CREATE INDEX idx_audit_agent ON audit_trail(agent_name, timestamp DESC);
CREATE INDEX idx_audit_action ON audit_trail(action_type, timestamp DESC);
CREATE INDEX idx_audit_entity ON audit_trail(entity_type, entity_id);
CREATE INDEX idx_audit_request ON audit_trail(request_id);
CREATE INDEX idx_audit_user ON audit_trail(user_id, timestamp DESC);

-- Comments
COMMENT ON TABLE audit_trail IS 'Complete audit trail for regulatory compliance and debugging';
COMMENT ON COLUMN audit_trail.details IS 'JSONB field for flexible metadata storage';

-- =====================================================
-- Table 4: helena_job_queue
-- =====================================================
-- Background job queue for async processing
-- =====================================================

CREATE TABLE IF NOT EXISTS helena_job_queue (
  id BIGSERIAL PRIMARY KEY,

  -- Job metadata
  job_type TEXT NOT NULL,              -- 'prepare_company_data', 'refresh_data', etc.
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
  priority INTEGER DEFAULT 0,          -- Higher = more important

  -- Job parameters
  ticker TEXT,
  params JSONB NOT NULL,               -- Flexible job parameters

  -- Execution tracking
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Results
  result JSONB,                        -- Job output
  metrics_extracted INTEGER,           -- Number of financial metrics
  sections_extracted INTEGER,          -- Number of sections

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_job_status ON helena_job_queue(status, priority DESC, created_at);
CREATE INDEX idx_job_ticker ON helena_job_queue(ticker, created_at DESC);

-- Comments
COMMENT ON TABLE helena_job_queue IS 'Background job queue for async SEC data processing';

-- =====================================================
-- Table 5: company_metadata
-- =====================================================
-- Cache for company information
-- =====================================================

CREATE TABLE IF NOT EXISTS company_metadata (
  id BIGSERIAL PRIMARY KEY,

  -- Identifiers
  ticker TEXT UNIQUE NOT NULL,
  cik TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,

  -- Exchange info
  exchange TEXT,                       -- 'NYSE', 'NASDAQ', etc.
  sector TEXT,
  industry TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_filing_date DATE,

  -- Helena tracking
  last_processed_at TIMESTAMP,
  filings_count INTEGER DEFAULT 0,
  metrics_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_company_ticker ON company_metadata(ticker);
CREATE INDEX idx_company_cik ON company_metadata(cik);

-- Comments
COMMENT ON TABLE company_metadata IS 'Company metadata cache for quick lookups';

-- =====================================================
-- Functions & Triggers
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_company_financials_updated_at
  BEFORE UPDATE ON company_financials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_filing_sections_updated_at
  BEFORE UPDATE ON filing_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_helena_job_queue_updated_at
  BEFORE UPDATE ON helena_job_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_metadata_updated_at
  BEFORE UPDATE ON company_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Row Level Security (RLS) - Optional
-- =====================================================
-- Uncomment if you want row-level access control

-- ALTER TABLE company_financials ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE filing_sections ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

-- Example policy: Allow read access to all authenticated users
-- CREATE POLICY "Allow read access to all users" ON company_financials
--   FOR SELECT USING (true);

-- =====================================================
-- Initial Data
-- =====================================================

-- Insert initial job for testing
INSERT INTO helena_job_queue (job_type, ticker, params)
VALUES (
  'prepare_company_data',
  'JOBY',
  '{"ticker": "JOBY", "years": 3, "filingTypes": ["10-K", "10-Q"]}'::jsonb
) ON CONFLICT DO NOTHING;

-- =====================================================
-- Views for Common Queries
-- =====================================================

-- View: Latest financial metrics per company
CREATE OR REPLACE VIEW latest_financials AS
SELECT DISTINCT ON (ticker, metric_name)
  ticker,
  company_name,
  metric_name,
  metric_value,
  metric_unit,
  fiscal_year,
  fiscal_quarter,
  filing_date,
  filing_accession,
  xbrl_tag
FROM company_financials
ORDER BY ticker, metric_name, filing_date DESC;

COMMENT ON VIEW latest_financials IS 'Most recent financial metrics for each company';

-- View: Latest filings per company
CREATE OR REPLACE VIEW latest_filings AS
SELECT DISTINCT ON (ticker, filing_type)
  ticker,
  company_name,
  filing_type,
  filing_date,
  filing_accession,
  period_end_date,
  source_url
FROM company_financials
ORDER BY ticker, filing_type, filing_date DESC;

COMMENT ON VIEW latest_filings IS 'Most recent filings of each type per company';

-- =====================================================
-- Grants (if using service roles)
-- =====================================================

-- Grant access to service role (adjust as needed)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- =====================================================
-- Schema Complete
-- =====================================================

-- Run this to verify setup:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
