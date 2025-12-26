-- ============================================
-- Filing Cache Migration
-- Goldman Sachs-grade caching for SEC filings
-- ============================================

-- Filing cache table (1 hour TTL)
CREATE TABLE IF NOT EXISTS filing_cache (
  id BIGSERIAL PRIMARY KEY,
  sha256_hash TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  content_type VARCHAR(50) DEFAULT 'markdown',
  content_length INTEGER NOT NULL,
  ticker VARCHAR(10),
  filing_type VARCHAR(10),
  filing_date DATE,
  accession_number VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INTEGER DEFAULT 1,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
  metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_filing_cache_hash ON filing_cache(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_filing_cache_ticker ON filing_cache(ticker);
CREATE INDEX IF NOT EXISTS idx_filing_cache_expires ON filing_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_filing_cache_accessed ON filing_cache(last_accessed);

-- Auto-cleanup expired cache entries (runs every hour)
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM filing_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE filing_cache IS 'Caches SEC filing content with 1-hour TTL to avoid repeated downloads';
COMMENT ON COLUMN filing_cache.sha256_hash IS 'Content hash for deduplication';
COMMENT ON COLUMN filing_cache.expires_at IS 'Auto-expiry timestamp (1 hour default)';
COMMENT ON COLUMN filing_cache.access_count IS 'Number of times this cached content was accessed';
