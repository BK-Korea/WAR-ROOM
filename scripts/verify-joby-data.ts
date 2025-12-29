/**
 * Verify Joby Aviation SEC Data
 *
 * This script fetches actual SEC data for Joby Aviation (JOBY)
 * to verify Dorothy's analysis accuracy
 */

import axios from 'axios';

const USER_AGENT = 'WAR-ROOM Verification verify@war-room.ai';

interface CompanyFacts {
  cik: string;
  entityName: string;
  facts: {
    'us-gaap': {
      [metric: string]: {
        label: string;
        description: string;
        units: {
          [unit: string]: Array<{
            end: string;
            val: number;
            accn: string;
            fy: number;
            fp: string;
            form: string;
            filed: string;
            frame?: string;
          }>;
        };
      };
    };
  };
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCompanyByTicker(ticker: string) {
  console.log(`\n[1] Looking up ticker: ${ticker}...`);

  const response = await axios.get('https://www.sec.gov/files/company_tickers.json', {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json'
    },
    timeout: 30000
  });

  const tickers = response.data;
  const upperTicker = ticker.toUpperCase();

  for (const key in tickers) {
    const entry = tickers[key];
    if (entry.ticker && entry.ticker.toUpperCase() === upperTicker) {
      const cik = String(entry.cik_str).padStart(10, '0');
      console.log(`✓ Found: ${entry.title} (CIK: ${cik})`);
      return { cik, name: entry.title };
    }
  }

  throw new Error(`Ticker ${ticker} not found`);
}

async function getCompanyFacts(cik: string): Promise<CompanyFacts> {
  console.log(`\n[2] Fetching company facts for CIK ${cik}...`);
  await sleep(100); // Rate limiting

  const response = await axios.get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json'
    },
    timeout: 30000
  });

  console.log(`✓ Retrieved company facts for: ${response.data.entityName}`);
  return response.data;
}

function extractMetric(facts: CompanyFacts, metricName: string, unit: string = 'USD') {
  const metric = facts.facts['us-gaap']?.[metricName];
  if (!metric) {
    console.log(`⚠️  Metric ${metricName} not found`);
    return [];
  }

  const unitData = metric.units[unit] || metric.units['USD'] || metric.units['shares'] || Object.values(metric.units)[0];
  if (!unitData) {
    console.log(`⚠️  No unit data for ${metricName}`);
    return [];
  }

  return unitData;
}

function formatValue(val: number, unit: string = 'USD'): string {
  if (unit === 'USD') {
    if (Math.abs(val) >= 1e9) {
      return `$${(val / 1e9).toFixed(2)}B`;
    } else if (Math.abs(val) >= 1e6) {
      return `$${(val / 1e6).toFixed(2)}M`;
    } else if (Math.abs(val) >= 1e3) {
      return `$${(val / 1e3).toFixed(2)}K`;
    }
    return `$${val.toFixed(2)}`;
  }
  return val.toLocaleString();
}

