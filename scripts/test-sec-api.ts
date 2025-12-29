#!/usr/bin/env tsx
/**
 * Test SEC Company Facts API directly
 * Check what year range SEC actually provides
 */

import axios from 'axios';

const USER_AGENT = 'WAR-ROOM Helena helena@war-room.ai';

async function checkSECAPI() {
  console.log('🔍 Checking SEC Company Facts API for AAPL...\n');

  const cik = '0000320193'; // Apple
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

    // Check Revenue data
    const revenues = data.facts?.['us-gaap']?.['RevenueFromContractWithCustomerExcludingAssessedTax'];

    if (!revenues) {
      console.log('❌ No revenue data found');
      return;
    }

    const usdValues = revenues.units.USD || [];
    console.log(`📊 Total revenue data points: ${usdValues.length}\n`);

    // Filter for 10-Q and 10-K only
    const filings = usdValues.filter((item: any) =>
      ['10-K', '10-Q'].includes(item.form) &&
      ['Q1', 'Q2', 'Q3', 'Q4', 'FY'].includes(item.fp)
    );

    console.log(`📋 Filtered (10-K/10-Q only): ${filings.length} data points\n`);

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
    console.log(`📅 Year range in SEC API: ${years[0]} - ${years[years.length - 1]}`);
    console.log(`📅 Total years: ${years.length} years\n`);

    // Show details for each year
    console.log('📊 Breakdown by year:\n');
    for (const year of years.sort((a, b) => b - a).slice(0, 15)) {
      const items = byYear[year];
      const quarters = items.filter((i: any) => i.fp !== 'FY').map((i: any) => i.fp).sort();
      const hasFY = items.some((i: any) => i.fp === 'FY');

      console.log(`${year}: ${quarters.join(', ')}${hasFY ? ', FY' : ''} (${items.length} items)`);
    }

    // Check date range
    const dates = filings.map((item: any) => item.end).filter(Boolean).sort();
    console.log(`\n📅 Period end date range: ${dates[0]} to ${dates[dates.length - 1]}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkSECAPI();
