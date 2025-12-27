import axios, { AxiosInstance } from 'axios';
import { query } from '../db/connection';
import { jinaClient } from './JinaAIClient';
import { glmClient } from '../llm/GLMClient';

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
   * LLM-based company name → ticker extraction
   * Uses GLM API to understand natural language (Korean, English, etc.)
   */
  private async extractTickerWithLLM(input: string): Promise<string | null> {
    try {
      console.log(`[SEC Client] 🤖 Using LLM to extract ticker from: "${input}"`);

      const prompt = `당신은 금융 데이터 전문가입니다. 사용자의 자연어 입력에서 미국 주식 ticker symbol을 추출하세요.

입력: "${input}"

규칙:
1. 한글 회사명 → 영문 ticker로 변환
   예: "애플" → AAPL, "테슬라" → TSLA, "조비" → JOBY
2. 영문 회사명 → ticker로 변환
   예: "Apple" → AAPL, "Joby Aviation" → JOBY
3. 이미 ticker인 경우 → 그대로 반환
   예: "AAPL" → AAPL, "TSLA" → TSLA
4. 여러 회사가 언급되면 첫 번째 회사 사용
5. 회사명을 찾을 수 없으면 null 반환

JSON만 반환하세요:
{"ticker": "AAPL", "company": "Apple Inc.", "confidence": "high"}
또는
{"ticker": null, "company": null, "confidence": "none"}`;

      const response = await glmClient.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Very low for consistent extraction
      });

      console.log(`[SEC Client] 🤖 LLM response:`, response);

      // Parse JSON from response
      const jsonMatch = response.match(/\{[^}]*"ticker"[^}]*\}/);
      if (!jsonMatch) {
        console.warn('[SEC Client] ⚠️ Failed to parse LLM response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.ticker || parsed.ticker === 'null') {
        console.log('[SEC Client] ℹ️ LLM could not extract ticker');
        return null;
      }

      console.log(`[SEC Client] ✅ LLM extracted: ${parsed.ticker} (${parsed.company}, confidence: ${parsed.confidence})`);
      return parsed.ticker.toUpperCase();

    } catch (error: any) {
      console.error('[SEC Client] ❌ LLM ticker extraction failed:', error.message);
      return null;
    }
  }

  /**
   * Get company info by ticker symbol or company name
   * Uses LLM + SEC's official company_tickers.json API
   */
  async getCompanyByTicker(ticker: string): Promise<SECCompanyInfo | null> {
    await this.rateLimit();

    console.log(`[SEC Client] Looking up ticker/company: ${ticker}`);

    // ============================================
    // Step 1: LLM-based ticker extraction (handles Korean, English, natural language)
    // ============================================
    const hasNonASCII = /[^\x00-\x7F]/.test(ticker);
    const looksLikeNaturalLanguage = ticker.length > 5 || hasNonASCII || /\s/.test(ticker);

    if (looksLikeNaturalLanguage) {
      console.log('[SEC Client] 🤖 Input looks like natural language, using LLM...');
      const extractedTicker = await this.extractTickerWithLLM(ticker);

      if (extractedTicker) {
        console.log(`[SEC Client] ✓ LLM extracted ticker: ${extractedTicker}`);
        ticker = extractedTicker;
      } else {
        console.log('[SEC Client] ⚠️ LLM could not extract ticker, trying direct search...');
      }
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

    // ============================================
    // Step 2: SEC company_tickers.json lookup
    // ============================================
    try {
      console.log(`[SEC Client] 📋 Fetching company_tickers.json from SEC...`);
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

      if (!matchedEntry) {
        console.log(`[SEC Client] ✗ No matching company found for: ${ticker}`);
        console.log(`[SEC Client] 💡 Hint: Make sure LLM extracted correct ticker`);
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
