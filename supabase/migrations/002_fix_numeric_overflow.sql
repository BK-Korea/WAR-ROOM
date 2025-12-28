-- Fix numeric overflow for large SEC API values

-- Step 1: Drop dependent views
DROP VIEW IF EXISTS latest_financials;
DROP VIEW IF EXISTS latest_filings;

-- Step 2: Alter column type
ALTER TABLE company_financials
  ALTER COLUMN metric_value TYPE NUMERIC(30, 2);

-- Step 3: Recreate views
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
