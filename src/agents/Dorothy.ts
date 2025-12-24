import { BaseAgent } from './BaseAgent.js';
import { AgentContext, TaskResult } from '../types/agent.js';
import { query } from '../db/connection.js';
import { DOROTHY_SYSTEM_PROMPT, DOROTHY_TASK_PROMPTS } from '../prompts/dorothy.js';
import { secClient, SECFiling } from '../services/SECClient.js';

/**
 * Dorothy - CFA-level Financial Analyst (SEC Data Specialist)
 *
 * CRITICAL PRINCIPLE: Only uses SEC filing data. Never makes assumptions.
 *
 * Capabilities:
 * - Download and parse SEC filings (10-K, 10-Q, 8-K)
 * - Extract financial data from filings
 * - Calculate financial ratios
 * - Analyze financial health
 * - Compare periods
 */
export class Dorothy extends BaseAgent {
  constructor() {
    super({
      name: 'Dorothy',
      role: 'Senior Financial Analyst, CFA',
      description: 'SEC filing specialist - provides financial analysis based ONLY on official SEC data',
      capabilities: [
        {
          name: 'fetch_sec_data',
          description: 'Download SEC filings for a company (10-K, 10-Q, 8-K)'
        },
        {
          name: 'analyze_filing',
          description: 'Analyze specific SEC filing with LLM'
        },
        {
          name: 'extract_financials',
          description: 'Extract financial statement data from filings'
        },
        {
          name: 'calculate_ratios',
          description: 'Calculate financial ratios from SEC data'
        },
        {
          name: 'compare_periods',
          description: 'Compare financial performance across periods'
        },
        {
          name: 'assess_health',
          description: 'Assess financial health based on SEC filings'
        },
        {
          name: 'answer_question',
          description: 'Answer financial questions using ONLY SEC data'
        }
      ],
      schema: 'dorothy_finance'
    });
  }

  protected async onInitialize(): Promise<void> {
    this.setSystemPrompt(DOROTHY_SYSTEM_PROMPT);
    console.log('💰 Dorothy (CFA, SEC Specialist) is ready - ONLY uses SEC filing data');
  }

  protected async performTask(task: string, params: any, context: AgentContext): Promise<TaskResult> {
    switch (task) {
      case 'fetch_sec_data':
        return await this.fetchSECData(params, context);
      case 'analyze_filing':
        return await this.analyzeFiling(params, context);
      case 'extract_financials':
        return await this.extractFinancials(params, context);
      case 'calculate_ratios':
        return await this.calculateRatios(params, context);
      case 'compare_periods':
        return await this.comparePeriods(params, context);
      case 'assess_health':
        return await this.assessHealth(params, context);
      case 'answer_question':
        return await this.answerQuestion(params, context);
      default:
        return {
          success: false,
          error: `Unknown task: ${task}. Available: fetch_sec_data, analyze_filing, extract_financials, calculate_ratios, compare_periods, assess_health, answer_question`
        };
    }
  }

