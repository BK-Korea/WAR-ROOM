-- Add markdown_content column to sec_filings table for Jina AI converted content

ALTER TABLE dorothy_finance.sec_filings
ADD COLUMN IF NOT EXISTS markdown_content TEXT;

-- Add index for faster markdown content queries
CREATE INDEX IF NOT EXISTS idx_sec_filings_markdown
ON dorothy_finance.sec_filings(id)
WHERE markdown_content IS NOT NULL;

-- Add column to track conversion status
ALTER TABLE dorothy_finance.sec_filings
ADD COLUMN IF NOT EXISTS conversion_status VARCHAR(20) DEFAULT 'pending';

-- Possible values: 'pending', 'converted', 'failed'
COMMENT ON COLUMN dorothy_finance.sec_filings.conversion_status IS
'Status of Jina AI markdown conversion: pending, converted, failed';
