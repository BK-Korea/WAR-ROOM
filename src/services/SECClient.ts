import axios, { AxiosInstance } from 'axios';
import { query } from '../db/connection';
import { jinaClient } from './JinaAIClient';

/**
 * SEC Edgar API Client
 *
 * Fetches real SEC filings from Edgar database
 * Adheres to SEC fair access rules (max 10 requests/second)
 */

export interface SECFiling {
  cik: string;
  companyName: string;
  filingType: string; // 10-K, 10-Q, 8-K, etc.
  filingDate: string;
  reportDate: string;
  accessionNumber: string;
  fileUrl: string;
}

export interface SECCompanyInfo {
  cik: string;
  name: string;
  tickers: string[];
  exchanges: string[];
}

export class SECClient {
  private client: AxiosInstance;
  private userAgent: string;
  private baseURL: string = 'https://data.sec.gov';
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 100; // 100ms = 10 requests/second max

  constructor(userAgent: string = 'WAR-ROOM Dorothy dorothy@war-room.ai') {
    this.userAgent = userAgent;

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Rate limiting to comply with SEC rules
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve =>
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Get company info by ticker symbol or company name
   * Uses SEC's official company_tickers.json API (fast and reliable)
   */
  async getCompanyByTicker(ticker: string): Promise<SECCompanyInfo | null> {
    await this.rateLimit();

    console.log(`[SEC Client] Looking up ticker/company: ${ticker}`);

    // ============================================
    // Korean → English Ticker Mapping (Goldman Sachs-grade)
    // ============================================
    const KOREAN_TICKER_MAP: Record<string, string> = {
      '애플': 'AAPL',
      '테슬라': 'TSLA',
      '마이크로소프트': 'MSFT',
      '구글': 'GOOGL',
      '아마존': 'AMZN',
      '메타': 'META',
      '페이스북': 'META',
      '엔비디아': 'NVDA',
      '넷플릭스': 'NFLX',
      '조비': 'JOBY',
      '조비에비에이션': 'JOBY',
    };

    const lowerTicker = ticker.toLowerCase();
    if (KOREAN_TICKER_MAP[lowerTicker]) {
      const englishTicker = KOREAN_TICKER_MAP[lowerTicker];
      console.log(`[SEC Client] ✓ Korean name detected: "${ticker}" → ${englishTicker}`);
      ticker = englishTicker;
    }

    // Try direct CIK lookup first (some tickers are numeric CIKs)
    if (/^\d+$/.test(ticker)) {
      try {
        const directLookup = await this.getCompanyByCIK(ticker);
        if (directLookup) {
          console.log(`[SEC Client] ✓ Found via direct CIK lookup: ${directLookup.name}`);
          return directLookup;
        }
      } catch (directError) {
        console.log(`[SEC Client] Direct CIK lookup failed, trying ticker lookup...`);
      }
    }

    // Use SEC's official company_tickers.json API
    try {
      console.log(`[SEC Client] Fetching company_tickers.json from SEC...`);
      const response = await axios.get('https://www.sec.gov/files/company_tickers.json', {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      const tickers = response.data;
      console.log(`[SEC Client] ✓ Loaded ${Object.keys(tickers).length} companies from SEC`);

      // Search for exact ticker match (case-insensitive)
      const upperTicker = ticker.toUpperCase();
      let matchedEntry = null;

      for (const key in tickers) {
        const entry = tickers[key];
        if (entry.ticker && entry.ticker.toUpperCase() === upperTicker) {
          matchedEntry = entry;
          console.log(`[SEC Client] ✓ Found exact ticker match: ${entry.title} (CIK: ${entry.cik_str})`);
          break;
        }
      }

      // If no exact ticker match, try company name search (fuzzy)
      // IMPORTANT: Only for exact English company names, NOT Korean
      if (!matchedEntry) {
        const lowerQuery = ticker.toLowerCase();

        // Skip fuzzy matching if query contains non-ASCII (Korean, Chinese, etc.)
        const hasNonASCII = /[^\x00-\x7F]/.test(ticker);
        if (hasNonASCII) {
          console.log(`[SEC Client] ✗ Non-English input: "${ticker}"`);
          console.log(`[SEC Client] 💡 Hint: Use English ticker (AAPL) or add to Korean mapping`);
          return null;
        }

        // Fuzzy match English company names only
        for (const key in tickers) {
          const entry = tickers[key];
          if (entry.title && entry.title.toLowerCase().includes(lowerQuery)) {
            matchedEntry = entry;
            console.log(`[SEC Client] ✓ Found company name match: ${entry.title} (CIK: ${entry.cik_str})`);
            break;
          }
        }
      }

      if (!matchedEntry) {
        console.log(`[SEC Client] ✗ No matching company found for: ${ticker}`);
        return null;
      }

      // Convert CIK to padded format
      const cik = String(matchedEntry.cik_str).padStart(10, '0');
      console.log(`[SEC Client] ✓ Resolved to CIK: ${cik}`);

      // Get full company info using CIK
      return await this.getCompanyByCIK(cik);
    } catch (error) {
      console.error('[SEC Client] company_tickers.json fetch failed:', error);
      return null;
    }
  }

  /**
   * Get company info by CIK (Central Index Key)
   */
  async getCompanyByCIK(cik: string): Promise<SECCompanyInfo | null> {
    await this.rateLimit();

    const paddedCIK = cik.padStart(10, '0');

    try {
      const response = await this.client.get(
        `/submissions/CIK${paddedCIK}.json`
      );

      return {
        cik: paddedCIK,
        name: response.data.name,
        tickers: response.data.tickers || [],
        exchanges: response.data.exchanges || []
      };
    } catch (error) {
      console.error('Error fetching company by CIK:', error);
      return null;
    }
  }

  /**
   * Get recent filings for a company
   * @param cik Company CIK
   * @param filingTypes Filing type(s) to filter - can be single string or array
   * @param limit Maximum number of filings to return
   * @param year Optional year to filter filings (e.g., 2024)
   */
  async getFilings(
    cik: string,
    filingTypes?: string | string[],
    limit: number = 10,
    year?: number
  ): Promise<SECFiling[]> {
    await this.rateLimit();

    const paddedCIK = cik.padStart(10, '0');

    try {
      const response = await this.client.get(
        `/submissions/CIK${paddedCIK}.json`
      );

      const filings = response.data.filings.recent;
      const results: SECFiling[] = [];

      // Normalize filingTypes to array
      const typesArray = filingTypes
        ? (Array.isArray(filingTypes) ? filingTypes : [filingTypes])
        : null;

      console.log(`[SEC Client] Fetching filings for CIK ${paddedCIK}:`);
      console.log(`[SEC Client] - Types: ${typesArray ? typesArray.join(', ') : 'all'}`);
      console.log(`[SEC Client] - Year: ${year || 'all'}`);
      console.log(`[SEC Client] - Limit: ${limit}`);

      for (let i = 0; i < filings.accessionNumber.length && results.length < limit; i++) {
        const type = filings.form[i];
        const filingDate = filings.filingDate[i]; // Format: YYYY-MM-DD

        // Filter by filing type if specified
        if (typesArray && !typesArray.includes(type)) {
          continue;
        }

        // Filter by year if specified
        if (year) {
          const filingYear = parseInt(filingDate.split('-')[0]);
          if (filingYear !== year) {
            continue;
          }
        }

        const accessionNumber = filings.accessionNumber[i];
        const accessionNumberNoHyphens = accessionNumber.replace(/-/g, '');

        results.push({
          cik: paddedCIK,
          companyName: response.data.name,
          filingType: type,
          filingDate: filings.filingDate[i],
          reportDate: filings.reportDate[i],
          accessionNumber: accessionNumber,
          fileUrl: `https://www.sec.gov/Archives/edgar/data/${parseInt(paddedCIK)}/${accessionNumberNoHyphens}/${accessionNumber}.txt`
        });
      }

      console.log(`[SEC Client] ✓ Found ${results.length} filings`);
      if (results.length > 0) {
        console.log(`[SEC Client] Filing types found: ${[...new Set(results.map(f => f.filingType))].join(', ')}`);
      }

      return results;
    } catch (error) {
      console.error('Error fetching filings:', error);
      return [];
    }
  }

  /**
   * Download filing content
   */
  async downloadFiling(filing: SECFiling): Promise<string> {
    await this.rateLimit();

    try {
      // For HTML filings, construct the primary document URL
      const accessionNumberNoHyphens = filing.accessionNumber.replace(/-/g, '');

      // Try to get the primary document (usually the -index.html or first .htm file)
      const indexUrl = `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${filing.cik}&accession_number=${filing.accessionNumber}`;

      // Download the main filing document
      const response = await axios.get(filing.fileUrl, {
        headers: {
          'User-Agent': this.userAgent
        },
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error('Error downloading filing:', error);
      throw error;
    }
  }

  /**
   * Get financial data from XBRL
   * SEC provides company facts in JSON format
   */
  async getCompanyFacts(cik: string): Promise<any> {
    await this.rateLimit();

    const paddedCIK = cik.padStart(10, '0');

    try {
      const response = await this.client.get(
        `/api/xbrl/companyfacts/CIK${paddedCIK}.json`
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching company facts:', error);
      return null;
    }
  }

  /**
   * Store filing in database with automatic markdown conversion
   */
  async storeFiling(
    companyId: number,
    filing: SECFiling,
    content: string
  ): Promise<number> {
    // Convert to markdown using Jina AI
    let markdownContent: string | null = null;
    let conversionStatus = 'pending';

    try {
      console.log(`[SEC Client] Converting filing to markdown with Jina AI...`);
      const jinaResult = await jinaClient.convertURL(filing.fileUrl);
      markdownContent = jinaResult.markdown;
      conversionStatus = 'converted';
      console.log(`[SEC Client] ✅ Markdown conversion successful (${jinaResult.tokensUsed} tokens)`);
    } catch (error) {
      console.error('[SEC Client] Markdown conversion failed, storing raw content only:', error);
      conversionStatus = 'failed';
    }

    const result = await query(`
      INSERT INTO sec_filings (
        company_id, cik, filing_type, filing_date, report_date,
        accession_number, file_url, raw_content, markdown_content, conversion_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (accession_number) DO UPDATE
      SET raw_content = EXCLUDED.raw_content,
          markdown_content = EXCLUDED.markdown_content,
          conversion_status = EXCLUDED.conversion_status,
          updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [
      companyId,
      filing.cik,
      filing.filingType,
      filing.filingDate,
      filing.reportDate,
      filing.accessionNumber,
      filing.fileUrl,
      content,
      markdownContent,
      conversionStatus
    ]);

    return result.rows[0]?.id || 0;
  }

  /**
   * Store parsed financial data
   */
  async storeFinancialData(
    filingId: number,
    statementType: string,
    periodEnd: string,
    data: any
  ): Promise<number> {
    const result = await query(`
      INSERT INTO dorothy_finance.sec_financial_data (
        filing_id, statement_type, period_end, data
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [
      filingId,
      statementType,
      periodEnd,
      JSON.stringify(data)
    ]);

    return result.rows[0].id;
  }

  /**
   * Check if filing already exists
   */
  async filingExists(accessionNumber: string): Promise<boolean> {
    const result = await query(`
      SELECT id FROM sec_filings
      WHERE accession_number = ?
    `, [accessionNumber]);

    return result.rowCount > 0;
  }
}

// Singleton instance
export const secClient = new SECClient();
