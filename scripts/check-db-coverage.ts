#!/usr/bin/env tsx
/**
 * Check actual DB coverage for AAPL
 */

import { config } from 'dotenv';
config();

const { supabase } = await import('../src/lib/supabase.js');

async function checkCoverage() {
  console.log('🔍 Checking actual DB coverage for AAPL...\n');

  const { data, error } = await supabase
    .from('company_financials')
    .select('fiscal_year, fiscal_quarter, filing_type, period_end_date, metric_name')
    .eq('ticker', 'AAPL')
    .order('fiscal_year', { ascending: false })
    .order('fiscal_quarter', { ascending: true });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  // Group by year and quarter
  const byYear: Record<number, Set<number | null>> = {};

  for (const row of data) {
    const year = row.fiscal_year;
    if (!byYear[year]) {
      byYear[year] = new Set();
    }
    byYear[year].add(row.fiscal_quarter);
  }

  // Display
  console.log('📊 Fiscal Year Coverage:\n');
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  for (const year of years) {
    const quarters = Array.from(byYear[year]).filter(q => q !== null).sort();
    const fy = byYear[year].has(null) ? '✅' : '❌';
    const q1 = quarters.includes(1) ? '✅' : '❌';
    const q2 = quarters.includes(2) ? '✅' : '❌';
    const q3 = quarters.includes(3) ? '✅' : '❌';
    const q4 = quarters.includes(4) ? '✅' : '❌';

    console.log(`${year}: Q1=${q1} Q2=${q2} Q3=${q3} Q4=${q4} FY=${fy}`);
  }

  console.log(`\n📈 Total unique metrics: ${data.length}`);
  console.log(`📅 Year range: ${Math.min(...years)} - ${Math.max(...years)}`);
}

checkCoverage().catch(console.error);
