/**
 * XBRL Parser - Professional-grade SEC XBRL data extraction
 *
 * Based on industry best practices for XBRL parsing
 * References:
 * - SEC EDGAR XBRL format spec
 * - XBRL International standards
 * - Real-world SEC filings analysis
 */

import axios from 'axios';
import * as xml2js from 'xml2js';

// ============================================
// Types
// ============================================

export interface XBRLFinancial {
  xbrlTag: string;
  label: string;
  value: number;
  unit: string;
  scale: 'actual' | 'thousands' | 'millions' | 'billions';
  periodStart: string;
  periodEnd: string;
  isInstant: boolean;
  contextRef: string;
  decimals?: number;
  // ENHANCED: Period classification for quarterly vs annual vs YTD filtering
  periodType?: 'instant' | 'quarterly' | 'ytd' | 'annual' | 'custom';
  periodLengthMonths?: number | null;
  hasDimensions?: boolean; // true = segment breakdown, false = consolidated
}

export interface XBRLParseResult {
  cik: string;
  ticker: string;
  companyName: string;
  filingAccession: string;
  filingType: string;
  filingDate: string;
  fiscalYear: number;
  fiscalQuarter?: number;
  financials: XBRLFinancial[];
  rawData?: any;
}

// ============================================
// Constants
// ============================================

const USER_AGENT = 'WAR-ROOM/1.0 ([email protected])';

// Common XBRL namespaces
const XBRL_NAMESPACES = {
  'us-gaap': 'http://fasb.org/us-gaap/',
  'dei': 'http://xbrl.sec.gov/dei/',
  'xbrli': 'http://www.xbrl.org/2003/instance',
  'xbrldi': 'http://xbrl.org/2006/xbrldi',
  'link': 'http://www.xbrl.org/2003/linkbase',
};

// Financial metrics we care about (US GAAP)
const KEY_METRICS = [
  'Revenues',
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'SalesRevenueNet',
  'NetIncomeLoss',
  'GrossProfit',
  'OperatingIncomeLoss',
  'Assets',
  'AssetsCurrent',
  'Liabilities',
  'LiabilitiesCurrent',
  'StockholdersEquity',
  'CashAndCashEquivalentsAtCarryingValue',
  'EarningsPerShareBasic',
  'EarningsPerShareDiluted',
];

// ============================================
// XBRL Parser Class
// ============================================

export class XBRLParser {
  private userAgent = USER_AGENT;