  /**
   * Fetch SEC filings for a company
   */
  private async fetchSECData(params: any, context: AgentContext): Promise<TaskResult> {
    const { ticker, cik, filingType, limit = 5 } = params;

    try {
      // Get company info
      let companyInfo;
      if (ticker) {
        companyInfo = await secClient.getCompanyByTicker(ticker);
      } else if (cik) {
        companyInfo = await secClient.getCompanyByCIK(cik);
      } else {
        return {
          success: false,
          error: 'Must provide either ticker or CIK'
        };
      }

      if (!companyInfo) {
        return {
          success: false,
          error: `Company not found: ${ticker || cik}`
        };
      }

      // Get or create company in our database
      const companyResult = await query(`
        INSERT INTO shared.companies (name, industry, website, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [companyInfo.name, 'Public Company', '', `CIK: ${companyInfo.cik}`]);

      const companyId = companyResult.rows[0].id;

      // Fetch filings
      const filings = await secClient.getFilings(companyInfo.cik, filingType, limit);

      if (filings.length === 0) {
        return {
          success: true,
          data: {
            message: `No ${filingType || 'filings'} found for ${companyInfo.name}`,
            company: companyInfo,
            filings: []
          }
        };
      }

      // Download and store each filing
      const storedFilings = [];
      for (const filing of filings) {
        // Check if already exists
        const exists = await secClient.filingExists(filing.accessionNumber);

        if (!exists) {
          console.log(`Downloading ${filing.filingType} from ${filing.filingDate}...`);
          const content = await secClient.downloadFiling(filing);

          const filingId = await secClient.storeFiling(companyId, filing, content);
          storedFilings.push({
            ...filing,
            filingId,
            status: 'downloaded'
          });
        } else {
          storedFilings.push({
            ...filing,
            status: 'already_exists'
          });
        }
      }

      return {
        success: true,
        data: {
          company: companyInfo,
          filingsDownloaded: storedFilings.filter(f => f.status === 'downloaded').length,
          filingsTotal: storedFilings.length,
          filings: storedFilings
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `SEC data fetch failed: ${error.message}`
      };
    }
  }

  /**
   * Analyze a specific SEC filing using LLM
   */
  private async analyzeFiling(params: any, context: AgentContext): Promise<TaskResult> {
    const { ticker, cik, filingType = '10-K', filingDate, question } = params;

    try {
      // Find the filing in database
      let filing;

      if (filingDate) {
        filing = await this.getFilingByDate(ticker, cik, filingType, filingDate);
      } else {
        filing = await this.getLatestFiling(ticker, cik, filingType);
      }

      if (!filing) {
        return {
          success: false,
          error: `No ${filingType} filing found. Use fetch_sec_data first to download filings.`
        };
      }

      // Prepare analysis prompt
      const analysisPrompt = `${DOROTHY_TASK_PROMPTS.analyze_filing}

COMPANY: ${filing.company_name}
FILING: ${filing.filing_type} filed on ${filing.filing_date}
ACCESSION NUMBER: ${filing.accession_number}

${question ? `SPECIFIC QUESTION: ${question}` : ''}

FILING DATA:
${this.truncateContent(filing.raw_content, 15000)}

Provide your analysis.`;

      const analysis = await this.callLLM(analysisPrompt, 0.3); // Low temperature for accuracy

      return {
        success: true,
        data: {
          company: filing.company_name,
          filing: {
            type: filing.filing_type,
            date: filing.filing_date,
            accessionNumber: filing.accession_number
          },
          analysis,
          source: `SEC ${filing.filing_type} filed ${filing.filing_date}`
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Filing analysis failed: ${error.message}`
      };
    }
  }

