import { BaseAgent } from './BaseAgent';
import { AgentContext, TaskResult } from '../types/agent';
import { query } from '../db/connection';
import { DOROTHY_SYSTEM_PROMPT, DOROTHY_TASK_PROMPTS } from '../prompts/dorothy';
import { secClient, SECFiling, SECCompanyInfo } from '../services/SECClient';
import { jinaClient } from '../services/JinaAIClient';
import axios from 'axios';

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
        },
        {
          name: 'analyze_text',
          description: 'Analyze provided SEC filing text (for testing/demo purposes)'
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
      case 'analyze_text':
        return await this.analyzeText(params, context);
      default:
        return {
          success: false,
          error: `Unknown task: ${task}. Available: fetch_sec_data, analyze_filing, extract_financials, calculate_ratios, compare_periods, assess_health, answer_question, analyze_text`
        };
    }
  }

  /**
   * Fetch SEC filings for a company
   * Returns downloaded filings with markdown content for immediate use
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

      // Try to get or create company in database (may fail in Vercel)
      let companyId = 0;
      try {
        const companyResult = await query(`
          INSERT INTO companies (name, industry, website, description)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `, [companyInfo.name, 'Public Company', '', `CIK: ${companyInfo.cik}`]);
        companyId = companyResult.rows[0]?.id || 0;
      } catch (dbError) {
        console.log('[Dorothy] DB write failed (read-only mode), continuing with in-memory data');
      }

      // Fetch filings
      const filings = await secClient.getFilings(companyInfo.cik, filingType, limit);

      if (filings.length === 0) {
        return {
          success: true,
          data: {
            message: `No ${filingType || 'filings'} found for ${companyInfo.name}`,
            company: companyInfo,
            filings: [],
            filingsDownloaded: 0,
            filingsTotal: 0
          }
        };
      }

      // Download and optionally store each filing
      const downloadedFilings = [];
      for (const filing of filings) {
        try {
          console.log(`[Dorothy] Downloading ${filing.filingType} from ${filing.filingDate}...`);
          const content = await secClient.downloadFiling(filing);

          // Convert to markdown using Jina AI
          let markdownContent: string | null = null;
          try {
            console.log(`[Dorothy] Converting to markdown with Jina AI...`);
            const jinaResult = await jinaClient.convertURL(filing.fileUrl);
            markdownContent = jinaResult.markdown;
            console.log(`[Dorothy] ✅ Markdown conversion successful (${jinaResult.tokensUsed} tokens)`);
          } catch (jinaError) {
            console.log('[Dorothy] Markdown conversion failed, using raw content');
          }

          // Try to store in DB (will fail in Vercel read-only mode, but that's OK)
          try {
            if (companyId > 0) {
              await secClient.storeFiling(companyId, filing, content);
            }
          } catch (dbError) {
            console.log('[Dorothy] DB storage failed (read-only mode), using in-memory data');
          }

          // Add to in-memory results with all data needed for LLM
          downloadedFilings.push({
            filing_type: filing.filingType,
            filing_date: filing.filingDate,
            report_date: filing.reportDate,
            accession_number: filing.accessionNumber,
            company_name: companyInfo.name,
            cik: filing.cik,
            raw_content: content,
            markdown_content: markdownContent,
            file_url: filing.fileUrl
          });
        } catch (downloadError: any) {
          console.error(`[Dorothy] Failed to download filing: ${downloadError.message}`);
        }
      }

      return {
        success: true,
        data: {
          company: companyInfo,
          filingsDownloaded: downloadedFilings.length,
          filingsTotal: filings.length,
          filings: downloadedFilings  // Return actual filing data, not just metadata
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
   * Auto-downloads SEC filings if not available in DB
   */
  private async answerQuestion(params: any, context: AgentContext): Promise<TaskResult> {
    const { ticker, cik, question, filingType } = params;

    console.log('\n┌─────────────────────────────────────────');
    console.log('│ [Dorothy] answer_question 시작');
    console.log('│ 질문:', question);
    console.log('└─────────────────────────────────────────');

    try {
      // Extract company info from question if not provided
      let companyTicker = ticker;
      let companyCIK = cik;

      if (!companyTicker && !companyCIK) {
        console.log('\n[Dorothy] 1️⃣  회사명 추출 중...');
        console.log('[Dorothy] - LLM을 사용하여 질문에서 회사 정보 추출');

        const extractedInfo = await this.extractCompanyFromQuestion(question);
        if (extractedInfo) {
          companyTicker = extractedInfo.ticker;
          companyCIK = extractedInfo.cik;
          console.log(`[Dorothy] ✓ 추출 완료:`);
          console.log(`[Dorothy]   - 회사명: ${extractedInfo.companyName || 'N/A'}`);
          console.log(`[Dorothy]   - Ticker: ${companyTicker || 'N/A'}`);
          console.log(`[Dorothy]   - CIK: ${companyCIK || 'N/A'}`);
        } else {
          console.log('[Dorothy] ✗ 회사 정보 추출 실패');
        }
      } else {
        console.log(`\n[Dorothy] 1️⃣  회사 정보 (파라미터로 제공됨):`);
        console.log(`[Dorothy]   - Ticker: ${companyTicker || 'N/A'}`);
        console.log(`[Dorothy]   - CIK: ${companyCIK || 'N/A'}`);
      }

      if (!companyTicker && !companyCIK) {
        console.log('[Dorothy] ❌ 회사 식별 실패 - 종료');
        return {
          success: false,
          error: '질문에서 회사명이나 티커를 찾을 수 없어. 회사명을 명확하게 알려줘.'
        };
      }

      // Get relevant filings
      console.log(`\n[Dorothy] 2️⃣  DB에서 SEC filing 검색 중...`);
      console.log(`[Dorothy] - 검색 키: ${companyTicker || companyCIK}`);
      console.log(`[Dorothy] - Filing 타입: ${filingType || '10-K + 10-Q'}`);

      let filings;
      if (filingType) {
        const filing = await this.getLatestFiling(companyTicker, companyCIK, filingType);
        filings = filing ? [filing] : [];
        console.log(`[Dorothy] - ${filingType}: ${filing ? '발견 ✓' : '없음 ✗'}`);
      } else {
        // Get both 10-K and 10-Q
        const annual = await this.getLatestFiling(companyTicker, companyCIK, '10-K');
        const quarterly = await this.getLatestFiling(companyTicker, companyCIK, '10-Q');
        filings = [annual, quarterly].filter(Boolean);
        console.log(`[Dorothy] - 10-K filing: ${annual ? '발견 ✓' : '없음 ✗'}`);
        console.log(`[Dorothy] - 10-Q filing: ${quarterly ? '발견 ✓' : '없음 ✗'}`);
      }

      console.log(`[Dorothy] ✓ DB 검색 결과: ${filings.length}개 filing 발견`);

      // Auto-download SEC data if not available
      if (filings.length === 0) {
        console.log(`\n[Dorothy] 3️⃣  SEC Edgar에서 자동 다운로드 시작...`);
        console.log(`[Dorothy] - 대상: ${companyTicker || companyCIK}`);
        console.log(`[Dorothy] - Filing 타입: ${filingType || 'all (10-K, 10-Q)'}`);
        console.log(`[Dorothy] - 다운로드 limit: 3`);

        const fetchResult = await this.fetchSECData(
          {
            ticker: companyTicker,
            cik: companyCIK,
            filingType: filingType || undefined,
            limit: 3
          },
          context
        );

        if (!fetchResult.success) {
          console.log(`[Dorothy] ✗ SEC 다운로드 실패: ${fetchResult.error}`);
          return {
            success: false,
            error: `SEC 자료를 찾을 수 없어: ${fetchResult.error}`
          };
        }

        console.log(`[Dorothy] ✓ SEC 다운로드 완료: ${fetchResult.data.filingsDownloaded}개 filing`);
        console.log(`[Dorothy] - 다운로드한 회사: ${fetchResult.data.company.name}`);
        console.log(`[Dorothy] - CIK: ${fetchResult.data.company.cik}`);

        // Use downloaded filings directly (no DB re-check needed)
        console.log(`\n[Dorothy] 4️⃣  다운로드된 filing 데이터 사용...`);

        filings = fetchResult.data.filings || [];

        if (filings.length === 0) {
          console.log('[Dorothy] ❌ 다운로드된 filing 없음');
          return {
            success: false,
            error: `SEC filing을 다운로드했지만 사용 가능한 데이터가 없어.`
          };
        }

        console.log(`[Dorothy] ✓ ${filings.length}개 filing 메모리에서 사용 가능`);
        filings.forEach((f: any, idx: number) => {
          console.log(`[Dorothy]   ${idx + 1}. ${f.filing_type} (${f.filing_date}) - ${f.markdown_content ? 'Markdown ✓' : 'Raw only'}`);
        });
      }

      console.log(`\n[Dorothy] 5️⃣  LLM 분석 시작...`);
      console.log(`[Dorothy] - 회사: ${filings[0].company_name}`);
      console.log(`[Dorothy] - 사용할 filing 수: ${filings.length}`);

      filings.forEach((f: any, idx: number) => {
        console.log(`[Dorothy]   ${idx + 1}. ${f.filing_type} (${f.filing_date})`);
        console.log(`[Dorothy]      - Accession: ${f.accession_number}`);
        console.log(`[Dorothy]      - Markdown: ${f.markdown_content ? 'Yes ✓' : 'No, using raw_content'}`);
        console.log(`[Dorothy]      - Content length: ${(f.markdown_content || f.raw_content)?.length || 0} chars`);
      });

      const answerPrompt = `QUESTION: ${question}

COMPANY: ${filings[0].company_name}

AVAILABLE SEC FILINGS:
${filings.map((f: any) => `- ${f.filing_type} filed ${f.filing_date}`).join('\n')}

SEC FILING DATA:
${filings.map((f: any) => `
=== ${f.filing_type} (${f.filing_date}) ===
${this.truncateContent(f.markdown_content || f.raw_content, 10000)}
`).join('\n\n')}

Answer the question using ONLY the SEC filing data provided above.
If the answer is not in the filings, explicitly state "이 정보는 SEC filing에 없어, Master."`;

      console.log(`[Dorothy] - Prompt 길이: ${answerPrompt.length} chars`);
      console.log(`[Dorothy] - LLM 호출 중... (temperature: 0.3)`);

      const answer = await this.callLLM(answerPrompt, 0.3);

      console.log(`[Dorothy] ✓ LLM 분석 완료`);
      console.log(`[Dorothy] - 응답 길이: ${answer.length} chars`);
      console.log(`[Dorothy] - Sources: ${filings.map((f: any) => `${f.filing_type} (${f.filing_date})`).join(', ')}`);

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
          })),
          statusLog: [
            `✓ 회사 추출: ${filings[0].company_name}`,
            `✓ SEC filing ${filings.length}개 사용`,
            `✓ 분석 완료`
          ]
        }
      };
    } catch (error: any) {
      console.error('\n[Dorothy] ❌ FATAL ERROR in answerQuestion:');
      console.error('[Dorothy] Error message:', error.message);
      console.error('[Dorothy] Stack trace:', error.stack);

      return {
        success: false,
        error: `Question answering failed: ${error.message}`
      };
    }
  }

  /**
   * Analyze provided SEC filing text (for testing/demo when SEC API unavailable)
   */
  private async analyzeText(params: any, context: AgentContext): Promise<TaskResult> {
    const { company, filingType, filingDate, text, question } = params;

    if (!text) {
      return {
        success: false,
        error: 'SEC filing text is required'
      };
    }

    try {
      const analysisPrompt = `COMPANY: ${company}
FILING: ${filingType} filed on ${filingDate}

${question ? `QUESTION: ${question}` : 'Analyze this SEC filing.'}

SEC FILING DATA:
${this.truncateContent(text, 15000)}

Answer using ONLY the SEC filing data provided above.
If information is not in the filing, explicitly state "This information is not available in the SEC filing."
Cite specific sections and quote exact numbers.`;

      const analysis = await this.callLLM(analysisPrompt, 0.3); // Low temperature for accuracy

      return {
        success: true,
        data: {
          company,
          filing: {
            type: filingType,
            date: filingDate
          },
          analysis,
          source: `SEC ${filingType} filing dated ${filingDate}`
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Text analysis failed: ${error.message}`
      };
    }
  }

  // Helper methods

  /**
   * Extract company name/ticker from natural language question using LLM
   */
  private async extractCompanyFromQuestion(question: string): Promise<{ ticker?: string; cik?: string; companyName?: string } | null> {
    try {
      const extractPrompt = `Extract the company name or stock ticker from this question.

QUESTION: ${question}

Response format (JSON only, no explanation):
{
  "companyName": "Full company name if mentioned",
  "ticker": "Stock ticker symbol if mentioned or can be inferred",
  "cik": "CIK number if mentioned"
}

If no company is mentioned, respond with: {"companyName": null, "ticker": null, "cik": null}

Examples:
- "Vertical Aerospace의 재무 현황은?" → {"companyName": "Vertical Aerospace", "ticker": "EVTL", "cik": null}
- "AAPL 주가는?" → {"companyName": "Apple Inc", "ticker": "AAPL", "cik": null}
- "Tesla의 burn rate는?" → {"companyName": "Tesla", "ticker": "TSLA", "cik": null}

Now extract from the question above:`;

      const response = await this.callLLM(extractPrompt, 0.1); // Very low temperature for precision

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[Dorothy] Failed to extract company info - no JSON found in response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // If ticker found, try to get company info from SEC
      if (parsed.ticker) {
        const companyInfo = await secClient.getCompanyByTicker(parsed.ticker);
        if (companyInfo) {
          return {
            ticker: parsed.ticker,
            cik: companyInfo.cik,
            companyName: companyInfo.name
          };
        }
      }

      // If company name found, try fuzzy search
      if (parsed.companyName && !parsed.ticker) {
        // Try to find ticker by company name
        const companyInfo = await this.searchCompanyByName(parsed.companyName);
        if (companyInfo) {
          return {
            ticker: companyInfo.tickers[0],
            cik: companyInfo.cik,
            companyName: companyInfo.name
          };
        }
      }

      // Return whatever we got
      if (parsed.companyName || parsed.ticker || parsed.cik) {
        return {
          ticker: parsed.ticker || undefined,
          cik: parsed.cik || undefined,
          companyName: parsed.companyName || undefined
        };
      }

      return null;
    } catch (error) {
      console.error('[Dorothy] Error extracting company from question:', error);
      return null;
    }
  }

  /**
   * Search for company by name in SEC database
   */
  private async searchCompanyByName(companyName: string): Promise<SECCompanyInfo | null> {
    try {
      // SEC provides a ticker file we can search
      const response = await axios.get('https://www.sec.gov/files/company_tickers.json', {
        headers: {
          'User-Agent': 'WAR-ROOM Dorothy dorothy@war-room.ai'
        }
      });

      const companies = Object.values(response.data) as any[];
      const searchLower = companyName.toLowerCase();

      // Fuzzy match - look for company name containing search term
      const match = companies.find((c: any) =>
        c.title.toLowerCase().includes(searchLower) ||
        searchLower.includes(c.title.toLowerCase())
      );

      if (match) {
        return {
          cik: String(match.cik_str).padStart(10, '0'),
          name: match.title,
          tickers: [match.ticker],
          exchanges: []
        };
      }

      return null;
    } catch (error) {
      console.error('[Dorothy] Error searching company by name:', error);
      return null;
    }
  }

  private async getLatestFiling(ticker: string | undefined, cik: string | undefined, filingType: string): Promise<any> {
    try {
      let result;

      if (cik) {
        result = await query(`
          SELECT sf.*, c.name as company_name
          FROM sec_filings sf
          JOIN companies c ON sf.company_id = c.id
          WHERE sf.filing_type = ? AND sf.cik = ?
          ORDER BY sf.filing_date DESC
          LIMIT 1
        `, [filingType, cik]);
      } else if (ticker) {
        result = await query(`
          SELECT sf.*, c.name as company_name
          FROM sec_filings sf
          JOIN companies c ON sf.company_id = c.id
          WHERE sf.filing_type = ? AND (c.name LIKE ? OR c.name LIKE ?)
          ORDER BY sf.filing_date DESC
          LIMIT 1
        `, [filingType, `%${ticker}%`, `%${ticker.toUpperCase()}%`]);
      } else {
        result = await query(`
          SELECT sf.*, c.name as company_name
          FROM sec_filings sf
          JOIN companies c ON sf.company_id = c.id
          WHERE sf.filing_type = ?
          ORDER BY sf.filing_date DESC
          LIMIT 1
        `, [filingType]);
      }

      return result.rows[0] || null;
    } catch (error) {
      console.error('[Dorothy] getLatestFiling error:', error);
      return null;
    }
  }

  private async getFilingByDate(ticker: string | undefined, cik: string | undefined, filingType: string, date: string): Promise<any> {
    try {
      let result;

      if (cik) {
        result = await query(`
          SELECT sf.*, c.name as company_name
          FROM sec_filings sf
          JOIN companies c ON sf.company_id = c.id
          WHERE sf.filing_type = ? AND sf.filing_date = ? AND sf.cik = ?
          LIMIT 1
        `, [filingType, date, cik]);
      } else if (ticker) {
        result = await query(`
          SELECT sf.*, c.name as company_name
          FROM sec_filings sf
          JOIN companies c ON sf.company_id = c.id
          WHERE sf.filing_type = ? AND sf.filing_date = ? AND c.name LIKE ?
          LIMIT 1
        `, [filingType, date, `%${ticker}%`]);
      } else {
        result = await query(`
          SELECT sf.*, c.name as company_name
          FROM sec_filings sf
          JOIN companies c ON sf.company_id = c.id
          WHERE sf.filing_type = ? AND sf.filing_date = ?
          LIMIT 1
        `, [filingType, date]);
      }

      return result.rows[0] || null;
    } catch (error) {
      console.error('[Dorothy] getFilingByDate error:', error);
      return null;
    }
  }

  private async getRecentFilings(ticker: string | undefined, cik: string | undefined, filingType: string, limit: number): Promise<any[]> {
    try {
      let result;

      if (cik) {
        result = await query(`
          SELECT sf.*, c.name as company_name
          FROM sec_filings sf
          JOIN companies c ON sf.company_id = c.id
          WHERE sf.filing_type = ? AND sf.cik = ?
          ORDER BY sf.filing_date DESC
          LIMIT ?
        `, [filingType, cik, limit]);
      } else if (ticker) {
        result = await query(`
          SELECT sf.*, c.name as company_name
          FROM sec_filings sf
          JOIN companies c ON sf.company_id = c.id
          WHERE sf.filing_type = ? AND c.name LIKE ?
          ORDER BY sf.filing_date DESC
          LIMIT ?
        `, [filingType, `%${ticker}%`, limit]);
      } else {
        result = await query(`
          SELECT sf.*, c.name as company_name
          FROM sec_filings sf
          JOIN companies c ON sf.company_id = c.id
          WHERE sf.filing_type = ?
          ORDER BY sf.filing_date DESC
          LIMIT ?
        `, [filingType, limit]);
      }

      return result.rows;
    } catch (error) {
      console.error('[Dorothy] getRecentFilings error:', error);
      return [];
    }
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
