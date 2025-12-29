import { BaseAgent } from './BaseAgent';
import { AgentContext, TaskResult } from '../types/agent';
import { query } from '../db/connection';
import { DOROTHY_SYSTEM_PROMPT, DOROTHY_TASK_PROMPTS } from '../prompts/dorothy';
import { secClient, SECFiling, SECCompanyInfo } from '../services/SECClient';
import { jinaClient } from '../services/JinaAIClient';
import { supabase, checkHelenaDataAvailability, isSupabaseConfigured } from '../lib/supabase';
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
    const { ticker, cik, filingType, filingTypes, year, limit = 10 } = params;

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

      // Determine filing types to fetch
      // Priority: filingTypes > filingType > default comprehensive list
      let typesToFetch: string[] | undefined;
      if (filingTypes) {
        typesToFetch = Array.isArray(filingTypes) ? filingTypes : [filingTypes];
      } else if (filingType) {
        typesToFetch = [filingType];
      } else {
        // Default: fetch only financial statement filings (exclude 8-K event reports and 6-K)
        // 10-K: US annual reports, 10-Q: US quarterly reports, 20-F: foreign annual reports
        // Note: 8-K (event reports) and 6-K (foreign current) excluded to reduce noise and stay within timeout
        typesToFetch = ['10-K', '10-Q', '20-F'];
      }

      console.log(`[Dorothy] 📊 Fetching SEC filings:`);
      console.log(`[Dorothy] - Types: ${typesToFetch.join(', ')}`);
      console.log(`[Dorothy] - Year: ${year || 'all'}`);
      console.log(`[Dorothy] - Limit: ${limit}`);

      // Fetch filings with new parameters
      const filings = await secClient.getFilings(companyInfo.cik, typesToFetch, limit, year);

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
    const { ticker, cik, question, filingType, onProgress, history = [] } = params;

    // Progress callback helper
    const progress = (message: string) => {
      if (onProgress && typeof onProgress === 'function') {
        onProgress(message);
      }
    };

    console.log('\n┌─────────────────────────────────────────');
    console.log('│ [Dorothy] answer_question 시작');
    console.log('│ 질문:', question);
    console.log('└─────────────────────────────────────────');

    try {
      // Extract company info and year from question if not provided
      let companyTicker = ticker;
      let companyCIK = cik;
      let companyName = '';
      let extractedYear: number | undefined;

      if (!companyTicker && !companyCIK) {
        progress('회사명 추출 중...');
        console.log('\n[Dorothy] 1️⃣  회사명 및 연도 추출 중...');
        console.log('[Dorothy] - LLM을 사용하여 질문에서 회사 정보 및 연도 추출');

        const extractedInfo = await this.extractCompanyFromQuestion(question);
        if (extractedInfo) {
          companyTicker = extractedInfo.ticker;
          companyCIK = extractedInfo.cik;
          companyName = extractedInfo.companyName || '';
          extractedYear = extractedInfo.year;
          console.log(`[Dorothy] ✓ 추출 완료:`);
          console.log(`[Dorothy]   - 회사명: ${companyName || 'N/A'}`);
          console.log(`[Dorothy]   - Ticker: ${companyTicker || 'N/A'}`);
          console.log(`[Dorothy]   - CIK: ${companyCIK || 'N/A'}`);
          console.log(`[Dorothy]   - 연도: ${extractedYear || '전체 기간'}`);
        } else {
          console.log('[Dorothy] ✗ 회사 정보 추출 실패');
        }
      } else {
        console.log(`\n[Dorothy] 1️⃣  회사 정보 (파라미터로 제공됨):`);
        console.log(`[Dorothy]   - Ticker: ${companyTicker || 'N/A'}`);
        console.log(`[Dorothy]   - CIK: ${companyCIK || 'N/A'}`);
      }

      // ============================================
      // Try to extract ticker from conversation history (like Helena)
      // ============================================
      if (!companyTicker && history && history.length > 0) {
        console.log('[Dorothy] 💡 Ticker not found in question, searching conversation history...');

        // Reserved words that are NOT tickers (same as Helena)
        const RESERVED_WORDS = new Set([
          'SEC', 'API', 'USA', 'CEO', 'CFO', 'IPO', 'ETF', 'LLC', 'INC', 'LTD',
          'THE', 'AND', 'FOR', 'WITH', 'DATA', 'YEAR', 'FILE'
        ]);

        // Search user messages in reverse order (most recent first)
        for (let i = history.length - 1; i >= 0; i--) {
          const msg = history[i];
          if (msg.role === 'user') {
            // Extract all potential tickers (2-5 uppercase letters)
            const potentialTickers = msg.content.match(/\b[A-Z]{2,5}\b/g);
            if (potentialTickers) {
              // Find first valid ticker (not a reserved word)
              for (const candidate of potentialTickers) {
                if (!RESERVED_WORDS.has(candidate)) {
                  companyTicker = candidate;
                  console.log(`[Dorothy] ✅ Found ticker in history: ${companyTicker} (from: "${msg.content.substring(0, 50)}...")`);
                  break;
                }
              }
              if (companyTicker) break;
            }
          }
        }

        if (!companyTicker) {
          console.log('[Dorothy] ⚠️ No ticker found in conversation history');
        }
      }

      // Use company name as fallback if ticker/CIK not found
      const searchTerm = companyTicker || companyCIK || companyName;

      if (!searchTerm) {
        console.log('[Dorothy] ❌ 회사 식별 실패 - 종료');
        return {
          success: false,
          error: '질문에서 회사명이나 티커를 찾을 수 없어. 회사명을 명확하게 알려줘.'
        };
      }

      console.log(`[Dorothy] - 검색어: ${searchTerm}`);

      // =====================================================
      // Helena Data Availability Check (Goldman Sachs-grade fast path)
      // =====================================================
      if (isSupabaseConfigured() && companyTicker) {
        progress('Helena 데이터 확인 중...');
        console.log(`\n[Dorothy] 🔍 Helena 데이터 availability 체크...`);

        try {
          const helenaAvailability = await checkHelenaDataAvailability(
            companyTicker,
            extractedYear
          );

          if (helenaAvailability.available) {
            console.log(`[Dorothy] ✅ Helena 데이터 발견!`);
            console.log(`[Dorothy]   - Filings: ${helenaAvailability.filings_count}`);
            console.log(`[Dorothy]   - Metrics: ${helenaAvailability.metrics_count}`);
            console.log(`[Dorothy]   - Last update: ${helenaAvailability.last_update}`);

            progress('Helena DB에서 빠른 조회 중... (0.1초)');

            // ============================================
            // Goldman Sachs Fast Path - Use Helena DB
            // ============================================
            try {
              // Query financials from Helena DB
              const helenaFinancials = await supabase
                .from('company_financials')
                .select('*')
                .eq('ticker', companyTicker.toUpperCase())
                .order('period_end_date', { ascending: false })
                .limit(100);

              // Query sections from Helena DB
              const helenaSections = await supabase
                .from('filing_sections')
                .select('*')
                .eq('ticker', companyTicker.toUpperCase())
                .order('filing_date', { ascending: false })
                .limit(10);

              if (helenaFinancials.data && helenaFinancials.data.length > 0) {
                console.log(`[Dorothy] ✅ Helena DB에서 ${helenaFinancials.data.length}개 metrics 조회 완료`);
                console.log(`[Dorothy] ✅ Helena DB에서 ${helenaSections.data?.length || 0}개 sections 조회 완료`);

                // Analyze data coverage (어떤 년도/분기가 있는지)
                const dataCoverage = this.analyzeDataCoverage(helenaFinancials.data, companyTicker);

                // Format Helena data for LLM analysis
                const financialsContext = this.formatHelenaFinancials(helenaFinancials.data);
                const sectionsContext = this.formatHelenaSections(helenaSections.data || []);

                // Combine context
                const helenaContext = `
# Helena Database - Pre-processed Financial Data

## XBRL Financial Metrics (100% Accurate)
${financialsContext}

## Filing Sections
${sectionsContext}

**Important:** 위 숫자들은 XBRL에서 직접 파싱된 100% 정확한 데이터야. 절대 추정하거나 근사값을 쓰지 마.
`;

                // Use Helena data for analysis
                progress('Helena 데이터로 분석 중...');

                const analysisPrompt = `${question}\n\n${helenaContext}`;
                const response = await this.callLLM(analysisPrompt, 0.3);

                console.log(`[Dorothy] ✓ Helena 데이터 기반 분석 완료`);

                // Build comprehensive answer with data coverage and sources
                const coverageReport = this.formatDataCoverageReport(dataCoverage);
                const sourcesList = this.formatSourcesList(helenaFinancials.data);

                const fullAnswer = `${response}\n\n---\n${coverageReport}\n\n${sourcesList}`;

                return {
                  success: true,
                  data: {
                    answer: fullAnswer,
                    sources: helenaFinancials.data.map((m: any) => ({
                      filing_type: m.filing_type,
                      filing_date: m.filing_date,
                      accession: m.filing_accession,
                      metric: m.metric_name,
                      xbrl_tag: m.xbrl_tag
                    })),
                    dataSource: 'helena_db',
                    executionTime: '< 1 second',
                    metricsUsed: helenaFinancials.data.length,
                    dataCoverage  // 데이터 완전성 정보
                  }
                };
              } else {
                // ============================================
                // Helena DB에 metrics 없음 - 에러 반환
                // ============================================
                console.log(`[Dorothy] ❌ Helena DB에 XBRL metrics 없음`);

                return {
                  success: false,
                  error: `❌ Helena DB에 ${companyTicker} XBRL 데이터가 없어.\n\n` +
                         `**문제:** Helena가 ${helenaAvailability.filings_count}개 filing을 다운로드했지만, XBRL 파싱에 실패했어.\n\n` +
                         `**해결 방법:**\n` +
                         `1. "@Helena ${companyTicker} 데이터 준비해줘" 다시 실행 (forceRefresh)\n` +
                         `2. Helena가 XBRL 파싱을 완료할 때까지 대기\n` +
                         `3. XBRL 파싱 성공하면 정확한 분기별 매출 제공 가능\n\n` +
                         `**현재 상태:**\n` +
                         `- Filings: ${helenaAvailability.filings_count}개 ✅\n` +
                         `- XBRL Metrics: 0개 ❌\n\n` +
                         `💡 Helena의 XBRL 파싱이 완료되면 Goldman Sachs-grade 정확도로 답변할 수 있어!`
                };
              }
            } catch (helenaError: any) {
              console.warn(`[Dorothy] ⚠️ Helena DB 조회 실패: ${helenaError.message}`);

              return {
                success: false,
                error: `❌ Helena DB 조회 중 오류 발생: ${helenaError.message}\n\n` +
                       `**해결 방법:**\n` +
                       `1. Supabase 연결 확인\n` +
                       `2. "@Helena ${companyTicker} 데이터 준비해줘" 다시 실행`
              };
            }
          } else {
            // ============================================
            // Helena 데이터 없음 - 에러 반환 (수동으로 Helena 실행 필요)
            // ============================================
            console.log(`[Dorothy] ❌ Helena DB에 ${companyTicker} 데이터 없음`);

            return {
              success: false,
              error: `❌ Helena DB에 ${companyTicker} 데이터가 없어.\n\n` +
                     `**해결 방법:**\n` +
                     `먼저 Helena로 데이터를 준비해야 해:\n\n` +
                     `\`\`\`\n` +
                     `@Helena ${companyTicker} 데이터 준비해줘\n` +
                     `\`\`\`\n\n` +
                     `**Helena가 하는 일:**\n` +
                     `- 3년치 SEC filings (10-K, 10-Q) 다운로드\n` +
                     `- XBRL 파싱 → 100% 정확한 재무 데이터\n` +
                     `- DB에 전처리된 데이터 저장\n\n` +
                     `**한번만 실행하면:**\n` +
                     `이후 Dorothy는 DB에서 1초 안에 분기별/연도별 복합 분석 가능! 🚀`
            };
          }
        } catch (error: any) {
          console.log(`[Dorothy] ⚠️ Helena 체크 실패: ${error.message}`);

          return {
            success: false,
            error: `❌ Helena availability 체크 실패: ${error.message}\n\n` +
                   `Supabase 연결을 확인해줘.`
          };
        }
      } else if (!isSupabaseConfigured()) {
        console.log(`[Dorothy] ℹ️ Supabase 미설정 - Helena 기능 비활성화`);

        return {
          success: false,
          error: `❌ Supabase가 설정되지 않아서 Helena를 사용할 수 없어.\n\n` +
                 `**현재 상태:** Fallback 모드 비활성화\n\n` +
                 `Dorothy는 Helena DB의 XBRL 데이터만 사용해서 100% 정확한 답변을 제공해.\n` +
                 `Supabase를 설정하고 Helena로 데이터를 준비해줘.`
        };
      }

      // ============================================
      // 여기서 return되지 않았다면 Helena 데이터 사용 성공
      // (fallback 로직은 완전히 제거됨)
      // ============================================

      throw new Error('Unexpected flow - should have returned from Helena path');
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
   * Extract company name/ticker and year from natural language question using LLM
   */
  private async extractCompanyFromQuestion(question: string): Promise<{ ticker?: string; cik?: string; companyName?: string; year?: number } | null> {
    try {
      const extractPrompt = `Extract the company name, stock ticker, and year (if mentioned) from this question.

QUESTION: ${question}

Response format (JSON only, no explanation):
{
  "companyName": "Full company name if mentioned",
  "ticker": "Stock ticker symbol if mentioned or can be inferred",
  "cik": "CIK number if mentioned",
  "year": "4-digit year if mentioned (e.g., 2024, 2023)"
}

If no company is mentioned, respond with: {"companyName": null, "ticker": null, "cik": null, "year": null}

Examples:
- "Vertical Aerospace의 재무 현황은?" → {"companyName": "Vertical Aerospace", "ticker": "EVTL", "cik": null, "year": null}
- "AAPL 2024년 실적은?" → {"companyName": "Apple Inc", "ticker": "AAPL", "cik": null, "year": 2024}
- "Tesla의 24년 burn rate는?" → {"companyName": "Tesla", "ticker": "TSLA", "cik": null, "year": 2024}
- "2023년 NVDA 재무제표" → {"companyName": "NVIDIA", "ticker": "NVDA", "cik": null, "year": 2023}

Year extraction rules:
- "2024년", "2024" → 2024
- "24년" → 2024 (assume 20XX for 2-digit years)
- "23년" → 2023
- If no year mentioned → null

Now extract from the question above:`;

      const response = await this.callLLM(extractPrompt, 0.1); // Very low temperature for precision

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[Dorothy] Failed to extract company info - no JSON found in response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Parse year if present
      let year: number | undefined;
      if (parsed.year) {
        year = parseInt(String(parsed.year));
        // Validate year range (2000-2030)
        if (year < 100) {
          year = 2000 + year; // Convert 24 → 2024
        }
        if (year < 2000 || year > 2030) {
          console.warn(`[Dorothy] Invalid year extracted: ${year}, ignoring`);
          year = undefined;
        } else {
          console.log(`[Dorothy] ✓ Year extracted: ${year}`);
        }
      }

      // If ticker found, try to get company info from SEC
      if (parsed.ticker) {
        const companyInfo = await secClient.getCompanyByTicker(parsed.ticker);
        if (companyInfo) {
          return {
            ticker: parsed.ticker,
            cik: companyInfo.cik,
            companyName: companyInfo.name,
            year
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
            companyName: companyInfo.name,
            year
          };
        }
      }

      // Return whatever we got
      if (parsed.companyName || parsed.ticker || parsed.cik) {
        return {
          ticker: parsed.ticker || undefined,
          cik: parsed.cik || undefined,
          year,
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

  /**
   * Smart truncate that tries to preserve financial statement sections
   */
  private truncateContent(content: string, maxChars: number): string {
    if (content.length <= maxChars) {
      return content;
    }

    // Try to find financial statement sections
    const financialKeywords = [
      'CONSOLIDATED STATEMENTS',
      'CONSOLIDATED BALANCE SHEETS',
      'CONSOLIDATED STATEMENTS OF OPERATIONS',
      'CONSOLIDATED STATEMENTS OF CASH FLOWS',
      'FINANCIAL STATEMENTS',
      'BALANCE SHEET',
      'INCOME STATEMENT',
      'CASH FLOW',
      'Statement of Operations',
      'Statement of Financial Position'
    ];

    // Find the earliest financial section
    let financialStart = -1;
    for (const keyword of financialKeywords) {
      const idx = content.toUpperCase().indexOf(keyword);
      if (idx !== -1 && (financialStart === -1 || idx < financialStart)) {
        financialStart = idx;
      }
    }

    if (financialStart !== -1 && financialStart < content.length * 0.8) {
      // Found financial section! Prioritize it
      const beforeFinancial = Math.floor(maxChars * 0.2);  // 20% for intro
      const financialContent = Math.floor(maxChars * 0.8);  // 80% for financials

      const intro = content.substring(0, Math.min(beforeFinancial, financialStart));
      const financial = content.substring(financialStart, Math.min(content.length, financialStart + financialContent));

      return intro + '\n\n[...skipped to financial statements...]\n\n' + financial + '\n\n[Content truncated for length]';
    }

    // No financial section found, use front + back strategy
    const frontChars = Math.floor(maxChars * 0.6);  // 60% from front
    const backChars = Math.floor(maxChars * 0.4);   // 40% from back

    const front = content.substring(0, frontChars);
    const back = content.substring(content.length - backChars);

    return front + '\n\n[...middle section truncated...]\n\n' + back;
  }

  /**
   * Format Helena financial metrics for LLM context
   */
  private formatHelenaFinancials(financials: any[]): string {
    if (financials.length === 0) {
      return 'No financial metrics available.';
    }

    // Group by fiscal year and quarter
    const grouped: Record<string, any[]> = {};
    for (const metric of financials) {
      const key = `${metric.fiscal_year}${metric.fiscal_quarter ? `-Q${metric.fiscal_quarter}` : ''}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(metric);
    }

    let output = '';
    for (const [period, metrics] of Object.entries(grouped)) {
      output += `\n### Period: ${period}\n`;
      for (const metric of metrics) {
        const formattedValue = this.formatMetricValue(metric.metric_value, metric.metric_unit);
        output += `- **${metric.metric_name}**: ${formattedValue}\n`;
        output += `  - XBRL Tag: ${metric.xbrl_tag}\n`;
        output += `  - Filing: ${metric.filing_type} (${metric.filing_date})\n`;
        output += `  - Period End: ${metric.period_end_date}\n`;
      }
    }

    return output;
  }

  /**
   * Format Helena sections for LLM context
   */
  private formatHelenaSections(sections: any[]): string {
    if (sections.length === 0) {
      return 'No sections available.';
    }

    let output = '';
    for (const section of sections) {
      output += `\n### ${section.section_name} (${section.filing_type} - ${section.filing_date})\n`;
      // Truncate to first 1000 chars per section
      const content = section.full_content.substring(0, 1000);
      output += content;
      if (section.full_content.length > 1000) {
        output += '\n[... truncated for length ...]\n';
      }
      output += '\n';
    }

    return output;
  }

  /**
   * Format metric value with proper units
   */
  private formatMetricValue(value: number, unit: string): string {
    if (unit === 'USD' || unit === 'usd') {
      const absValue = Math.abs(value);
      const sign = value < 0 ? '-' : '';

      if (absValue >= 1_000_000_000_000) {
        return `${sign}$${(value / 1_000_000_000_000).toFixed(2)}T`;
      }
      if (absValue >= 1_000_000_000) {
        return `${sign}$${(value / 1_000_000_000).toFixed(2)}B`;
      }
      if (absValue >= 1_000_000) {
        return `${sign}$${(value / 1_000_000).toFixed(2)}M`;
      }
      if (absValue >= 1_000) {
        return `${sign}$${(value / 1_000).toFixed(2)}K`;
      }
      return `${sign}$${value.toFixed(2)}`;
    }

    // Non-currency units
    return `${value} ${unit}`;
  }

  /**
   * Analyze data coverage - which years/quarters are available
   */
  private analyzeDataCoverage(financials: any[], ticker: string): any {
    // Extract unique filings
    const filings = new Map<string, any>();

    for (const metric of financials) {
      const key = `${metric.filing_type}-${metric.filing_date}`;
      if (!filings.has(key)) {
        filings.set(key, {
          type: metric.filing_type,
          date: metric.filing_date,
          year: metric.fiscal_year,
          quarter: metric.fiscal_quarter,
          periodEnd: metric.period_end_date,
          accession: metric.filing_accession
        });
      }
    }

    // Group by year
    const byYear: Record<number, any> = {};

    for (const filing of filings.values()) {
      const year = filing.year;
      if (!byYear[year]) {
        byYear[year] = {
          year,
          annual: null,  // 10-K
          quarters: []   // 10-Q
        };
      }

      if (filing.type === '10-K' || filing.type === '20-F') {
        byYear[year].annual = filing;
      } else if (filing.type === '10-Q') {
        byYear[year].quarters.push(filing);
      }
    }

    // Calculate completeness
    const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);  // Descending
    const currentYear = new Date().getFullYear();

    // Check completeness for years that actually have data
    // (Don't assume we need 3 years - show what we have)
    const missingData: string[] = [];

    // Only check years that have at least some data
    for (const year of years.slice(0, 5)) {  // Check up to 5 most recent years
      const yearData = byYear[year];

      if (!yearData.annual) {
        missingData.push(`${year} 연간보고서 (10-K)`);
      }

      const qCount = yearData.quarters.length;
      if (qCount < 4 && qCount > 0) {
        const missingQ = 4 - qCount;
        missingData.push(`${year} 분기보고서 (${missingQ}개 분기)`);
      }
    }

    const isComplete = missingData.length === 0;

    return {
      ticker,
      byYear,
      years,
      totalFilings: filings.size,
      isComplete,
      missingData
    };
  }

  /**
   * Format data coverage report for user visibility
   */
  private formatDataCoverageReport(coverage: any): string {
    let report = '📊 **사용된 데이터 범위:**\n';

    for (const year of coverage.years.slice(0, 5)) {  // Show max 5 years
      const yearData = coverage.byYear[year];
      const annual = yearData.annual ? '✅' : '❌';
      const qCount = yearData.quarters.length;
      const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
        .map((q, i) => {
          const hasQ = yearData.quarters.some((qf: any) => qf.quarter === i + 1);
          return hasQ ? '✅' : '❌';
        })
        .join(' ');

      report += `- **${year}**: ${quarters} (연간 10-K ${annual})\n`;
    }

    if (!coverage.isComplete) {
      report += `\n⚠️ **부분적 데이터**: 일부 filing이 누락되었습니다\n`;
      report += `**누락된 데이터:**\n`;
      for (const missing of coverage.missingData.slice(0, 5)) {
        report += `  - ${missing}\n`;
      }
      report += `\n💡 **전체 데이터 받으려면:**\n`;
      report += `\`@Helena ${coverage.ticker} 데이터 재처리해줘\`\n`;
    } else {
      report += `\n✅ **완전한 데이터**: 최근 3년치 모든 filing 확보\n`;
    }

    return report;
  }

  /**
   * Format sources list - which SEC filings were used
   */
  private formatSourcesList(financials: any[]): string {
    // Get unique filings
    const filingsMap = new Map<string, any>();

    for (const metric of financials) {
      const key = metric.filing_accession;
      if (!filingsMap.has(key)) {
        filingsMap.set(key, {
          type: metric.filing_type,
          date: metric.filing_date,
          accession: metric.filing_accession,
          metricsCount: 1
        });
      } else {
        filingsMap.get(key).metricsCount++;
      }
    }

    const filings = Array.from(filingsMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))  // Sort by date descending
      .slice(0, 10);  // Show max 10 filings

    let report = '📁 **출처 (SEC Filings):**\n';

    for (let i = 0; i < filings.length; i++) {
      const f = filings[i];
      const secUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${f.accession.split('-')[0]}&type=${f.type}&dateb=&owner=exclude&count=100`;
      report += `${i + 1}. **${f.type}** (${f.date}) - ${f.metricsCount}개 metrics\n`;
      report += `   - Accession: \`${f.accession}\`\n`;
    }

    if (filingsMap.size > 10) {
      report += `\n... 외 ${filingsMap.size - 10}개 filing\n`;
    }

    report += `\n*총 ${filingsMap.size}개 SEC filing에서 ${financials.length}개 metrics 사용*\n`;

    return report;
  }
}