  /**
   * Download XBRL instance document from SEC EDGAR
   *
   * SEC XBRL file structure:
   * /Archives/edgar/data/{CIK}/{ACCESSION_NO_DASHES}/{COMPANY}-{DATE}.xml
   */
  async downloadXBRL(accessionNumber: string, cik: string): Promise<string | null> {
    try {
      const cleanCIK = cik.replace(/^0+/, ''); // Remove leading zeros
      const cleanAccession = accessionNumber.replace(/-/g, ''); // Remove dashes

      console.log(`[XBRL Parser] Looking for XBRL instance document...`);
      console.log(`[XBRL Parser] CIK: ${cleanCIK}, Accession: ${accessionNumber}`);

      // Step 1: Get filing index page to find XBRL files
      const indexUrl = `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${cleanCIK}&accession_number=${accessionNumber}&xbrl_type=v`;
      console.log(`[XBRL Parser] Fetching index: ${indexUrl}`);

      const indexResponse = await axios.get(indexUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 30000,
      });

      // Step 2: Look for XBRL instance document link
      // Pattern: href="/Archives/edgar/data/{CIK}/{ACCESSION}/{FILENAME}.xml"
      const xbrlLinkPattern = /href="(\/Archives\/edgar\/data\/\d+\/\d+\/[^"]+\.xml)"/gi;
      const matches = [...indexResponse.data.matchAll(xbrlLinkPattern)];

      console.log(`[XBRL Parser] Found ${matches.length} .xml files`);

      if (matches.length === 0) {
        console.log(`[XBRL Parser] ⚠️ No XBRL .xml files found in filing`);
        return null;
      }

      // Find instance document (usually contains company ticker or date in filename)
      // Instance docs are typically NOT "_cal.xml", "_def.xml", "_lab.xml", "_pre.xml"
      const instanceDocs = matches.filter(m => {
        const filename = m[1].toLowerCase();
        return !filename.includes('_cal.xml') &&
               !filename.includes('_def.xml') &&
               !filename.includes('_lab.xml') &&
               !filename.includes('_pre.xml');
      });

      console.log(`[XBRL Parser] Instance documents found: ${instanceDocs.length}`);

      if (instanceDocs.length === 0) {
        console.log(`[XBRL Parser] ⚠️ No instance document found`);
        return null;
      }

      // Use the first instance document
      const xbrlPath = instanceDocs[0][1];
      const xbrlUrl = `https://www.sec.gov${xbrlPath}`;

      console.log(`[XBRL Parser] Downloading instance document: ${xbrlUrl}`);

      // Step 3: Download XBRL XML
      const xbrlResponse = await axios.get(xbrlUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 60000,
      });

      console.log(`[XBRL Parser] ✅ XBRL downloaded (${xbrlResponse.data.length} chars)`);
      return xbrlResponse.data;

    } catch (error: any) {
      console.error(`[XBRL Parser] ❌ Download failed:`, error.message);
      if (error.response) {
        console.error(`[XBRL Parser] Status: ${error.response.status}`);
        console.error(`[XBRL Parser] Response: ${error.response.data?.substring(0, 500)}`);
      }
      return null;
    }
  }

  /**
   * Parse XBRL XML using xml2js
   */
  async parse(xbrlXml: string, filing: {
    cik: string;
    ticker: string;
    companyName: string;
    accessionNumber: string;
    filingType: string;
    filingDate: string;
  }): Promise<XBRLParseResult> {
    try {
      console.log(`[XBRL Parser] Parsing XML...`);

      // Parse XML
      const parser = new xml2js.Parser({
        explicitArray: false,
        mergeAttrs: true,
        xmlns: true,
        tagNameProcessors: [xml2js.processors.stripPrefix], // Remove namespace prefixes
      });

      const result = await parser.parseStringPromise(xbrlXml);

      console.log(`[XBRL Parser] ✅ XML parsed`);
      console.log(`[XBRL Parser] Root keys: ${Object.keys(result).join(', ')}`);

      // XBRL structure: <xbrl> root element
      const xbrl = result.xbrl || result;

      if (!xbrl) {
        throw new Error('Invalid XBRL structure - no xbrl root element');
      }

      // Extract contexts (period information)
      const contexts = this.extractContexts(xbrl);
      console.log(`[XBRL Parser] Extracted ${contexts.size} contexts`);

      // Extract units
      const units = this.extractUnits(xbrl);
      console.log(`[XBRL Parser] Extracted ${units.size} units`);

      // Extract facts
      const financials = this.extractFacts(xbrl, contexts, units);
      console.log(`[XBRL Parser] Extracted ${financials.length} financial facts`);

      // ============================================
      // CRITICAL: Determine fiscal year and quarter from ACTUAL XBRL periods
      // NOT from filing date (which can be weeks later)
      // ============================================
      let fiscalYear: number;
      let fiscalQuarter: number | undefined;

      // Find most recent quarterly period
      const quarterlyFacts = financials.filter(f => f.periodType === 'quarterly');

      if (quarterlyFacts.length > 0) {
        // Sort by periodEnd descending (most recent first)
        quarterlyFacts.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
        const latestQuarter = quarterlyFacts[0];

        // Extract fiscal year and quarter from periodEnd
        const periodEnd = new Date(latestQuarter.periodEnd);
        fiscalYear = periodEnd.getFullYear();
        fiscalQuarter = this.extractQuarterFromDate(periodEnd);

        console.log(`[XBRL Parser] Fiscal period from XBRL context: ${fiscalYear} Q${fiscalQuarter} (${latestQuarter.periodEnd})`);
      } else {
        // Fallback: use filing date
        fiscalYear = parseInt(filing.filingDate.split('-')[0]);
        fiscalQuarter = filing.filingType === '10-Q' ? this.extractQuarter(filing.filingDate) : undefined;

        console.log(`[XBRL Parser] Fiscal period from filing date (no quarterly facts): ${fiscalYear}${fiscalQuarter ? ` Q${fiscalQuarter}` : ''}`);
      }

      return {
        cik: filing.cik,
        ticker: filing.ticker,
        companyName: filing.companyName,
        filingAccession: filing.accessionNumber,
        filingType: filing.filingType,
        filingDate: filing.filingDate,
        fiscalYear,
        fiscalQuarter,
        financials,
      };

    } catch (error: any) {
      console.error(`[XBRL Parser] ❌ Parse failed:`, error.message);
      throw error;
    }
  }

  /**
   * Extract context information (periods, entities)
   * ENHANCED: Calculate period length and detect dimensions
   */
  private extractContexts(xbrl: any): Map<string, any> {
    const contexts = new Map();

    try {
      const contextArray = Array.isArray(xbrl.context) ? xbrl.context : [xbrl.context];

      for (const ctx of contextArray) {
        if (!ctx || !ctx.id) continue;

        const periodStart = ctx.period?.startDate || null;
        const periodEnd = ctx.period?.endDate || ctx.period?.instant || null;
        const isInstant = !!ctx.period?.instant;

        // ============================================
        // CRITICAL: Calculate period length in months
        // ============================================
        let periodLengthMonths: number | null = null;
        let periodType: 'instant' | 'quarterly' | 'ytd' | 'annual' | 'custom' = 'custom';

        if (isInstant) {
          periodType = 'instant';
        } else if (periodStart && periodEnd) {
          const start = new Date(periodStart);
          const end = new Date(periodEnd);
          const diffTime = end.getTime() - start.getTime();
          const diffDays = diffTime / (1000 * 60 * 60 * 24);

          // Calculate months (approximate)
          periodLengthMonths = Math.round(diffDays / 30);

          // Classify period type
          if (periodLengthMonths >= 2 && periodLengthMonths <= 4) {
            periodType = 'quarterly'; // 3개월 (±1 month tolerance)
          } else if (periodLengthMonths >= 11 && periodLengthMonths <= 13) {
            periodType = 'annual'; // 12개월
          } else if (periodLengthMonths >= 5 && periodLengthMonths <= 10) {
            periodType = 'ytd'; // 6개월, 9개월 등 누적
          }
        }

        // ============================================
        // CRITICAL: Detect dimensions (segment/axis)
        // ============================================
        const hasDimensions = !!(
          ctx.entity?.segment ||
          ctx.entity?.scenario
        );

        const context = {
          id: ctx.id,
          entity: ctx.entity?.identifier || null,
          periodStart,
          periodEnd,
          isInstant,
          periodLengthMonths,
          periodType,
          hasDimensions, // true = segment/product breakdown, false = consolidated
        };

        contexts.set(ctx.id, context);
      }
    } catch (error: any) {
      console.warn(`[XBRL Parser] Context extraction failed: ${error.message}`);
    }

    return contexts;
  }

  /**
   * Extract unit information (USD, shares, etc.)
   */
  private extractUnits(xbrl: any): Map<string, string> {
    const units = new Map();

    try {
      const unitArray = Array.isArray(xbrl.unit) ? xbrl.unit : [xbrl.unit];

      for (const unit of unitArray) {
        if (!unit || !unit.id) continue;

        // Unit measure (e.g., "iso4217:USD", "shares")
        const measure = unit.measure || unit.divide?.unitNumerator?.measure || 'unknown';
        units.set(unit.id, measure);
      }
    } catch (error: any) {
      console.warn(`[XBRL Parser] Unit extraction failed: ${error.message}`);
    }

    return units;
  }

  /**
   * Extract financial facts from XBRL
   * ENHANCED: Filter for quarterly/annual, consolidated values only
   */
  private extractFacts(xbrl: any, contexts: Map<string, any>, units: Map<string, string>): XBRLFinancial[] {
    const allFacts: XBRLFinancial[] = [];

    try {
      // Iterate through all elements looking for US GAAP tags
      for (const [key, value] of Object.entries(xbrl)) {
        // Skip non-fact elements
        if (key === 'schemaRef' || key === 'context' || key === 'unit') continue;

        // Check if this is a US GAAP metric we care about
        const metricName = KEY_METRICS.find(m => key.toLowerCase().includes(m.toLowerCase()));
        if (!metricName) continue;

        // Handle both single fact and array of facts
        const facts = Array.isArray(value) ? value : [value];

        for (const fact of facts) {
          if (!fact || typeof fact !== 'object') continue;

          const contextRef = fact.contextRef;
          const unitRef = fact.unitRef;
          const textValue = fact._ || fact;

          if (!contextRef || !textValue) continue;

          const context = contexts.get(contextRef);
          const unit = units.get(unitRef);

          if (!context) continue;

          // ============================================
          // CRITICAL: Filter out non-quarterly/annual and segmented data
          // ============================================
          // Priority 1: Only accept quarterly or annual periods
          if (context.periodType !== 'quarterly' && context.periodType !== 'annual') {
            console.log(`[XBRL Parser] ⏭️  Skipping ${metricName} - periodType: ${context.periodType} (need quarterly/annual)`);
            continue;
          }

          // Priority 2: Only accept consolidated (no dimensions)
          if (context.hasDimensions) {
            console.log(`[XBRL Parser] ⏭️  Skipping ${metricName} - has dimensions (need consolidated)`);
            continue;
          }

          const numericValue = this.parseValue(textValue);
          if (numericValue === null) continue;

          // Detect scale from decimals attribute or value magnitude
          const decimals = fact.decimals;
          const scale = this.detectScale(numericValue, decimals);

          allFacts.push({
            xbrlTag: `us-gaap:${metricName}`,
            label: this.formatLabel(metricName),
            value: numericValue,
            unit: this.cleanUnit(unit || 'USD'),
            scale,
            periodStart: context.periodStart || context.periodEnd,
            periodEnd: context.periodEnd,
            isInstant: context.isInstant,
            contextRef,
            decimals: parseInt(decimals) || undefined,
            // ENHANCED: Include period classification
            periodType: context.periodType,
            periodLengthMonths: context.periodLengthMonths,
            hasDimensions: context.hasDimensions,
          });
        }
      }

      // ============================================
      // CRITICAL: Deduplicate facts (same tag + period)
      // ============================================
      const deduped = this.deduplicateFacts(allFacts);
      console.log(`[XBRL Parser] Deduplicated: ${allFacts.length} → ${deduped.length} facts`);

      return deduped;

    } catch (error: any) {
      console.error(`[XBRL Parser] Fact extraction failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Deduplicate facts - if same tag + period, keep highest quality
   * Priority: quarterly > annual, later periodEnd > earlier
   */
  private deduplicateFacts(facts: XBRLFinancial[]): XBRLFinancial[] {
    const map = new Map<string, XBRLFinancial>();

    for (const fact of facts) {
      const key = `${fact.xbrlTag}::${fact.periodEnd}`;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, fact);
        continue;
      }

      // Priority 1: Prefer quarterly over annual (for 10-K containing both)
      if (fact.periodType === 'quarterly' && existing.periodType === 'annual') {
        map.set(key, fact);
        console.log(`[XBRL Parser] 🔄 Replaced annual with quarterly: ${fact.xbrlTag} @ ${fact.periodEnd}`);
        continue;
      }

      // Priority 2: If both same type, keep later periodEnd (more recent amendment)
      if (fact.periodEnd > existing.periodEnd) {
        map.set(key, fact);
        console.log(`[XBRL Parser] 🔄 Replaced older periodEnd: ${fact.xbrlTag} ${existing.periodEnd} → ${fact.periodEnd}`);
      }
    }

    return Array.from(map.values());
  }

  /**
   * Parse string value to number
   */
  private parseValue(valueStr: string): number | null {
    if (typeof valueStr !== 'string') return null;

    const cleaned = valueStr.replace(/[,$\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Detect scale from value and decimals attribute
   */
  private detectScale(value: number, decimals?: string): 'actual' | 'thousands' | 'millions' | 'billions' {
    const absValue = Math.abs(value);

    // XBRL decimals attribute hints at scale:
    // decimals="-3" means thousands
    // decimals="-6" means millions
    if (decimals) {
      const dec = parseInt(decimals);
      if (dec === -9) return 'billions';
      if (dec === -6) return 'millions';
      if (dec === -3) return 'thousands';
    }

    // Fallback: detect from magnitude
    if (absValue >= 1_000_000_000) return 'billions';
    if (absValue >= 1_000_000) return 'millions';
    if (absValue >= 1_000) return 'thousands';
    return 'actual';
  }

  /**
   * Clean unit string
   */
  private cleanUnit(unitStr: string): string {
    if (unitStr.includes('USD') || unitStr.includes('usd')) return 'USD';
    if (unitStr.includes('shares')) return 'shares';
    return unitStr;
  }

  /**
   * Format label (CamelCase to readable)
   */
  private formatLabel(camelCase: string): string {
    return camelCase
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Extract quarter from filing date (legacy)
   */
  private extractQuarter(filingDate: string): number {
    const month = parseInt(filingDate.split('-')[1]);

    if (month >= 1 && month <= 3) return 1;
    if (month >= 4 && month <= 6) return 2;
    if (month >= 7 && month <= 9) return 3;
    return 4;
  }

  /**
   * Extract quarter from periodEnd Date object
   * Uses month of period end to determine fiscal quarter
   */
  private extractQuarterFromDate(date: Date): number {
    const month = date.getMonth() + 1; // getMonth() is 0-indexed

    if (month >= 1 && month <= 3) return 1;
    if (month >= 4 && month <= 6) return 2;
    if (month >= 7 && month <= 9) return 3;
    return 4;
  }
}

// ============================================
// Helper Functions
// ============================================

export function getXBRLParser(): XBRLParser {
  return new XBRLParser();
}

export async function parseXBRLFiling(filing: {
  cik: string;
  ticker: string;
  companyName: string;
  accessionNumber: string;
  filingType: string;
  filingDate: string;
}): Promise<XBRLParseResult | null> {
  try {
    const parser = getXBRLParser();

    // Step 1: Download XBRL
    const xbrlXml = await parser.downloadXBRL(filing.accessionNumber, filing.cik);
    if (!xbrlXml) {
      console.log(`[XBRL] No XBRL data available for ${filing.accessionNumber}`);
      return null;
    }

    // Step 2: Parse XBRL
    const result = await parser.parse(xbrlXml, filing);
    return result;

  } catch (error: any) {
    console.error(`[XBRL] ❌ Failed to parse filing ${filing.accessionNumber}:`, error.message);
    return null;
  }
}

export function extractMetric(
  parseResult: XBRLParseResult,
  xbrlTag: string
): XBRLFinancial | null {
  return parseResult.financials.find(f => f.xbrlTag === xbrlTag) || null;
}

export function getRevenue(parseResult: XBRLParseResult): XBRLFinancial | null {
  const revenueTags = [
    'us-gaap:Revenues',
    'us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax',
    'us-gaap:SalesRevenueNet',
  ];

  for (const tag of revenueTags) {
    const metric = extractMetric(parseResult, tag);
    if (metric) return metric;
  }

  return null;
}

export function getNetIncome(parseResult: XBRLParseResult): XBRLFinancial | null {
  return extractMetric(parseResult, 'us-gaap:NetIncomeLoss');
}