  /**
   * Extract specific financial data from filings
   */
  private async extractFinancials(params: any, context: AgentContext): Promise<TaskResult> {
    const { ticker, cik, dataPoints = [], filingType = '10-K' } = params;

    try {
      const filing = await this.getLatestFiling(ticker, cik, filingType);

      if (!filing) {
        return {
          success: false,
          error: `No ${filingType} filing found. Use fetch_sec_data first.`
        };
      }

      const extractPrompt = `${DOROTHY_TASK_PROMPTS.extract_data}

COMPANY: ${filing.company_name}
FILING: ${filing.filing_type} filed on ${filing.filing_date}

REQUESTED DATA POINTS:
${dataPoints.map((dp: string, i: number) => `${i + 1}. ${dp}`).join('\n')}

FILING CONTENT:
${this.truncateContent(filing.raw_content, 15000)}

Extract the requested data points. For each:
- Provide exact value from filing
- Include units
- Cite specific section/page
- If not found, explicitly state "Data not available in this filing"`;

      const extraction = await this.callLLM(extractPrompt, 0.2); // Very low temperature for precision

      return {
        success: true,
        data: {
          company: filing.company_name,
          filing: {
            type: filing.filing_type,
            date: filing.filing_date
          },
          extraction,
          dataPointsRequested: dataPoints
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Financial extraction failed: ${error.message}`
      };
    }
  }

  /**
   * Calculate financial ratios from SEC data
   */
  private async calculateRatios(params: any, context: AgentContext): Promise<TaskResult> {
    const { ticker, cik, ratioTypes = ['profitability', 'liquidity', 'leverage'], filingType = '10-K' } = params;

    try {
      const filing = await this.getLatestFiling(ticker, cik, filingType);

      if (!filing) {
        return {
          success: false,
          error: `No ${filingType} filing found. Use fetch_sec_data first.`
        };
      }

      const ratioPrompt = `${DOROTHY_TASK_PROMPTS.calculate_ratios}

COMPANY: ${filing.company_name}
FILING: ${filing.filing_type} filed on ${filing.filing_date}

REQUESTED RATIO TYPES: ${ratioTypes.join(', ')}

FILING CONTENT:
${this.truncateContent(filing.raw_content, 15000)}

Calculate the requested financial ratios:
- Show formula
- Show source data from filing
- Calculate result
- Provide interpretation
- If data not available, state explicitly`;

      const ratios = await this.callLLM(ratioPrompt, 0.3);

      return {
        success: true,
        data: {
          company: filing.company_name,
          filing: {
            type: filing.filing_type,
            date: filing.filing_date
          },
          ratios,
          ratioTypes
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Ratio calculation failed: ${error.message}`
      };
    }
  }

  /**
   * Compare financial performance across periods
   */
  private async comparePeriods(params: any, context: AgentContext): Promise<TaskResult> {
    const { ticker, cik, periods = 2, filingType = '10-K' } = params;

    try {
      // Get multiple filings
      const filings = await this.getRecentFilings(ticker, cik, filingType, periods);

      if (filings.length < 2) {
        return {
          success: false,
          error: `Need at least 2 ${filingType} filings for comparison. Found: ${filings.length}`
        };
      }

      const comparePrompt = `${DOROTHY_TASK_PROMPTS.compare_periods}

COMPANY: ${filings[0].company_name}
FILINGS TO COMPARE:
${filings.map((f: any, i: number) => `
Period ${i + 1}: ${f.filing_type} filed ${f.filing_date} (Report date: ${f.report_date})
`).join('\n')}

FILING DATA:
${filings.map((f: any, i: number) => `
=== PERIOD ${i + 1} ===
${this.truncateContent(f.raw_content, 8000)}
`).join('\n\n')}

Compare these periods:
- Revenue and growth trends
- Profitability changes
- Balance sheet movements
- Cash flow changes
- Key ratio trends
- Highlight significant changes`;

      const comparison = await this.callLLM(comparePrompt, 0.4);

      return {
        success: true,
        data: {
          company: filings[0].company_name,
          periodsCompared: filings.map((f: any) => ({
            type: f.filing_type,
            filingDate: f.filing_date,
            reportDate: f.report_date
          })),
          comparison
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Period comparison failed: ${error.message}`
      };
    }
  }

  /**
   * Assess overall financial health
   */
  private async assessHealth(params: any, context: AgentContext): Promise<TaskResult> {
    const { ticker, cik } = params;

    try {
      // Get latest 10-K and 10-Q
      const annual = await this.getLatestFiling(ticker, cik, '10-K');
      const quarterly = await this.getLatestFiling(ticker, cik, '10-Q');

      if (!annual && !quarterly) {
        return {
          success: false,
          error: 'No SEC filings found. Use fetch_sec_data first.'
        };
      }

      const filings = [annual, quarterly].filter(Boolean);

      const healthPrompt = `${DOROTHY_TASK_PROMPTS.assess_health}

COMPANY: ${filings[0].company_name}

AVAILABLE FILINGS:
${filings.map((f: any) => `- ${f.filing_type} filed ${f.filing_date}`).join('\n')}

FILING DATA:
${filings.map((f: any) => `
=== ${f.filing_type} (${f.filing_date}) ===
${this.truncateContent(f.raw_content, 10000)}
`).join('\n\n')}

Provide comprehensive financial health assessment:
1. Overall financial position (Strong/Moderate/Weak)
2. Key strengths (with supporting data)
3. Key weaknesses (with supporting data)
4. Material risk factors from filings
5. Recent trends and trajectory
6. Data limitations and gaps`;

      const assessment = await this.callLLM(healthPrompt, 0.4);

      return {
        success: true,
        data: {
          company: filings[0].company_name,
          filings: filings.map((f: any) => ({
            type: f.filing_type,
            date: f.filing_date
          })),
          assessment
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Health assessment failed: ${error.message}`
      };
    }
  }

  /**
   * Answer free-form questions using ONLY SEC data
   */
  private async answerQuestion(params: any, context: AgentContext): Promise<TaskResult> {
    const { ticker, cik, question, filingType } = params;

    try {
      // Get relevant filings
      let filings;
      if (filingType) {
        const filing = await this.getLatestFiling(ticker, cik, filingType);
        filings = filing ? [filing] : [];
      } else {
        // Get both 10-K and 10-Q
        const annual = await this.getLatestFiling(ticker, cik, '10-K');
        const quarterly = await this.getLatestFiling(ticker, cik, '10-Q');
        filings = [annual, quarterly].filter(Boolean);
      }

      if (filings.length === 0) {
        return {
          success: false,
          error: 'No SEC filings available. Use fetch_sec_data first to download filings.'
        };
      }

      const answerPrompt = `QUESTION: ${question}

COMPANY: ${filings[0].company_name}

AVAILABLE SEC FILINGS:
${filings.map((f: any) => `- ${f.filing_type} filed ${f.filing_date}`).join('\n')}

SEC FILING DATA:
${filings.map((f: any) => `
=== ${f.filing_type} (${f.filing_date}) ===
${this.truncateContent(f.raw_content, 10000)}
`).join('\n\n')}

Answer the question using ONLY the SEC filing data provided above.
If the answer is not in the filings, explicitly state "This information is not available in the SEC filings."`;

      const answer = await this.callLLM(answerPrompt, 0.3);

      return {
        success: true,
        data: {
          company: filings[0].company_name,
          question,
          answer,
          sourcesUsed: filings.map((f: any) => ({
            type: f.filing_type,
            date: f.filing_date,
            accessionNumber: f.accession_number
          }))
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Question answering failed: ${error.message}`
      };
    }
  }

  // Helper methods

  private async getLatestFiling(ticker: string | undefined, cik: string | undefined, filingType: string): Promise<any> {
    const companyFilter = ticker
      ? `AND c.name LIKE '%' || (SELECT title FROM shared.companies WHERE name ILIKE $2) || '%'`
      : cik
      ? `AND sf.cik = $2`
      : '';

    const result = await query(`
      SELECT sf.*, c.name as company_name
      FROM dorothy_finance.sec_filings sf
      JOIN shared.companies c ON sf.company_id = c.id
      WHERE sf.filing_type = $1
      ${companyFilter}
      ORDER BY sf.filing_date DESC
      LIMIT 1
    `, companyFilter ? [filingType, ticker || cik] : [filingType]);

    return result.rows[0] || null;
  }

  private async getFilingByDate(ticker: string | undefined, cik: string | undefined, filingType: string, date: string): Promise<any> {
    const result = await query(`
      SELECT sf.*, c.name as company_name
      FROM dorothy_finance.sec_filings sf
      JOIN shared.companies c ON sf.company_id = c.id
      WHERE sf.filing_type = $1 AND sf.filing_date = $2
      ${ticker ? `AND c.name ILIKE '%' || $3 || '%'` : cik ? `AND sf.cik = $3` : ''}
      LIMIT 1
    `, [filingType, date, ticker || cik]);

    return result.rows[0] || null;
  }

  private async getRecentFilings(ticker: string | undefined, cik: string | undefined, filingType: string, limit: number): Promise<any[]> {
    const result = await query(`
      SELECT sf.*, c.name as company_name
      FROM dorothy_finance.sec_filings sf
      JOIN shared.companies c ON sf.company_id = c.id
      WHERE sf.filing_type = $1
      ${ticker ? `AND c.name ILIKE '%' || $2 || '%'` : cik ? `AND sf.cik = $2` : ''}
      ORDER BY sf.filing_date DESC
      LIMIT $${ticker || cik ? '3' : '2'}
    `, ticker || cik ? [filingType, ticker || cik, limit] : [filingType, limit]);

    return result.rows;
  }

  private truncateContent(content: string, maxChars: number): string {
    if (content.length <= maxChars) {
      return content;
    }

    // Try to truncate at a reasonable point
    const truncated = content.substring(0, maxChars);
    const lastPeriod = truncated.lastIndexOf('.');

    if (lastPeriod > maxChars * 0.8) {
      return truncated.substring(0, lastPeriod + 1) + '\n\n[Content truncated for length]';
    }

    return truncated + '\n\n[Content truncated for length]';
  }
}
