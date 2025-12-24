-- Add SEC-specific tables to Dorothy's schema

-- SEC Filings storage
CREATE TABLE IF NOT EXISTS dorothy_finance.sec_filings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES shared.companies(id),
    cik VARCHAR(10) NOT NULL,
    filing_type VARCHAR(10) NOT NULL, -- 10-K, 10-Q, 8-K, etc.
    filing_date DATE NOT NULL,
    report_date DATE NOT NULL,
    accession_number VARCHAR(20) NOT NULL UNIQUE,
    file_url VARCHAR(500),
    raw_content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Parsed financial data from SEC filings
CREATE TABLE IF NOT EXISTS dorothy_finance.sec_financial_data (
    id SERIAL PRIMARY KEY,
    filing_id INTEGER REFERENCES dorothy_finance.sec_filings(id),
    statement_type VARCHAR(50) NOT NULL, -- balance_sheet, income_statement, cash_flow
    period_end DATE NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sec_filings_company ON dorothy_finance.sec_filings(company_id);
CREATE INDEX IF NOT EXISTS idx_sec_filings_cik ON dorothy_finance.sec_filings(cik);
CREATE INDEX IF NOT EXISTS idx_sec_filings_type ON dorothy_finance.sec_filings(filing_type);
CREATE INDEX IF NOT EXISTS idx_sec_filings_date ON dorothy_finance.sec_filings(filing_date DESC);
CREATE INDEX IF NOT EXISTS idx_sec_financial_data_filing ON dorothy_finance.sec_financial_data(filing_id);
CREATE INDEX IF NOT EXISTS idx_sec_financial_data_type ON dorothy_finance.sec_financial_data(statement_type);
CREATE INDEX IF NOT EXISTS idx_sec_financial_data_period ON dorothy_finance.sec_financial_data(period_end DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_sec_filings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sec_filings_updated_at
BEFORE UPDATE ON dorothy_finance.sec_filings
FOR EACH ROW EXECUTE FUNCTION update_sec_filings_updated_at();
