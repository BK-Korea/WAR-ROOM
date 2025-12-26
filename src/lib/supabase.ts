/**
 * Supabase Client Configuration
 *
 * Goldman Sachs-grade database infrastructure for Helena agent
 * - Service role client: Full access for Helena & Dorothy
 * - Public client: Limited access for frontend
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =====================================================
// Environment Variables Check
// =====================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// =====================================================
// Supabase Clients
// =====================================================

let supabaseServiceClient: SupabaseClient | null = null;
let supabasePublicClient: SupabaseClient | null = null;

/**
 * Service Role Client (Full Access)
 * - Used by Helena, Dorothy, and other agents
 * - Bypasses Row Level Security (RLS)
 * - ⚠️ NEVER expose to frontend
 */
export function getSupabaseServiceClient(): SupabaseClient {
  if (supabaseServiceClient) {
    return supabaseServiceClient;
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️ Supabase service credentials not configured - using fallback mode');
    console.warn('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');

    // Return a dummy client that won't actually connect
    // This allows the app to run without Supabase during development
    return {
      from: () => ({
        select: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }),
        insert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        update: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        delete: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      })
    } as any;
  }

  supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  });

  console.log('✅ Supabase service client initialized');
  return supabaseServiceClient;
}

/**
 * Public Client (Limited Access)
 * - Used by frontend
 * - Respects Row Level Security (RLS)
 * - Safe to use in browser
 */
export function getSupabasePublicClient(): SupabaseClient {
  if (supabasePublicClient) {
    return supabasePublicClient;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase public credentials not configured');
    return {
      from: () => ({
        select: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }),
      })
    } as any;
  }

  supabasePublicClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  });

  console.log('✅ Supabase public client initialized');
  return supabasePublicClient;
}

// Default export: Service client (for Helena/Dorothy)
export const supabase = getSupabaseServiceClient();

// =====================================================
// Database Type Definitions
// =====================================================

export interface CompanyFinancial {
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
}

export interface FilingSection {
  id: number;
  ticker: string;
  cik: string;
  company_name: string;
  filing_type: string;
  filing_date: string;
  filing_accession: string;
  section_type: string;
  section_name: string;
  section_number: number | null;
  full_content: string;
  summary: string | null;
  content_length: number | null;
  content_hash: string | null;
  source_url: string;
  source_file: string | null;
  processed_at: string;
  processed_by: string;
  processing_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditTrail {
  id: number;
  action_type: string;
  entity_type: string;
  entity_id: number | null;
  entity_identifier: string | null;
  agent_name: string;
  user_id: string | null;
  user_session: string | null;
  timestamp: string;
  source_filing: string | null;
  source_url: string | null;
  details: Record<string, any> | null;
  query_text: string | null;
  success: boolean;
  error_message: string | null;
  execution_time_ms: number | null;
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface HelenaJob {
  id: number;
  job_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  ticker: string | null;
  params: Record<string, any>;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  result: Record<string, any> | null;
  metrics_extracted: number | null;
  sections_extracted: number | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyMetadata {
  id: number;
  ticker: string;
  cik: string;
  company_name: string;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  is_active: boolean;
  last_filing_date: string | null;
  last_processed_at: string | null;
  filings_count: number;
  metrics_count: number;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseServiceKey);
}

/**
 * Log an audit trail entry
 */
export async function logAuditTrail(params: {
  action_type: string;
  entity_type: string;
  agent_name: string;
  details?: Record<string, any>;
  query_text?: string;
  success?: boolean;
  error_message?: string;
  execution_time_ms?: number;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.log('[Audit] Supabase not configured - skipping audit log');
    return;
  }

  try {
    const { error } = await supabase
      .from('audit_trail')
      .insert({
        ...params,
        timestamp: new Date().toISOString(),
        success: params.success ?? true,
      });

    if (error) {
      console.error('[Audit] Failed to log audit trail:', error);
    }
  } catch (err) {
    console.error('[Audit] Exception while logging:', err);
  }
}

/**
 * Get company metadata by ticker
 */
export async function getCompanyMetadata(ticker: string): Promise<CompanyMetadata | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase
    .from('company_metadata')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .single();

  if (error || !data) {
    return null;
  }

  return data as CompanyMetadata;
}

/**
 * Check if Helena has data ready for a company
 */
export async function checkHelenaDataAvailability(
  ticker: string,
  year?: number
): Promise<{
  available: boolean;
  ticker: string;
  year?: number;
  filings_count: number;
  metrics_count: number;
  last_update: string | null;
}> {
  if (!isSupabaseConfigured()) {
    return {
      available: false,
      ticker,
      year,
      filings_count: 0,
      metrics_count: 0,
      last_update: null
    };
  }

  // Check company_metadata first
  const metadata = await getCompanyMetadata(ticker);

  if (!metadata || metadata.filings_count === 0) {
    return {
      available: false,
      ticker,
      year,
      filings_count: 0,
      metrics_count: 0,
      last_update: null
    };
  }

  // If year specified, check if we have data for that year
  if (year) {
    const { data, error } = await supabase
      .from('company_financials')
      .select('filing_date', { count: 'exact' })
      .eq('ticker', ticker.toUpperCase())
      .eq('fiscal_year', year)
      .limit(1);

    if (error || !data || data.length === 0) {
      return {
        available: false,
        ticker,
        year,
        filings_count: 0,
        metrics_count: 0,
        last_update: metadata.last_processed_at
      };
    }
  }

  return {
    available: true,
    ticker,
    year,
    filings_count: metadata.filings_count,
    metrics_count: metadata.metrics_count,
    last_update: metadata.last_processed_at
  };
}

// =====================================================
// Export for testing
// =====================================================

export const _testing = {
  resetClients: () => {
    supabaseServiceClient = null;
    supabasePublicClient = null;
  }
};
