#!/usr/bin/env tsx
/**
 * Check which XBRL tags Apple uses and when
 */

import { config } from 'dotenv';
config();

const { supabase } = await import('../src/lib/supabase.js');

async function checkXBRLTags() {
  console.log('🔍 Checking XBRL tag usage for AAPL...\n');

  const { data, error } = await supabase
    .from('company_financials')
    .select('xbrl_tag, fiscal_year, metric_name')
    .eq('ticker', 'AAPL')
    .order('fiscal_year', { ascending: true });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Total metrics in DB: ${data.length}\n`);

  // Group by XBRL tag
  const byTag: Record<string, number[]> = {};

  for (const row of data) {
    const tag = row.xbrl_tag || 'unknown';
    if (!byTag[tag]) {
      byTag[tag] = [];
    }
    if (row.fiscal_year && !byTag[tag].includes(row.fiscal_year)) {
      byTag[tag].push(row.fiscal_year);
    }
  }

  console.log('📋 XBRL Tags and Their Year Ranges:\n');

  for (const [tag, years] of Object.entries(byTag)) {
    years.sort((a, b) => a - b);
    const earliest = years[0];
    const latest = years[years.length - 1];
    const range = latest - earliest + 1;

    console.log(`${tag}`);
    console.log(`  Years: ${earliest} - ${latest} (${range} years, ${years.length} unique)`);
    console.log(`  Detail: ${years.join(', ')}\n`);
  }
}

checkXBRLTags().catch(console.error);
