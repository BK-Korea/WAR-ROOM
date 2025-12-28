import { BaseAgent } from './BaseAgent';
import { AgentContext, TaskResult } from '../types/agent';
import { HELENA_SYSTEM_PROMPT, HELENA_TASK_PROMPTS } from '../prompts/helena';
import { secClient, SECFiling, SECCompanyInfo } from '../services/SECClient';
import { jinaClient } from '../services/JinaAIClient';
import {
  supabase,
  isSupabaseConfigured,
  logAuditTrail,
  getCompanyMetadata,
  checkHelenaDataAvailability,
  CompanyFinancial,
  FilingSection,
  CompanyMetadata,
  HelenaJob
} from '../lib/supabase';
import { parseXBRLFiling, getRevenue, getNetIncome } from '../lib/xbrl-parser';
import { validateFinancialNumber, formatCurrency, detectIndustry, convertXBRLValue } from '../lib/validators';
import crypto from 'crypto';

/**
 * Helena - The Librarian Agent (SEC Data Curator)
 *
 * GOLDMAN SACHS-GRADE DATA INFRASTRUCTURE
 *
 * Capabilities:
 * - SEC filing collection & preprocessing
 * - XBRL parsing for 100% accurate financial metrics
 * - Structured database storage (Supabase PostgreSQL)
 * - Complete audit trail
 * - Dorothy & other agents support
 */
export class Helena extends BaseAgent {
  private readonly PROCESSING_VERSION = '1.0.0';

  constructor() {
    super({
      name: 'Helena',
      role: 'SEC Data Curator & Librarian',
      description: 'Manages SEC filing data collection, XBRL parsing, and database curation for Goldman Sachs-grade accuracy',
      capabilities: [
        {
          name: 'prepare_company_data',
          description: 'Download and process all SEC filings for a company (background task)'
        },
        {
          name: 'query_financials',
          description: 'Query processed financial metrics from database (for Dorothy)'
        },
        {
          name: 'refresh_company_data',
          description: 'Check for new filings and update database incrementally'
        },
        {
          name: 'check_data_availability',
          description: 'Check if company data is available in database'
        },
        {
          name: 'get_filing_sections',
          description: 'Retrieve specific sections (MD&A, Risk Factors) from database'
        }
      ],
      schema: 'helena_library'
    });
  }

