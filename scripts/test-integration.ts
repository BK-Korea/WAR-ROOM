#!/usr/bin/env tsx
/**
 * Quick Integration Test Script
 * Tests Helena → Dorothy flow without vitest runner
 */

import { config } from 'dotenv';
config();

import { supabase } from '../src/lib/supabase';
import Helena from '../src/agents/Helena';
import Dorothy from '../src/agents/Dorothy';

const TEST_TICKER = 'AAPL';
const TEST_YEAR = 2024;

async function runIntegrationTest() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🧪 Helena → Dorothy Integration Test');
  console.log('═══════════════════════════════════════════════════\n');

  let success = true;

  try {
    // Step 1: Clean up
    console.log('🧹 Step 1: Cleaning up test data...');
    await supabase.from('company_financials').delete().eq('ticker', TEST_TICKER);
    await supabase.from('company_metadata').delete().eq('ticker', TEST_TICKER);
    console.log('✅ Test data cleaned\n');

    // Step 2: Helena preparation
    console.log('📊 Step 2: Helena - Fetching SEC data...');
    const helena = new Helena();

    const helenaResult = await helena.executeTask(
      'prepare_company_data',
      {
        message: `${TEST_TICKER} 데이터 준비해줘`,
        ticker: TEST_TICKER,
        years: 3,
        filingTypes: ['10-K', '10-Q']
      },
      (msg) => console.log(`   [Helena] ${msg}`)
    );

    if (!helenaResult.success) {
      throw new Error(`Helena failed: ${helenaResult.error}`);
    }

    console.log(`✅ Helena success: ${helenaResult.data?.metricsExtracted} metrics extracted\n`);

    // Step 3: Verify database
    console.log('🔍 Step 3: Verifying database...');

    const { count: financialsCount } = await supabase
      .from('company_financials')
      .select('*', { count: 'exact', head: true })
      .eq('ticker', TEST_TICKER);

    console.log(`   company_financials: ${financialsCount} rows`);

    if (!financialsCount || financialsCount === 0) {
      throw new Error('No data in company_financials!');
    }

    const { data: metadata } = await supabase
      .from('company_metadata')
      .select('*')
      .eq('ticker', TEST_TICKER)
      .single();

    console.log(`   company_metadata: ${metadata?.metrics_count} metrics`);

    if (!metadata) {
      console.warn('⚠️  Warning: company_metadata is empty (but should still work)');
    }

    console.log('✅ Database verified\n');

    // Step 4: Dorothy analysis
    console.log('💼 Step 4: Dorothy - Analyzing data...');
    const dorothy = new Dorothy();

    const dorothyResult = await dorothy.executeTask(
      'answer_question',
      {
        message: `${TEST_YEAR}년 ${TEST_TICKER} 재무 분석해줘`,
        conversationHistory: []
      },
      (msg) => console.log(`   [Dorothy] ${msg}`)
    );

    if (!dorothyResult.success) {
      throw new Error(`Dorothy failed: ${dorothyResult.error}`);
    }

    const response = JSON.stringify(dorothyResult.data);

    // Check for error messages
    if (response.includes('Helena DB에') || response.includes('데이터가 없어')) {
      throw new Error('Dorothy returned error message (data not found)');
    }

    console.log(`✅ Dorothy success: ${response.length} chars response\n`);

    // Step 5: Idempotency test
    console.log('🔄 Step 5: Testing idempotency...');

    const { count: beforeCount } = await supabase
      .from('company_financials')
      .select('*', { count: 'exact', head: true })
      .eq('ticker', TEST_TICKER);

    console.log(`   Before re-run: ${beforeCount} rows`);

    // Re-run Helena without forceRefresh
    await helena.executeTask(
      'prepare_company_data',
      {
        message: `${TEST_TICKER} 데이터 준비해줘`,
        ticker: TEST_TICKER,
        years: 3,
        filingTypes: ['10-K', '10-Q'],
        forceRefresh: false
      },
      () => {}
    );

    const { count: afterCount } = await supabase
      .from('company_financials')
      .select('*', { count: 'exact', head: true })
      .eq('ticker', TEST_TICKER);

    console.log(`   After re-run: ${afterCount} rows`);

    if (beforeCount !== afterCount) {
      throw new Error(`Duplicates created! ${beforeCount} → ${afterCount}`);
    }

    console.log('✅ Idempotent (no duplicates)\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    success = false;
  }

  console.log('═══════════════════════════════════════════════════');
  if (success) {
    console.log('✅ ALL TESTS PASSED');
  } else {
    console.log('❌ TESTS FAILED');
  }
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(success ? 0 : 1);
}

runIntegrationTest();
