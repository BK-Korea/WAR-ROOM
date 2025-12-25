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
   * Uses Edgar search to find company
   */
  async getCompanyByTicker(ticker: string): Promise<SECCompanyInfo | null> {
    await this.rateLimit();

    console.log(`[SEC Client] Looking up ticker/company: ${ticker}`);

    // Try direct CIK lookup first (some tickers are numeric CIKs)
    if (/^\d+$/.test(ticker)) {
      try {
        const directLookup = await this.getCompanyByCIK(ticker);
        if (directLookup) {
          console.log(`[SEC Client] ✓ Found via direct CIK lookup: ${directLookup.name}`);
          return directLookup;
        }
      } catch (directError) {
        console.log(`[SEC Client] Direct CIK lookup failed, trying Edgar search...`);
      }
    }

    // Use Edgar company search (works for both ticker and company name)
    try {
      console.log(`[SEC Client] Searching Edgar for: ${ticker}`);
      const searchUrl = `https://www.sec.gov/cgi-bin/browse-edgar`;
      const response = await axios.get(searchUrl, {
        params: {
          action: 'getcompany',
          company: ticker,  // Edgar accepts both ticker and company name
          type: '',
          dateb: '',
          owner: 'exclude',
          count: '10'  // Get multiple results to find best match
        },
        headers: {
          'User-Agent': this.userAgent
        },
        timeout: 30000
      });

      // Parse HTML response to extract CIK
      const html = response.data;

      // Check if search returned no results
      if (html.includes('No matching') || html.includes('No companies')) {
        console.log(`[SEC Client] ✗ No matching companies found for: ${ticker}`);
        return null;
      }

      // Try multiple patterns to extract CIK (ordered by likelihood)
      const patterns = [
        /CIK=0*(\d+)/i,                    // CIK=0001867102 (most common)
        /\/cik\/0*(\d+)\//i,               // /cik/0001867102/
        /CIK:\s*0*(\d+)/i,                 // CIK: 1867102
        /CIK\s+0*(\d+)/i,                  // CIK 1867102
        /cik=0*(\d+)/i,                    // cik=1867102 (lowercase)
        /<CIK>0*(\d+)<\/CIK>/i,            // <CIK>1867102</CIK>
        /seriesCik=0*(\d+)/i,              // seriesCik=1867102
        /company\/0*(\d+)/i,               // company/1867102
      ];

      let cikMatch = null;
      for (const pattern of patterns) {
        cikMatch = html.match(pattern);
        if (cikMatch) {
          console.log(`[SEC Client] ✓ CIK matched with pattern: ${pattern}`);
          break;
        }
      }

      if (!cikMatch) {
        console.log(`[SEC Client] ✗ No CIK found in Edgar search for: ${ticker}`);
        console.log(`[SEC Client] HTML length:`, html.length);
        console.log(`[SEC Client] HTML preview:`, html.substring(0, 1000));
        return null;
      }

      const cik = cikMatch[1].padStart(10, '0');
      console.log(`[SEC Client] ✓ Found CIK via Edgar search: ${cik}`);

      // Now get full company info using CIK
      return await this.getCompanyByCIK(cik);
    } catch (searchError) {
      console.error('[SEC Client] Edgar search failed:', searchError);
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
   */
  async getFilings(
    cik: string,
    filingType?: string,
    limit: number = 10
  ): Promise<SECFiling[]> {
    await this.rateLimit();

    const paddedCIK = cik.padStart(10, '0');

    try {
      const response = await this.client.get(
        `/submissions/CIK${paddedCIK}.json`
      );

      const filings = response.data.filings.recent;
      const results: SECFiling[] = [];

      for (let i = 0; i < filings.accessionNumber.length && results.length < limit; i++) {
        const type = filings.form[i];

        // Filter by filing type if specified
        if (filingType && type !== filingType) {
          continue;
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
