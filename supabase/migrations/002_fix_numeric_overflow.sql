-- Fix numeric overflow for large SEC API values
ALTER TABLE company_financials 
  ALTER COLUMN metric_value TYPE NUMERIC(30, 2);