async function verifyJobyData() {
  try {
    const ticker = 'JOBY';

    // Step 1: Get company info
    const company = await getCompanyByTicker(ticker);

    // Step 2: Get company facts (XBRL data)
    const facts = await getCompanyFacts(company.cik);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`JOBY AVIATION SEC DATA VERIFICATION`);
    console.log(`${'='.repeat(80)}\n`);

    // Key metrics to verify
    const metrics = [
      { name: 'Revenues', tag: 'Revenues' },
      { name: 'Revenue (Contract)', tag: 'RevenueFromContractWithCustomerExcludingAssessedTax' },
      { name: 'Net Income/Loss', tag: 'NetIncomeLoss' },
      { name: 'Operating Income/Loss', tag: 'OperatingIncomeLoss' },
      { name: 'Cash and Cash Equivalents', tag: 'CashAndCashEquivalentsAtCarryingValue' },
      { name: 'Assets', tag: 'Assets' },
      { name: 'Assets (Current)', tag: 'AssetsCurrent' },
      { name: 'Liabilities', tag: 'Liabilities' },
      { name: 'Liabilities (Current)', tag: 'LiabilitiesCurrent' },
      { name: 'Stockholders Equity', tag: 'StockholdersEquity' },
    ];

    for (const metric of metrics) {
      console.log(`\n--- ${metric.name} (${metric.tag}) ---`);
      const data = extractMetric(facts, metric.tag);

      if (data.length === 0) {
        console.log('  No data available\n');
        continue;
      }

      // Group by fiscal year
      const byYear: { [key: string]: typeof data } = {};

      for (const item of data) {
        // Only show 10-K and 10-Q filings from 2023-2025
        if (!['10-K', '10-Q'].includes(item.form)) continue;
        if (item.fy < 2023 || item.fy > 2025) continue;

        const key = `${item.fy}`;
        if (!byYear[key]) byYear[key] = [];
        byYear[key].push(item);
      }

      // Display by year
      for (const year of ['2023', '2024', '2025']) {
        const yearData = byYear[year];
        if (!yearData || yearData.length === 0) continue;

        console.log(`  ${year}:`);

        // Sort by end date
        yearData.sort((a, b) => a.end.localeCompare(b.end));

        for (const item of yearData) {
          const value = formatValue(item.val);
          console.log(`    ${item.end} (${item.fp}): ${value.padStart(12)} [${item.form}] filed: ${item.filed}`);
        }
      }
    }

    // Special section: Cash and Investments detail
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`CASH & LIQUIDITY ANALYSIS (2024-2025)`);
    console.log(`${'='.repeat(80)}\n`);

    const cashMetrics = [
      { name: 'Cash and Cash Equivalents', tag: 'CashAndCashEquivalentsAtCarryingValue' },
      { name: 'Short-term Investments', tag: 'AvailableForSaleSecuritiesCurrent' },
      { name: 'Marketable Securities', tag: 'MarketableSecurities' },
    ];

    for (const metric of cashMetrics) {
      console.log(`\n${metric.name}:`);
      const data = extractMetric(facts, metric.tag);

      const recent = data
        .filter(d => ['10-K', '10-Q', '8-K'].includes(d.form))
        .filter(d => d.fy >= 2024)
        .sort((a, b) => b.end.localeCompare(a.end))
        .slice(0, 5);

      if (recent.length === 0) {
        console.log('  No recent data');
        continue;
      }

      for (const item of recent) {
        const value = formatValue(item.val);
        console.log(`  ${item.end}: ${value.padStart(12)} [${item.form}] filed: ${item.filed}`);
      }
    }

    // 8-K filings (material events like funding)
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`CHECKING FOR MATERIAL EVENTS (8-K filings, 2024-2025)`);
    console.log(`${'='.repeat(80)}\n`);

    await sleep(100);
    const submissions = await axios.get(`https://data.sec.gov/submissions/CIK${company.cik}.json`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }
    });

    const filings = submissions.data.filings.recent;
    const eightKFilings = [];

    for (let i = 0; i < filings.form.length; i++) {
      if (filings.form[i] === '8-K') {
        const filingDate = filings.filingDate[i];
        const year = parseInt(filingDate.split('-')[0]);

        if (year >= 2024) {
          eightKFilings.push({
            form: filings.form[i],
            filingDate: filings.filingDate[i],
            reportDate: filings.reportDate[i],
            accessionNumber: filings.accessionNumber[i],
            primaryDocument: filings.primaryDocument[i]
          });
        }
      }
    }

    console.log(`Found ${eightKFilings.length} 8-K filings in 2024-2025:\n`);
    for (const filing of eightKFilings.slice(0, 10)) {
      console.log(`  ${filing.filingDate}: ${filing.accessionNumber}`);
      console.log(`    Report date: ${filing.reportDate}`);
      console.log(`    Document: ${filing.primaryDocument || 'N/A'}`);
      console.log();
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`VERIFICATION COMPLETE`);
    console.log(`${'='.repeat(80)}\n`);

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run verification
verifyJobyData();
