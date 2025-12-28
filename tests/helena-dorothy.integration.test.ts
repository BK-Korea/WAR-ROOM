/**
 * Integration Test: Helena → Dorothy Data Flow
 *
 * Tests the complete workflow:
 * 1. Helena fetches and stores SEC data
 * 2. Dorothy retrieves and analyzes the data
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { supabase } from '../src/lib/supabase';
import { Helena } from '../src/agents/Helena';
import { Dorothy } from '../src/agents/Dorothy';

describe('Helena → Dorothy Integration', () => {
  const TEST_TICKER = 'AAPL';
  const TEST_YEAR = 2024;

  beforeAll(async () => {
    // Clean up test data before running tests
    console.log('\n🧹 Cleaning up test data...');

    await supabase
      .from('company_financials')
      .delete()
      .eq('ticker', TEST_TICKER);

    await supabase
      .from('company_metadata')
      .delete()
      .eq('ticker', TEST_TICKER);

    console.log('✅ Test data cleaned');
  });

  it('Helena should fetch and store SEC data successfully', async () => {
    console.log('\n📊 Testing Helena data preparation...');

    const helena = new Helena();

    // Mock progress callback
    const progressLogs: string[] = [];
    const progress = (msg: string) => progressLogs.push(msg);

    // Execute Helena task
    const result = await helena.executeTask(
      'prepare_company_data',
      {
        message: `${TEST_TICKER} 데이터 준비해줘`,
        ticker: TEST_TICKER,
        years: 3,
        filingTypes: ['10-K', '10-Q']
      },
      progress
    );

    // Verify result
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.ticker).toBe(TEST_TICKER);
    expect(result.data?.metricsExtracted).toBeGreaterThan(0);

    console.log(`✅ Helena extracted ${result.data?.metricsExtracted} metrics`);

    // Verify data in company_financials
    const { count: financialsCount } = await supabase
      .from('company_financials')
      .select('*', { count: 'exact', head: true })
      .eq('ticker', TEST_TICKER);

    expect(financialsCount).toBeGreaterThan(0);
    console.log(`✅ company_financials has ${financialsCount} rows`);

    // Verify data in company_metadata
    const { data: metadata } = await supabase
      .from('company_metadata')
      .select('*')
      .eq('ticker', TEST_TICKER)
      .single();

    expect(metadata).toBeDefined();
    expect(metadata?.metrics_count).toBeGreaterThan(0);
    console.log(`✅ company_metadata updated: ${metadata?.metrics_count} metrics`);

  }, 60000); // 60 second timeout for SEC API calls

  it('Dorothy should find and analyze the data', async () => {
    console.log('\n💼 Testing Dorothy data retrieval...');

    const dorothy = new Dorothy();

    // Mock progress callback
    const progressLogs: string[] = [];
    const progress = (msg: string) => progressLogs.push(msg);

    // Execute Dorothy task
    const result = await dorothy.executeTask(
      'answer_question',
      {
        message: `${TEST_YEAR}년 ${TEST_TICKER} 재무 분석해줘`,
        conversationHistory: []
      },
      progress
    );

    // Verify result
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const response = result.data;

    // Response should contain financial analysis
    expect(response).toBeTruthy();
    expect(typeof response === 'string' || typeof response === 'object').toBe(true);

    console.log(`✅ Dorothy response length: ${JSON.stringify(response).length} chars`);

    // Should NOT contain error messages
    const responseStr = JSON.stringify(response);
    expect(responseStr).not.toContain('Helena DB에');
    expect(responseStr).not.toContain('데이터가 없어');
    expect(responseStr).not.toContain('@Helena');

    console.log('✅ Dorothy successfully analyzed data (no error messages)');

  }, 30000); // 30 second timeout

  it('Helena re-run should be idempotent (no duplicates)', async () => {
    console.log('\n🔄 Testing Helena idempotency...');

    // Get initial count
    const { count: initialCount } = await supabase
      .from('company_financials')
      .select('*', { count: 'exact', head: true })
      .eq('ticker', TEST_TICKER);

    console.log(`Initial count: ${initialCount}`);

    // Run Helena again (without forceRefresh)
    const helena = new Helena();
    const progress = (msg: string) => {};

    const result = await helena.executeTask(
      'prepare_company_data',
      {
        message: `${TEST_TICKER} 데이터 준비해줘`,
        ticker: TEST_TICKER,
        years: 3,
        filingTypes: ['10-K', '10-Q'],
        forceRefresh: false
      },
      progress
    );

    expect(result.success).toBe(true);

    // Get final count
    const { count: finalCount } = await supabase
      .from('company_financials')
      .select('*', { count: 'exact', head: true })
      .eq('ticker', TEST_TICKER);

    console.log(`Final count: ${finalCount}`);

    // Should be same (idempotent)
    expect(finalCount).toBe(initialCount);
    console.log('✅ No duplicates created (idempotent)');

  }, 60000);

  it('Data should have correct structure', async () => {
    console.log('\n🔍 Testing data structure...');

    // Sample a few metrics
    const { data: samples } = await supabase
      .from('company_financials')
      .select('*')
      .eq('ticker', TEST_TICKER)
      .limit(5);

    expect(samples).toBeDefined();
    expect(samples!.length).toBeGreaterThan(0);

    // Check required fields
    const sample = samples![0];
    expect(sample.ticker).toBe(TEST_TICKER);
    expect(sample.cik).toBeDefined();
    expect(sample.company_name).toBeDefined();
    expect(sample.filing_accession).toBeDefined();
    expect(sample.xbrl_tag).toBeDefined();
    expect(sample.metric_name).toBeDefined();
    expect(sample.metric_value).toBeDefined();
    expect(sample.fiscal_year).toBeDefined();

    console.log(`✅ Sample metric: ${sample.metric_name} = ${sample.metric_value}`);

    // Check for UNIQUE constraint compliance (no duplicates)
    const { data: duplicateCheck } = await supabase
      .from('company_financials')
      .select('filing_accession, xbrl_tag, xbrl_context')
      .eq('ticker', TEST_TICKER);

    const uniqueKeys = new Set(
      duplicateCheck!.map(row => `${row.filing_accession}-${row.xbrl_tag}-${row.xbrl_context}`)
    );

    expect(uniqueKeys.size).toBe(duplicateCheck!.length);
    console.log('✅ No duplicate keys (UNIQUE constraint satisfied)');
  });
});