  protected async onInitialize(): Promise<void> {
    this.setSystemPrompt(HELENA_SYSTEM_PROMPT);
    console.log('📚 Helena (SEC Data Curator) is ready - Goldman Sachs-grade data infrastructure');

    // Check Supabase configuration
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Helena: Supabase not configured - will operate in fallback mode');
      console.warn('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable database features');
    }
  }

  protected async performTask(task: string, params: any, context: AgentContext): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      let result: TaskResult;

      switch (task) {
        case 'prepare_company_data':
          result = await this.prepareCompanyData(params, context);
          break;
        case 'query_financials':
          result = await this.queryFinancials(params, context);
          break;
        case 'refresh_company_data':
          result = await this.refreshCompanyData(params, context);
          break;
        case 'check_data_availability':
          result = await this.checkDataAvailability(params, context);
          break;
        case 'get_filing_sections':
          result = await this.getFilingSections(params, context);
          break;
        default:
          result = {
            success: false,
            error: `Unknown task: ${task}. Available: prepare_company_data, query_financials, refresh_company_data, check_data_availability, get_filing_sections`
          };
      }

      // Log audit trail
      const executionTime = Date.now() - startTime;
      await logAuditTrail({
        action_type: task,
        entity_type: 'helena_task',
        agent_name: 'Helena',
        details: { params, result: result.success },
        success: result.success,
        error_message: result.error,
        execution_time_ms: executionTime
      });

      return result;

    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      await logAuditTrail({
        action_type: task,
        entity_type: 'helena_task',
        agent_name: 'Helena',
        details: { params },
        success: false,
        error_message: error.message,
        execution_time_ms: executionTime
      });

      return {
        success: false,
        error: `Helena task failed: ${error.message}`
      };
    }
  }

  // =====================================================
  // Task 1: prepare_company_data
  // =====================================================

  /**
   * Download and process all SEC filings for a company
   * This is a background task that can take 5-10 minutes
   */
  private async prepareCompanyData(params: any, context: AgentContext): Promise<TaskResult> {
    const { ticker, years = 3, filingTypes = ['10-K', '10-Q', '20-F'], forceRefresh = false, onProgress } = params;

    // Progress callback helper
    const progress = (message: string) => {
      if (onProgress && typeof onProgress === 'function') {
        onProgress(message);
      }
    };

    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'Supabase not configured. Please set up database first.'
      };
    }

    progress('회사 정보 조회 중...');
    console.log(`\n[Helena] 📊 Preparing data for ${ticker}`);
    console.log(`[Helena] - Years: ${years}`);
    console.log(`[Helena] - Filing types: ${filingTypes.join(', ')}`);

    try {
      // Step 1: Get company info from SEC
      const companyInfo = await secClient.getCompanyByTicker(ticker);
      if (!companyInfo) {
        return {
          success: false,
          error: `Company not found: ${ticker}`
        };
      }

      console.log(`[Helena] ✓ Company found: ${companyInfo.name} (CIK: ${companyInfo.cik})`);

      // Step 2: Check existing data
      if (!forceRefresh) {
        const existing = await getCompanyMetadata(ticker);
        if (existing && existing.filings_count > 0) {

          // ============================================
          // CRITICAL: XBRL metrics가 0개면 재처리 필요
          // ============================================
          if (existing.metrics_count === 0) {
            progress(`${ticker} 데이터는 있지만 XBRL metrics 0개. 재처리 필요...`);
            console.log(`[Helena] ⚠️ ${ticker} has ${existing.filings_count} filings but 0 XBRL metrics - needs reprocessing`);

            return {
              success: false,
              error: `⚠️ ${ticker} 데이터는 있지만 XBRL 파싱 실패했어\n\n` +
                     `**현재 상태:**\n` +
                     `- Filings: ${existing.filings_count}개 ✅\n` +
                     `- XBRL Metrics: 0개 ❌ (이전 parser 실패)\n` +
                     `- 마지막 처리: ${existing.last_processed_at || 'N/A'}\n\n` +
                     `**🔄 재처리가 필요해:**\n` +
                     `새로운 professional XBRL parser (xml2js 기반)로 재처리하면\n` +
                     `정확한 분기별 매출, 순이익 등 재무 데이터를 추출할 수 있어.\n\n` +
                     `💡 **재처리 방법:**\n` +
                     `"@Helena ${ticker} 데이터 준비해줘 (forceRefresh)"\n\n` +
                     `또는 "네, 재처리해줘" 라고 답하면 바로 시작할게! 🚀`,
              metadata: {
                needsRefresh: true,
                reason: 'xbrl_parsing_failed',
                existing: {
                  filings: existing.filings_count,
                  metrics: existing.metrics_count,
                  lastUpdate: existing.last_processed_at
                }
              }
            };
          }

          // ============================================
          // XBRL metrics가 있으면 정상 완료 상태
          // ============================================
          progress(`${ticker} 데이터 이미 완료 (${existing.filings_count} filings, ${existing.metrics_count} metrics)`);
          console.log(`[Helena] ✓ ${ticker} data already complete - ${existing.filings_count} filings, ${existing.metrics_count} metrics`);

          return {
            success: true,
            data: {
              company: existing.company_name,
              ticker: existing.ticker,
              cik: existing.cik,
              message: `✅ ${ticker} 데이터 이미 준비되어 있어!\n\n` +
                       `**현재 상태:**\n` +
                       `- Filings: ${existing.filings_count}개 📄\n` +
                       `- XBRL Metrics: ${existing.metrics_count}개 💎\n` +
                       `- 마지막 업데이트: ${existing.last_processed_at || 'N/A'}\n\n` +
                       `Dorothy가 바로 사용할 수 있어. 질문해봐!\n\n` +
                       `💡 최신 데이터로 업데이트하려면:\n` +
                       `"@Helena ${ticker} 데이터 준비해줘 (forceRefresh)"`,
              existing: {
                filings: existing.filings_count,
                metrics: existing.metrics_count,
                lastUpdate: existing.last_processed_at
              }
            }
          };
        }
      }

      // Step 3: Fetch filings from SEC
      progress(`SEC Edgar에서 ${ticker} filing 다운로드 중...`);
      console.log(`[Helena] 📥 Fetching filings from SEC Edgar...`);

      // Smart limit: 1 per year for annual (10-K), 4 per year for quarterly (10-Q)
      const hasQuarterly = filingTypes.some((t: string) => t === '10-Q');
      const limit = hasQuarterly ? years * 4 : years * 1;
      const filings = await secClient.getFilings(companyInfo.cik, filingTypes, limit);

      console.log(`[Helena] ✓ Found ${filings.length} filings`);
      progress(`${filings.length}개 filing 발견. 처리 시작...`);

      if (filings.length === 0) {
        return {
          success: true,
          data: {
            company: companyInfo.name,
            ticker: ticker.toUpperCase(),
            cik: companyInfo.cik,
            filingsProcessed: 0,
            metricsExtracted: 0,
            sectionsExtracted: 0,
            message: 'No filings found'
          }
        };
      }

      // Step 3.5: Fetch all company financials from SEC API (once per company, not per filing)
      progress('SEC Company Facts API에서 전체 데이터 다운로드 중...');
      console.log(`\n[Helena] 📊 Fetching Company Facts from SEC API...`);
      console.log(`[Helena] - This is done ONCE for the entire company (not per filing)`);

      try {
        const { fetchCompanyFactsFromSEC } = await import('../lib/xbrl-parser');
        const allFinancials = await fetchCompanyFactsFromSEC(
          companyInfo.cik,
          ticker.toUpperCase(),
          companyInfo.name
        );

        if (allFinancials.length > 0) {
          console.log(`[Helena] ✅ SEC API returned ${allFinancials.length} metrics`);

          // Step 3.6: Check existing data (idempotent processing)
          let financialsToSave: Partial<CompanyFinancial>[] = allFinancials.map((f: any, index: number) => {
            // Extract fiscal year from periodEnd (YYYY-MM-DD format)
            const fiscalYear = f.periodEnd ? parseInt(f.periodEnd.split('-')[0]) : new Date().getFullYear();

            // Determine fiscal quarter from periodType
            const fiscalQuarter = f.periodType === 'quarterly' && f.periodLengthMonths === 3
              ? Math.ceil(parseInt(f.periodEnd.split('-')[1]) / 3)
              : null;

            // Create GUARANTEED UNIQUE filing_accession
            // Problem: contextRef can be shared by multiple metrics → causes "cannot affect row a second time" error
            // Solution: Use index to ensure uniqueness
            const uniqueAccession = `SEC-API-${ticker.toUpperCase()}-${f.periodEnd}-${String(index).padStart(4, '0')}`;

            return {
              ticker: ticker.toUpperCase(),
              cik: companyInfo.cik,
              company_name: companyInfo.name,
              filing_type: f.periodType === 'annual' ? '10-K' : '10-Q',
              filing_date: f.periodEnd,
              period_end_date: f.periodEnd,
              filing_accession: uniqueAccession,  // GUARANTEED UNIQUE
              fiscal_year: fiscalYear,
              fiscal_quarter: fiscalQuarter,
              metric_name: f.label,
              metric_value: f.value,
              metric_unit: f.unit,
              xbrl_tag: f.xbrlTag,
              xbrl_context: f.contextRef || 'N/A',
              xbrl_namespace: f.xbrlTag.split(':')[0],
              source_url: `https://data.sec.gov/api/xbrl/companyfacts/CIK${companyInfo.cik}.json`,
              source_file: 'companyfacts.json',
              processed_by: 'Helena',
              processing_version: '2.0-sec-api'
            };
          });

          // If not forceRefresh, filter out existing data
          if (!forceRefresh) {
            console.log(`[Helena] 📋 Checking for existing data (idempotent mode)...`);

            const { data: existingMetrics } = await supabase
              .from('company_financials')
              .select('xbrl_tag, period_end_date')
              .eq('ticker', ticker.toUpperCase());

            if (existingMetrics && existingMetrics.length > 0) {
              const existingKeys = new Set(
                existingMetrics.map(m => `${m.xbrl_tag}-${m.period_end_date}`)
              );

              const beforeCount = financialsToSave.length;
              financialsToSave = financialsToSave.filter(f => {
                const key = `${f.xbrl_tag}-${f.period_end_date}`;
                return !existingKeys.has(key);
              });

              const skippedCount = beforeCount - financialsToSave.length;
              console.log(`[Helena] ℹ️ Found ${existingMetrics.length} existing metrics in DB`);
              console.log(`[Helena] ⏭️ Skipping ${skippedCount} duplicate metrics`);
              console.log(`[Helena] ✅ Will save ${financialsToSave.length} new metrics`);
            } else {
              console.log(`[Helena] ℹ️ No existing data found - will save all ${financialsToSave.length} metrics`);
            }
          } else {
            console.log(`[Helena] 🔄 forceRefresh=true - will upsert all ${financialsToSave.length} metrics`);
          }

          // Save metrics (only new ones if !forceRefresh)
          if (financialsToSave.length > 0) {
            await this.saveFinancials(financialsToSave);
            console.log(`[Helena] ✅ Saved ${financialsToSave.length} metrics to DB`);
          } else {
            console.log(`[Helena] ℹ️ No new metrics to save (all already exist)`);
          }

          const newMetricsCount = financialsToSave.length;

          // Get total metrics count in DB (for metadata)
          const { count: totalMetricsInDB } = await supabase
            .from('company_financials')
            .select('*', { count: 'exact', head: true })
            .eq('ticker', ticker.toUpperCase());

          const totalMetrics = totalMetricsInDB || newMetricsCount;

          // Update company metadata
          await this.updateCompanyMetadata({
            ticker: ticker.toUpperCase(),
            cik: companyInfo.cik,
            company_name: companyInfo.name,
            filings_count: filings.length,
            metrics_count: totalMetrics,
            last_filing_date: filings[0]?.filingDate || null
          });

          progress('✅ 완료!');
          console.log(`\n[Helena] ✅ Preparation complete!`);
          console.log(`[Helena] - SEC API filings: ${filings.length}`);
          console.log(`[Helena] - New metrics saved: ${newMetricsCount}`);
          console.log(`[Helena] - Total metrics in DB: ${totalMetrics}`);

          const statusMessage = forceRefresh
            ? `✅ ${companyInfo.name} 데이터 재처리 완료!\n- 업데이트: ${newMetricsCount}개 metrics\n- 전체: ${totalMetrics}개 metrics in DB`
            : newMetricsCount > 0
              ? `✅ ${companyInfo.name} 데이터 업데이트 완료!\n- 새로 추가: ${newMetricsCount}개 metrics\n- 전체: ${totalMetrics}개 metrics in DB`
              : `✅ ${companyInfo.name} 데이터 최신 상태!\n- DB에 이미 ${totalMetrics}개 metrics 저장됨\n- 새로운 데이터 없음`;

          return {
            success: true,
            data: {
              company: companyInfo.name,
              ticker: ticker.toUpperCase(),
              cik: companyInfo.cik,
              filingsProcessed: filings.length,
              metricsExtracted: newMetricsCount,
              totalMetricsInDB: totalMetrics,
              sectionsExtracted: 0,
              readyForQuery: totalMetrics > 0,
              isUpdate: newMetricsCount < allFinancials.length,
              message: statusMessage
            }
          };
        } else {
          console.log(`[Helena] ⚠️ SEC API returned 0 metrics, falling back to per-filing parsing...`);
        }
      } catch (secApiError: any) {
        console.error(`[Helena] ❌ SEC API failed: ${secApiError.message}`);
        console.log(`[Helena] ℹ️ Falling back to per-filing XBRL parsing...`);
      }

      // Step 4: Fallback - process filings individually (slower)
      // Only executed if SEC API fails
      let processedFilings = 0;
      let totalMetrics = 0;
      let totalSections = 0;

      for (const filing of filings) {
        try {
          progress(`[${processedFilings + 1}/${filings.length}] ${filing.filingType} (${filing.filingDate}) 처리 중...`);
          console.log(`\n[Helena] 📄 Processing ${filing.filingType} from ${filing.filingDate}...`);

          // Download and convert to markdown
          const url = `https://www.sec.gov/Archives/edgar/data/${companyInfo.cik.replace(/^0+/, '')}/${filing.accessionNumber.replace(/-/g, '')}/${filing.accessionNumber}.txt`;

          console.log(`[Helena] - Downloading from SEC...`);

          // ============================================
          // TEMPORARY: Skip sections extraction to avoid timeout
          // Sections processing takes too long for Vercel serverless (10s timeout)
          // TODO: Re-enable sections in Phase 2 or use background jobs
          // ============================================
          /*
          const conversionResult = await jinaClient.convertURL(url);
          const markdownContent = conversionResult.markdown;
          console.log(`[Helena] ✓ Converted to markdown (${markdownContent.length} chars)`);

          // Step 5: Extract sections
          const sections = await this.extractSections(
            markdownContent,
            filing,
            companyInfo,
            ticker
          );

          if (sections.length > 0) {
            await this.saveSections(sections);
            totalSections += sections.length;
            console.log(`[Helena] ✓ Saved ${sections.length} sections`);
          }
          */
          console.log(`[Helena] ⏭️ Skipping sections extraction (avoiding timeout)`);


          // Step 6: Parse XBRL for 100% accurate financials
          console.log(`\n[Helena XBRL] ============================================`);
          console.log(`[Helena XBRL] 📊 Starting XBRL parsing...`);
          console.log(`[Helena XBRL] - Filing: ${filing.filingType} (${filing.filingDate})`);
          console.log(`[Helena XBRL] - Accession: ${filing.accessionNumber}`);
          console.log(`[Helena XBRL] - CIK: ${companyInfo.cik}`);
          console.log(`[Helena XBRL] ============================================\n`);

          try {
            console.log(`[Helena XBRL] Step 1: Calling parseXBRLFiling()...`);

            const xbrlResult = await parseXBRLFiling({
              cik: companyInfo.cik,
              ticker: ticker.toUpperCase(),
              companyName: companyInfo.name,
              accessionNumber: filing.accessionNumber,
              filingType: filing.filingType,
              filingDate: filing.filingDate
            });

            console.log(`[Helena XBRL] Step 2: Parse result received`);
            console.log(`[Helena XBRL] - Has result: ${!!xbrlResult}`);
            console.log(`[Helena XBRL] - Financials count: ${xbrlResult?.financials?.length || 0}`);

            if (xbrlResult && xbrlResult.financials.length > 0) {
              console.log(`[Helena XBRL] ✅ XBRL data found! Processing ${xbrlResult.financials.length} facts...`);

              // Detect industry for validation
              const industry = detectIndustry(ticker, companyInfo.name);
              console.log(`[Helena XBRL] - Industry detected: ${industry}`);

              // Save XBRL financials to database
              const financialsToSave: Partial<CompanyFinancial>[] = [];
              let validatedCount = 0;
              let skippedCount = 0;

              for (const financial of xbrlResult.financials) {
                // Convert to actual dollars
                const actualValue = convertXBRLValue(financial.value, financial.scale);

                // Validate if it's revenue (quiet mode - only log failures)
                if (financial.xbrlTag.includes('Revenue')) {
                  const validation = validateFinancialNumber(
                    actualValue,
                    {
                      metric: 'revenue',
                      ticker: ticker.toUpperCase(),
                      year: xbrlResult.fiscalYear,
                      quarter: xbrlResult.fiscalQuarter,
                      industry
                    }
                  );

                  if (!validation.valid) {
                    console.warn(`[Helena XBRL] ⚠️ Validation FAILED for ${financial.label}: ${validation.reason}`);
                    skippedCount++;
                    continue;
                  }
                }

                financialsToSave.push({
                  ticker: ticker.toUpperCase(),
                  cik: companyInfo.cik,
                  company_name: companyInfo.name,
                  filing_type: filing.filingType,
                  filing_date: filing.filingDate,
                  filing_accession: filing.accessionNumber,
                  fiscal_year: xbrlResult.fiscalYear,
                  fiscal_quarter: xbrlResult.fiscalQuarter,
                  metric_name: financial.label,
                  metric_value: actualValue,
                  metric_unit: financial.unit,
                  xbrl_tag: financial.xbrlTag,
                  period_end_date: financial.periodEnd,
                  source_url: `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${companyInfo.cik.replace(/^0+/, '')}&accession_number=${filing.accessionNumber}&xbrl_type=v`,
                  processed_by: 'Helena',
                  processing_version: this.PROCESSING_VERSION
                });
                validatedCount++;
              }

              console.log(`[Helena XBRL] Step 3: Validation complete`);
              console.log(`[Helena XBRL] - Validated: ${validatedCount}`);
              console.log(`[Helena XBRL] - Skipped: ${skippedCount}`);
              console.log(`[Helena XBRL] - To save: ${financialsToSave.length}`);

              // Batch insert financials
              if (financialsToSave.length > 0) {
                console.log(`[Helena XBRL] Step 4: Saving to database...`);
                await this.saveFinancials(financialsToSave);
                totalMetrics += financialsToSave.length;
                console.log(`[Helena XBRL] ✅ Successfully saved ${financialsToSave.length} XBRL metrics to DB`);
              } else {
                console.log(`[Helena XBRL] ⚠️ No valid XBRL metrics to save after validation`);
              }
            } else {
              console.log(`[Helena XBRL] ⚠️ No XBRL data found in filing`);
              console.log(`[Helena XBRL] Possible reasons:`);
              console.log(`[Helena XBRL] 1. Filing doesn't have XBRL (older filings)`);
              console.log(`[Helena XBRL] 2. XBRL download failed`);
              console.log(`[Helena XBRL] 3. XBRL parse returned empty`);
            }
          } catch (xbrlError: any) {
            console.error(`\n[Helena XBRL] ❌ ============================================`);
            console.error(`[Helena XBRL] ❌ XBRL PARSING FAILED`);
            console.error(`[Helena XBRL] ❌ ============================================`);
            console.error(`[Helena XBRL] Error type: ${xbrlError.constructor.name}`);
            console.error(`[Helena XBRL] Error message: ${xbrlError.message}`);
            console.error(`[Helena XBRL] Stack trace:`);
            console.error(xbrlError.stack);
            console.error(`[Helena XBRL] ❌ ============================================\n`);

            // Continue - XBRL is optional, we still have markdown sections
            console.log(`[Helena XBRL] ℹ️ Continuing without XBRL data (markdown sections still saved)`);
          }

          processedFilings++;

        } catch (error: any) {
          console.error(`[Helena] ❌ Failed to process filing ${filing.accessionNumber}:`, error.message);
          // Continue with next filing
        }
      }

      // Step 7: Update company metadata
      await this.updateCompanyMetadata({
        ticker: ticker.toUpperCase(),
        cik: companyInfo.cik,
        company_name: companyInfo.name,
        filings_count: processedFilings,
        metrics_count: totalMetrics,
        last_filing_date: filings[0]?.filingDate || null
      });

      progress('✅ 완료!');
      console.log(`\n[Helena] ✅ Preparation complete!`);
      console.log(`[Helena] - Filings processed: ${processedFilings}`);
      console.log(`[Helena] - Sections extracted: ${totalSections}`);
      console.log(`[Helena] - Metrics extracted: ${totalMetrics} (XBRL coming in Phase 2)`);

      return {
        success: true,
        data: {
          company: companyInfo.name,
          ticker: ticker.toUpperCase(),
          cik: companyInfo.cik,
          filingsProcessed: processedFilings,
          metricsExtracted: totalMetrics,
          sectionsExtracted: totalSections,
          processingTime: 'N/A',
          readyForQuery: totalSections > 0,
          sources: filings.slice(0, processedFilings).map(f => ({
            filing_type: f.filingType,
            date: f.filingDate,
            accession: f.accessionNumber,
            sections: Math.floor(totalSections / processedFilings) // Average
          }))
        }
      };

    } catch (error: any) {
      console.error('[Helena] ❌ prepare_company_data failed:', error);
      return {
        success: false,
        error: `Failed to prepare data: ${error.message}`
      };
    }
  }

  // =====================================================
  // Task 2: query_financials
  // =====================================================

  /**
   * Query financial metrics from database (for Dorothy)
   */
  private async queryFinancials(params: any, context: AgentContext): Promise<TaskResult> {
    const { ticker, metrics, fiscalYear, quarters, question } = params;

    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'Database not configured'
      };
    }

    console.log(`[Helena] 🔍 Querying financials for ${ticker}`);

    try {
      // Build query
      let query = supabase
        .from('company_financials')
        .select('*')
        .eq('ticker', ticker.toUpperCase());

      if (fiscalYear) {
        query = query.eq('fiscal_year', fiscalYear);
      }

      if (metrics && Array.isArray(metrics)) {
        query = query.in('metric_name', metrics);
      }

      if (quarters && Array.isArray(quarters)) {
        query = query.in('fiscal_quarter', quarters);
      }

      query = query.order('period_end_date', { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return {
          success: true,
          data: {
            metrics: [],
            sources: [],
            message: 'No financial data found in database. Run Helena prepare_company_data first.'
          }
        };
      }

      // Group by metric_name
      const grouped: Record<string, any[]> = {};
      data.forEach((row: any) => {
        if (!grouped[row.metric_name]) {
          grouped[row.metric_name] = [];
        }
        grouped[row.metric_name].push({
          quarter: row.fiscal_quarter,
          year: row.fiscal_year,
          value: row.metric_value,
          unit: row.metric_unit,
          filing: row.filing_type,
          date: row.filing_date,
          accession: row.filing_accession,
          xbrl_tag: row.xbrl_tag
        });
      });

      // Get unique sources
      const sources = Array.from(new Set(data.map((row: any) => row.filing_accession)))
        .map(accession => {
          const row = data.find((r: any) => r.filing_accession === accession);
          return {
            filing_type: row?.filing_type,
            filing_date: row?.filing_date,
            accession,
            url: row?.source_url
          };
        });

      console.log(`[Helena] ✓ Found ${data.length} data points from ${sources.length} filings`);

      return {
        success: true,
        data: {
          metrics: Object.keys(grouped).map(metricName => ({
            metric_name: metricName,
            values: grouped[metricName]
          })),
          sources
        }
      };

    } catch (error: any) {
      console.error('[Helena] ❌ query_financials failed:', error);
      return {
        success: false,
        error: `Query failed: ${error.message}`
      };
    }
  }

  // =====================================================
  // Task 3: refresh_company_data
  // =====================================================

  /**
   * Check for new filings and update database incrementally
   */
  private async refreshCompanyData(params: any, context: AgentContext): Promise<TaskResult> {
    const { tickers, daysBack = 7 } = params;

    console.log(`[Helena] 🔄 Refreshing data for ${tickers.length} tickers`);

    // TODO: Implement incremental update logic
    // For now, return not implemented

    return {
      success: true,
      data: {
        message: 'Refresh not yet implemented (Phase 2)',
        tickersProcessed: 0,
        newFilings: 0
      }
    };
  }

  // =====================================================
  // Task 4: check_data_availability
  // =====================================================

  /**
   * Check if company data is available in database
   */
  private async checkDataAvailability(params: any, context: AgentContext): Promise<TaskResult> {
    const { ticker, year } = params;

    console.log(`[Helena] 🔍 Checking data availability for ${ticker}`);

    try {
      const availability = await checkHelenaDataAvailability(ticker, year);

      return {
        success: true,
        data: availability
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Availability check failed: ${error.message}`
      };
    }
  }

  // =====================================================
  // Task 5: get_filing_sections
  // =====================================================

  /**
   * Retrieve specific sections from database
   */
  private async getFilingSections(params: any, context: AgentContext): Promise<TaskResult> {
    const { ticker, sectionTypes, limit = 10 } = params;

    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'Database not configured'
      };
    }

    console.log(`[Helena] 📖 Retrieving sections for ${ticker}`);

    try {
      let query = supabase
        .from('filing_sections')
        .select('*')
        .eq('ticker', ticker.toUpperCase());

      if (sectionTypes && Array.isArray(sectionTypes)) {
        query = query.in('section_type', sectionTypes);
      }

      query = query.order('filing_date', { ascending: false }).limit(limit);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      console.log(`[Helena] ✓ Found ${data?.length || 0} sections`);

      return {
        success: true,
        data: {
          sections: data || [],
          count: data?.length || 0
        }
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Failed to retrieve sections: ${error.message}`
      };
    }
  }

  // =====================================================
  // Helper Methods
  // =====================================================

  /**
   * Extract sections from markdown content
   */
  private async extractSections(
    markdownContent: string,
    filing: SECFiling,
    companyInfo: SECCompanyInfo,
    ticker: string
  ): Promise<Partial<FilingSection>[]> {
    const sections: Partial<FilingSection>[] = [];

    // Simple section extraction based on common patterns
    // TODO: Improve with better parsing logic

    const sectionPatterns = [
      { type: 'Item 1', name: 'Business', pattern: /Item 1\.\s+Business/i },
      { type: 'Item 1A', name: 'Risk Factors', pattern: /Item 1A\.\s+Risk Factors/i },
      { type: 'Item 7', name: 'MD&A', pattern: /Item 7\.\s+Management.*Discussion/i },
      { type: 'Item 8', name: 'Financial Statements', pattern: /Item 8\.\s+Financial Statements/i }
    ];

    for (const { type, name, pattern } of sectionPatterns) {
      const match = markdownContent.match(pattern);
      if (match) {
        // Extract content after the match (simplified - just take next 50k chars)
        const startIndex = match.index || 0;
        const endIndex = Math.min(startIndex + 50000, markdownContent.length);
        const content = markdownContent.substring(startIndex, endIndex);

        sections.push({
          ticker: ticker.toUpperCase(),
          cik: companyInfo.cik,
          company_name: companyInfo.name,
          filing_type: filing.filingType,
          filing_date: filing.filingDate,
          filing_accession: filing.accessionNumber,
          section_type: type,
          section_name: name,
          full_content: content,
          content_length: content.length,
          content_hash: this.generateHash(content),
          source_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${companyInfo.cik}&type=${filing.filingType}&dateb=&owner=exclude&count=100`,
          processed_by: 'Helena',
          processing_version: this.PROCESSING_VERSION
        });
      }
    }

    return sections;
  }

  /**
   * Save sections to database
   */
  private async saveSections(sections: Partial<FilingSection>[]): Promise<void> {
    if (sections.length === 0) return;

    const { error } = await supabase
      .from('filing_sections')
      .upsert(sections, {
        onConflict: 'filing_accession,section_type',
        ignoreDuplicates: false
      });

    if (error) {
      throw new Error(`Failed to save sections: ${error.message}`);
    }
  }

  /**
   * Save financial metrics to database
   */
  private async saveFinancials(financials: Partial<CompanyFinancial>[]): Promise<void> {
    if (financials.length === 0) return;

    const { error } = await supabase
      .from('company_financials')
      .upsert(financials, {
        onConflict: 'filing_accession,xbrl_tag,xbrl_context',  // Match DB UNIQUE constraint
        ignoreDuplicates: false
      });

    if (error) {
      throw new Error(`Failed to save financials: ${error.message}`);
    }
  }

  /**
   * Update company metadata
   */
  private async updateCompanyMetadata(metadata: Partial<CompanyMetadata>): Promise<void> {
    console.log(`\n[Helena] 📝 Updating company_metadata...`);
    console.log(`[Helena] - Ticker: ${metadata.ticker}`);
    console.log(`[Helena] - CIK: ${metadata.cik}`);
    console.log(`[Helena] - Company: ${metadata.company_name}`);
    console.log(`[Helena] - Metrics count: ${metadata.metrics_count}`);
    console.log(`[Helena] - Filings count: ${metadata.filings_count}`);

    if (!metadata.ticker || !metadata.cik) {
      throw new Error('Ticker and CIK are required for company metadata');
    }

    // Check if company already exists (by ticker OR cik)
    // Important: Check both because both have UNIQUE constraints
    const { data: existingByTicker } = await supabase
      .from('company_metadata')
      .select('id, ticker')
      .eq('ticker', metadata.ticker)
      .maybeSingle();

    const { data: existingByCik } = await supabase
      .from('company_metadata')
      .select('id, ticker')
      .eq('cik', metadata.cik)
      .maybeSingle();

    // Use whichever exists (ticker takes precedence)
    const existing = existingByTicker || existingByCik;

    let error;

    if (existing) {
      console.log(`[Helena] 🔄 Updating existing record (id=${existing.id})`);
      // Update existing record - exclude ticker and cik (they are UNIQUE and shouldn't change)
      const { ticker, cik, ...updateData } = metadata;
      const result = await supabase
        .from('company_metadata')
        .update({
          ...updateData,
          last_processed_at: new Date().toISOString(),
          is_active: true
        })
        .eq('ticker', existing.ticker);  // Use existing ticker to ensure we update the right record
      error = result.error;
    } else {
      console.log(`[Helena] ➕ Inserting new record`);
      // Insert new record - include all fields
      const result = await supabase
        .from('company_metadata')
        .insert({
          ...metadata,
          last_processed_at: new Date().toISOString(),
          is_active: true
        });
      error = result.error;
    }

    if (error) {
      console.error(`[Helena] ❌ Failed to update company_metadata:`, error);
      throw new Error(`Failed to update company metadata: ${error.message}`);
    }

    console.log(`[Helena] ✅ company_metadata updated successfully`);
  }

  /**
   * Generate SHA-256 hash for content
   */
  private generateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
