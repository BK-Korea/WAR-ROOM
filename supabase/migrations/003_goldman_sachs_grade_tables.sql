-- =====================================================
-- Goldman Sachs-Grade Tables: Ownership, Insider Trading, Capital Raises, Institutional Holdings
-- =====================================================
-- This migration adds comprehensive tables for non-financial SEC filings
-- to enable Wall Street-grade analysis of ownership structure, insider sentiment,
-- dilution events, and institutional investor activity.

-- =====================================================
-- 1. Ownership Changes (13D, 13G, SC 13D, SC 13G)
-- =====================================================
-- Tracks beneficial ownership changes (5%+ stakes)
-- Critical for: Hostile takeover detection, strategic investor tracking, control premium analysis

CREATE TABLE IF NOT EXISTS ownership_changes (
  id BIGSERIAL PRIMARY KEY,

  -- Company identification
  ticker TEXT NOT NULL,
  cik TEXT NOT NULL,
  company_name TEXT,

  -- Filing metadata
  filing_type TEXT NOT NULL,  -- '13D', '13G', 'SC 13D', 'SC 13G'
  filing_date DATE NOT NULL,
  accession_number TEXT NOT NULL UNIQUE,

  -- Reporting person (beneficial owner)
  reporter_name TEXT NOT NULL,
  reporter_cik TEXT,
  reporter_type TEXT,  -- 'Individual', 'Institution', 'Corporate', 'Group'

  -- Ownership details
  shares_owned BIGINT,
  ownership_percent NUMERIC(8,4),  -- Up to 9999.9999%

  -- Intent and control
  purpose TEXT,  -- 'Investment', 'Acquisition', 'Strategic', 'Passive'
  has_control_intent BOOLEAN DEFAULT false,  -- SC 13D indicator
  voting_rights TEXT,  -- 'Sole', 'Shared', 'None'

  -- Transaction details
  acquisition_date DATE,
  price_per_share NUMERIC(12,4),

  -- Source
  source_url TEXT,
  raw_text TEXT,  -- Full filing text for LLM analysis

  -- Metadata
  processed_by TEXT DEFAULT 'Helena',
  processing_version TEXT DEFAULT '1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX idx_ownership_ticker ON ownership_changes(ticker);
CREATE INDEX idx_ownership_filing_date ON ownership_changes(filing_date DESC);
CREATE INDEX idx_ownership_reporter ON ownership_changes(reporter_name);
CREATE INDEX idx_ownership_type ON ownership_changes(filing_type);

-- =====================================================
-- 2. Insider Transactions (Form 3, 4, 5)
-- =====================================================
-- Tracks director/officer trades
-- Critical for: Insider sentiment analysis, front-running detection, corporate event prediction

CREATE TABLE IF NOT EXISTS insider_transactions (
  id BIGSERIAL PRIMARY KEY,

  -- Company identification
  ticker TEXT NOT NULL,
  cik TEXT NOT NULL,
  company_name TEXT,

  -- Filing metadata
  filing_type TEXT NOT NULL,  -- '3', '4', '5'
  filing_date DATE NOT NULL,
  accession_number TEXT NOT NULL UNIQUE,

  -- Insider (reporting person)
  reporter_name TEXT NOT NULL,
  reporter_cik TEXT,
  position TEXT,  -- 'CEO', 'CFO', 'Director', 'Chief Technology Officer', etc.
  is_director BOOLEAN DEFAULT false,
  is_officer BOOLEAN DEFAULT false,
  is_ten_percent_owner BOOLEAN DEFAULT false,

  -- Transaction details
  transaction_date DATE NOT NULL,
  transaction_type TEXT,  -- 'P' (Purchase), 'S' (Sale), 'A' (Award), 'M' (Option Exercise), 'G' (Gift)
  transaction_code TEXT,  -- Full SEC code (P, S, A, M, G, D, F, etc.)

  -- Shares and pricing
  shares_traded BIGINT,
  price_per_share NUMERIC(12,4),
  total_value NUMERIC(18,2),  -- shares_traded * price_per_share

  -- Holdings after transaction
  shares_owned_after BIGINT,
  ownership_percent_after NUMERIC(8,4),

  -- Transaction nature
  is_derivative BOOLEAN DEFAULT false,  -- Stock options, warrants, etc.
  derivative_type TEXT,  -- 'Stock Option', 'RSU', 'Warrant', etc.

  -- Source
  source_url TEXT,
  raw_text TEXT,

  -- Metadata
  processed_by TEXT DEFAULT 'Helena',
  processing_version TEXT DEFAULT '1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_insider_ticker ON insider_transactions(ticker);
CREATE INDEX idx_insider_transaction_date ON insider_transactions(transaction_date DESC);
CREATE INDEX idx_insider_reporter ON insider_transactions(reporter_name);
CREATE INDEX idx_insider_type ON insider_transactions(transaction_type);
CREATE INDEX idx_insider_position ON insider_transactions(position);

-- =====================================================
-- 3. Capital Raises (S-1, S-3, 424B series)
-- =====================================================
-- Tracks equity offerings and dilution events
-- Critical for: Dilution analysis, runway calculation, valuation pressure assessment

CREATE TABLE IF NOT EXISTS capital_raises (
  id BIGSERIAL PRIMARY KEY,

  -- Company identification
  ticker TEXT NOT NULL,
  cik TEXT NOT NULL,
  company_name TEXT,

  -- Filing metadata
  filing_type TEXT NOT NULL,  -- 'S-1', 'S-3', '424B1', '424B3', '424B5', etc.
  filing_date DATE NOT NULL,
  accession_number TEXT NOT NULL UNIQUE,

  -- Offering details
  offering_type TEXT,  -- 'IPO', 'Follow-on', 'PIPE', 'At-the-market', 'Rights Offering'
  offering_status TEXT,  -- 'Registered', 'Effective', 'Completed', 'Withdrawn'

  -- Share structure
  shares_offered BIGINT,
  shares_outstanding_before BIGINT,
  shares_outstanding_after BIGINT,

  -- Pricing
  price_per_share NUMERIC(12,4),
  price_range_low NUMERIC(12,4),
  price_range_high NUMERIC(12,4),

  -- Proceeds
  gross_proceeds NUMERIC(18,2),
  underwriting_discount NUMERIC(18,2),
  net_proceeds NUMERIC(18,2),

  -- Dilution
  dilution_percent NUMERIC(8,4),  -- (new shares / old shares) * 100

  -- Use of proceeds
  use_of_proceeds TEXT,  -- Free text: 'R&D', 'Working capital', 'Debt repayment', etc.

  -- Underwriters/Placement agents
  lead_underwriter TEXT,
  all_underwriters TEXT[],  -- Array of underwriter names

  -- Over-allotment (greenshoe)
  has_greenshoe BOOLEAN DEFAULT false,
  greenshoe_shares BIGINT,

  -- Source
  source_url TEXT,
  raw_text TEXT,

  -- Metadata
  processed_by TEXT DEFAULT 'Helena',
  processing_version TEXT DEFAULT '1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_capital_ticker ON capital_raises(ticker);
CREATE INDEX idx_capital_filing_date ON capital_raises(filing_date DESC);
CREATE INDEX idx_capital_type ON capital_raises(offering_type);
CREATE INDEX idx_capital_status ON capital_raises(offering_status);

-- =====================================================
-- 4. Institutional Holdings (13F)
-- =====================================================
-- Tracks hedge fund and institutional investor positions
-- Critical for: Smart money tracking, crowding analysis, sentiment shifts

CREATE TABLE IF NOT EXISTS institutional_holdings (
  id BIGSERIAL PRIMARY KEY,

  -- Reporting institution
  institution_name TEXT NOT NULL,
  institution_cik TEXT NOT NULL,

  -- Holding details
  ticker TEXT NOT NULL,
  cusip TEXT,  -- 9-character security identifier
  company_name TEXT,

  -- Period
  quarter_end DATE NOT NULL,
  filing_date DATE NOT NULL,

  -- Position
  shares_held BIGINT NOT NULL,
  market_value BIGINT,  -- In dollars

  -- Portfolio context
  percent_of_portfolio NUMERIC(8,4),  -- % of institution's total AUM

  -- Changes from prior quarter
  shares_change BIGINT,  -- Positive = added, Negative = reduced
  shares_change_percent NUMERIC(8,4),
  is_new_position BOOLEAN DEFAULT false,
  is_sold_out BOOLEAN DEFAULT false,

  -- Investment type
  investment_discretion TEXT,  -- 'Sole', 'Shared', 'None'
  voting_authority_sole BIGINT,
  voting_authority_shared BIGINT,
  voting_authority_none BIGINT,

  -- Source
  accession_number TEXT NOT NULL,
  source_url TEXT,

  -- Metadata
  processed_by TEXT DEFAULT 'Helena',
  processing_version TEXT DEFAULT '1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicates: same institution + ticker + quarter
  UNIQUE(institution_cik, ticker, quarter_end)
);

-- Indexes
CREATE INDEX idx_institutional_ticker ON institutional_holdings(ticker);
CREATE INDEX idx_institutional_quarter ON institutional_holdings(quarter_end DESC);
CREATE INDEX idx_institutional_name ON institutional_holdings(institution_name);
CREATE INDEX idx_institutional_change ON institutional_holdings(shares_change_percent);

-- =====================================================
-- 5. Proxy Statements (DEF 14A, DEFA14A)
-- =====================================================
-- Tracks executive compensation, board composition, shareholder proposals
-- Critical for: Governance analysis, management incentive alignment, activist campaigns

CREATE TABLE IF NOT EXISTS proxy_statements (
  id BIGSERIAL PRIMARY KEY,

  -- Company identification
  ticker TEXT NOT NULL,
  cik TEXT NOT NULL,
  company_name TEXT,

  -- Filing metadata
  filing_type TEXT NOT NULL,  -- 'DEF 14A', 'DEFA14A'
  filing_date DATE NOT NULL,
  accession_number TEXT NOT NULL UNIQUE,

  -- Meeting details
  meeting_date DATE,
  meeting_type TEXT,  -- 'Annual', 'Special'
  record_date DATE,

  -- Executive compensation (top 5 executives)
  executive_comp JSONB,  -- Structured data: [{name, position, salary, bonus, stock_awards, options, total}, ...]
  ceo_total_comp NUMERIC(18,2),
  ceo_pay_ratio NUMERIC(10,2),  -- CEO pay / median employee pay

  -- Board composition
  board_size INTEGER,
  independent_directors INTEGER,
  board_diversity JSONB,  -- {gender: {male: X, female: Y}, ethnicity: {...}}

  -- Shareholder proposals
  proposals JSONB,  -- [{id, type, description, board_recommendation, vote_result}, ...]

  -- Say-on-pay vote
  say_on_pay_support_percent NUMERIC(8,4),
  say_on_pay_passed BOOLEAN,

  -- Source
  source_url TEXT,
  raw_text TEXT,

  -- Metadata
  processed_by TEXT DEFAULT 'Helena',
  processing_version TEXT DEFAULT '1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_proxy_ticker ON proxy_statements(ticker);
CREATE INDEX idx_proxy_filing_date ON proxy_statements(filing_date DESC);
CREATE INDEX idx_proxy_meeting_date ON proxy_statements(meeting_date DESC);

-- =====================================================
-- 6. Material Events (8-K)
-- =====================================================
-- Consolidated table for all 8-K events
-- Critical for: Real-time event monitoring, event-driven trading, risk alerts

CREATE TABLE IF NOT EXISTS material_events (
  id BIGSERIAL PRIMARY KEY,

  -- Company identification
  ticker TEXT NOT NULL,
  cik TEXT NOT NULL,
  company_name TEXT,

  -- Filing metadata
  filing_date DATE NOT NULL,
  report_date DATE,  -- Event occurrence date (can differ from filing)
  accession_number TEXT NOT NULL UNIQUE,

  -- Event classification (8-K Item numbers)
  event_items TEXT[],  -- ['1.01', '5.02', '8.01'] - SEC item codes
  event_types TEXT[],  -- Human-readable: ['Material Agreement', 'CEO Departure', 'Press Release']

  -- Event severity
  severity TEXT,  -- 'Critical', 'High', 'Medium', 'Low' (LLM-classified)

  -- Structured data extraction (LLM-parsed)
  event_summary TEXT,
  key_details JSONB,  -- Varies by event type

  -- Financial impact (if disclosed)
  financial_impact NUMERIC(18,2),
  impact_currency TEXT DEFAULT 'USD',

  -- Related parties
  counterparties TEXT[],  -- Other companies/entities involved

  -- Source
  source_url TEXT,
  raw_text TEXT,

  -- Metadata
  processed_by TEXT DEFAULT 'Helena',
  processing_version TEXT DEFAULT '1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_events_ticker ON material_events(ticker);
CREATE INDEX idx_events_filing_date ON material_events(filing_date DESC);
CREATE INDEX idx_events_report_date ON material_events(report_date DESC);
CREATE INDEX idx_events_severity ON material_events(severity);
CREATE INDEX idx_events_items ON material_events USING GIN(event_items);

-- =====================================================
-- Update company_metadata to track new filing types
-- =====================================================
-- Add columns to track coverage of non-financial filings

ALTER TABLE company_metadata
ADD COLUMN IF NOT EXISTS ownership_filings_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS insider_filings_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS capital_raise_filings_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS institutional_filings_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS proxy_filings_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS event_filings_count INTEGER DEFAULT 0;

-- =====================================================
-- Row-level security (RLS) policies
-- =====================================================
-- Enable RLS on all new tables (for multi-tenant security if needed)

ALTER TABLE ownership_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE insider_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_raises ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutional_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_events ENABLE ROW LEVEL SECURITY;

-- Default policy: Allow all operations (adjust for production multi-tenancy)
CREATE POLICY "Allow all operations" ON ownership_changes FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON insider_transactions FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON capital_raises FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON institutional_holdings FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON proxy_statements FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON material_events FOR ALL USING (true);

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE ownership_changes IS 'SEC Forms 13D/13G: Beneficial ownership of 5%+ stakes. Critical for M&A and control analysis.';
COMMENT ON TABLE insider_transactions IS 'SEC Forms 3/4/5: Director and officer trades. Insider sentiment indicator.';
COMMENT ON TABLE capital_raises IS 'SEC Forms S-1/S-3/424B: Equity offerings. Dilution and runway analysis.';
COMMENT ON TABLE institutional_holdings IS 'SEC Form 13F: Quarterly institutional investor positions. Smart money tracking.';
COMMENT ON TABLE proxy_statements IS 'SEC Form DEF 14A: Executive comp and governance. Alignment and activism analysis.';
COMMENT ON TABLE material_events IS 'SEC Form 8-K: Material corporate events. Real-time risk monitoring.';
