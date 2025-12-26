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

      // Determine fiscal year and quarter
      const fiscalYear = parseInt(filing.filingDate.split('-')[0]);
      const fiscalQuarter = filing.filingType === '10-Q' ? this.extractQuarter(filing.filingDate) : undefined;

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
   */
  private extractContexts(xbrl: any): Map<string, any> {
    const contexts = new Map();

    try {
      const contextArray = Array.isArray(xbrl.context) ? xbrl.context : [xbrl.context];

      for (const ctx of contextArray) {
        if (!ctx || !ctx.id) continue;

        const context = {
          id: ctx.id,
          entity: ctx.entity?.identifier || null,
          periodStart: ctx.period?.startDate || null,
          periodEnd: ctx.period?.endDate || ctx.period?.instant || null,
          isInstant: !!ctx.period?.instant,
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
   */
  private extractFacts(xbrl: any, contexts: Map<string, any>, units: Map<string, string>): XBRLFinancial[] {
    const financials: XBRLFinancial[] = [];

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

          const numericValue = this.parseValue(textValue);
          if (numericValue === null) continue;

          // Detect scale from decimals attribute or value magnitude
          const decimals = fact.decimals;
          const scale = this.detectScale(numericValue, decimals);

          financials.push({
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
          });
        }
      }
    } catch (error: any) {
      console.error(`[XBRL Parser] Fact extraction failed: ${error.message}`);
    }

    return financials;
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
   * Extract quarter from filing date
   */
  private extractQuarter(filingDate: string): number {
    const month = parseInt(filingDate.split('-')[1]);

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
