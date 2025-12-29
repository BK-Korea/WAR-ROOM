#!/usr/bin/env tsx
/**
 * Direct SEC API test - bypass all filtering to see raw data
 */

import axios from 'axios';

const USER_AGENT = 'WAR-ROOM Helena helena@war-room.ai';

async function testSECRawData() {
  console.log('🔍 Testing SEC Company Facts API for AAPL (raw data)...\n');

  const cik = '0000320193';
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    const data = response.data;
    console.log(`✅ Company: ${data.entityName}\n`);

    // Check the specific metric we use
    const metric = data.facts?.['us-gaap']?.['RevenueFromContractWithCustomerExcludingAssessedTax'];

    if (!metric) {
      console.log('❌ RevenueFromContractWithCustomerExcludingAssessedTax not found');
      console.log('\nAvailable revenue metrics:');
      const usGaap = data.facts?.['us-gaap'] || {};
      const revenueKeys = Object.keys(usGaap).filter(k => k.toLowerCase().includes('revenue'));
      revenueKeys.forEach(k => console.log(`  - ${k}`));
      return;
    }

    const usdValues = metric.units?.USD || [];
    console.log(`📊 Total data points for RevenueFromContractWithCustomerExcludingAssessedTax: ${usdValues.length}\n`);

    // Filter for 10-K/10-Q only
    const filings = usdValues.filter((item: any) =>
      ['10-K', '10-Q'].includes(item.form) &&
      ['Q1', 'Q2', 'Q3', 'Q4', 'FY'].includes(item.fp)
    );

    console.log(`📋 After form filter (10-K/10-Q): ${filings.length} data points\n`);

    // Group by fiscal year
    const byYear: Record<number, any[]> = {};
    for (const item of filings) {
      const year = item.fy;
      if (!byYear[year]) {
        byYear[year] = [];
      }
      byYear[year].push(item);
    }

    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);

    console.log(`📅 Available fiscal years: ${years.join(', ')}`);
    console.log(`📅 Year range: ${years[0]} - ${years[years.length - 1]}`);
    console.log(`📅 Total years: ${years.length} years\n`);

    console.log('📊 Breakdown by year:\n');
    for (const year of years.sort((a, b) => b - a)) {
      const items = byYear[year];
      const quarters = items
        .filter((i: any) => i.fp !== 'FY')
        .map((i: any) => i.fp)
        .sort();
      const hasFY = items.some((i: any) => i.fp === 'FY');

      const uniqueQuarters = [...new Set(quarters)];
      console.log(`  ${year}: ${uniqueQuarters.join(', ')}${hasFY ? ', FY' : ''} (${items.length} total items)`);
    }

    // Show sample data for earliest year
    if (years.length > 0) {
      const earliestYear = years[0];
      console.log(`\n🔍 Sample data for earliest year (${earliestYear}):\n`);
      const samples = byYear[earliestYear].slice(0, 3);
      samples.forEach((item: any, i: number) => {
        console.log(`  ${i + 1}. FY${item.fy} ${item.fp} - Period end: ${item.end}, Filed: ${item.filed}, Value: $${(item.val / 1e9).toFixed(2)}B`);
      });
    }

    // Check if there's data before 2023
    const pre2023 = years.filter(y => y < 2023);
    if (pre2023.length === 0) {
      console.log('\n⚠️  WARNING: No data before 2023 for this metric!');
      console.log('This confirms that Apple only uses RevenueFromContractWithCustomerExcludingAssessedTax from 2023 onwards.');
      console.log('\nChecking for alternative revenue tags...\n');

      // Check for old revenue tag
      const oldRevenue = data.facts?.['us-gaap']?.['Revenues'];
      if (oldRevenue) {
        const oldUSD = oldRevenue.units?.USD || [];
        const oldFilings = oldUSD.filter((item: any) =>
          ['10-K', '10-Q'].includes(item.form) &&
          ['Q1', 'Q2', 'Q3', 'Q4', 'FY'].includes(item.fp)
        );

        const oldYears = [...new Set(oldFilings.map((item: any) => item.fy))].sort((a, b) => a - b);
        console.log(`✅ Found 'Revenues' tag with ${oldFilings.length} data points`);
        console.log(`   Years: ${oldYears.join(', ')}`);
        console.log(`   Range: ${oldYears[0]} - ${oldYears[oldYears.length - 1]} (${oldYears.length} years)`);
      }
    }

  } catch (error: any) {
    if (error.response?.status === 403) {
      console.error('❌ 403 Forbidden - Rate limited or blocked');
      console.log('\nThis is a network/proxy restriction in the current environment.');
      console.log('The SEC API itself does not have this limitation.');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testSECRawData();
