import { BaseAgent } from './BaseAgent';
import { AgentContext, TaskResult } from '../types/agent';
import { query } from '../db/connection';
import { ALICE_SYSTEM_PROMPT, ALICE_TASK_PROMPTS } from '../prompts/alice';

/**
 * Alice - McKinsey-level Strategic Consultant
 *
 * Senior partner-level strategist powered by GLM-4
 * Specializes in:
 * - Strategic analysis and decision-making
 * - Business model evaluation
 * - M&A due diligence
 * - Growth strategy
 * - Organizational transformation
 */
export class Alice extends BaseAgent {
  constructor() {
    super({
      name: 'Alice',
      role: 'Chief Strategy Officer',
      description: 'McKinsey-level strategic consultant for executive decision-making',
      capabilities: [
        {
          name: 'consult',
          description: 'Free-form strategic consulting conversation'
        },
        {
          name: 'analyze_strategy',
          description: 'Deep strategic analysis with frameworks'
        },
        {
          name: 'make_decision',
          description: 'Structured decision-making process'
        },
        {
          name: 'set_goals',
          description: 'Define strategic goals and OKRs'
        },
        {
          name: 'assess_situation',
          description: 'Comprehensive situation assessment'
        }
      ],
      schema: 'alice_strategy'
    });
  }

  protected async onInitialize(): Promise<void> {
    // Set McKinsey-level system prompt
    this.setSystemPrompt(ALICE_SYSTEM_PROMPT);
    console.log('🎯 Alice (McKinsey-level Strategic Consultant) is ready');
  }

  protected async performTask(task: string, params: any, context: AgentContext): Promise<TaskResult> {
    switch (task) {
      case 'consult':
        return await this.consult(params, context);
      case 'analyze_strategy':
        return await this.analyzeStrategy(params, context);
      case 'make_decision':
        return await this.makeDecision(params, context);
      case 'set_goals':
        return await this.setGoals(params, context);
      case 'assess_situation':
        return await this.assessSituation(params, context);
      default:
        return {
          success: false,
          error: `Unknown task: ${task}`
        };
    }
  }

  /**
   * Free-form strategic consulting
   */
  private async consult(params: any, context: AgentContext): Promise<TaskResult> {
    const { query: userQuery, useHistory = true } = params;

    try {
      // ============================================
      // Goldman Sachs Fast Path - Detect financial questions
      // ============================================
      const needsFinancialData = this.detectFinancialQuestion(userQuery);
      let financialContext = '';

      // TODO: Implement inter-agent communication for Dorothy calls
      // For now, Alice suggests user to ask Dorothy directly
      if (needsFinancialData) {
        const ticker = this.extractTicker(userQuery);
        if (ticker) {
          console.log(`[Alice] 💼 Financial question detected for ${ticker}`);
          console.log(`[Alice] 💡 Tip: For detailed financial data, ask "@Dorothy ${ticker} 재무 데이터"`);
          financialContext = `\n\n**Note:** For detailed SEC filing data on ${ticker}, consider asking Dorothy directly: "@Dorothy ${ticker} 재무 분석"\n\n`;
        }
      }

      // Build final prompt with financial context
      const finalQuery = financialContext ? `${userQuery}\n\n${financialContext}` : userQuery;

      let response: string;

      if (useHistory) {
        response = await this.callLLMWithHistory(finalQuery, 0.7);
      } else {
        response = await this.callLLM(finalQuery, 0.7);
      }

      // Log the consultation (graceful degradation if table doesn't exist)
      if (context.projectId) {
        try {
          await query(`
            INSERT INTO alice_strategy.analysis_history (project_id, analysis_type, analysis_data, insights)
            VALUES ($1, $2, $3, $4)
          `, [
            context.projectId,
            'consultation',
            JSON.stringify({ query: userQuery }),
            response
          ]);
        } catch (error) {
          // Failed to save to DB, but continue
          console.warn('[Alice] Could not save consultation history:', error);
        }
      }

      return {
        success: true,
        data: {
          response,
          type: 'consultation',
          conversationLength: this.getHistory().length,
          usedFinancialData: !!financialContext
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Strategic analysis with LLM reasoning
   */
  private async analyzeStrategy(params: any, context: AgentContext): Promise<TaskResult> {
    const { topic, analysisType = 'general', includeData = true } = params;

    try {
      // Gather relevant data from other agents if requested
      let dataContext = '';

      if (includeData && context.projectId) {
        const situationData = await this.gatherSituationData(context.projectId);
        dataContext = `\n\nCurrent Project Data:\n${JSON.stringify(situationData, null, 2)}`;
      }

      // Build analysis prompt
      const analysisPrompt = `${ALICE_TASK_PROMPTS.analyze_strategy}

Topic: ${topic}
Analysis Type: ${analysisType}
${dataContext}

Please provide a comprehensive strategic analysis.`;

      const response = await this.callLLM(analysisPrompt, 0.6);

      // Save analysis (graceful degradation if table doesn't exist)
      let result = null;
      try {
        result = await query(`
          INSERT INTO activity_timeline (project_id, agent_name, activity_type, activity_description, metadata)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [
          context.projectId,
          'Alice',
          'analyze_strategy',
          analysisType,
          JSON.stringify({ topic, params, response: response.substring(0, 500) })
        ]);
      } catch (error) {
        // Failed to save to DB, but continue
        console.warn('[Alice] Could not save analysis history:', error);
      }

      return {
        success: true,
        data: {
          analysisId: result?.rows?.[0]?.id || Date.now(),
          type: analysisType,
          analysis: response,
          topic
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Structured decision-making with McKinsey framework
   */
  private async makeDecision(params: any, context: AgentContext): Promise<TaskResult> {
    const {
      question,
      decisionType = 'strategic',
      options = [],
      criteria = [],
      includeRiskAssessment = true
    } = params;

    try {
      // Gather data from other agents
      let additionalContext = '';

      if (context.projectId) {
        const situationData = await this.gatherSituationData(context.projectId);
        additionalContext += `\n\nCurrent Situation:\n${JSON.stringify(situationData, null, 2)}`;

        // Request financial analysis if needed
        if (decisionType === 'financial' || decisionType === 'acquisition') {
          await this.sendMessage('Dorothy', 'request_analysis', { context });
          additionalContext += '\n\n[Note: Financial analysis requested from Dorothy]';
        }

        // Request market intelligence if needed
        if (decisionType === 'market' || decisionType === 'product') {
          await this.sendMessage('Belle', 'request_research', { context });
          additionalContext += '\n\n[Note: Market research requested from Belle]';
        }
      }

      // Build decision prompt
      const decisionPrompt = `${ALICE_TASK_PROMPTS.make_decision}

Decision Question: ${question}
Decision Type: ${decisionType}

${options.length > 0 ? `Available Options:\n${options.map((o: any, i: number) => `${i + 1}. ${o}`).join('\n')}` : ''}

${criteria.length > 0 ? `Decision Criteria:\n${criteria.map((c: any, i: number) => `${i + 1}. ${c}`).join('\n')}` : ''}

${additionalContext}

Please provide a structured recommendation with clear rationale, expected impact, and implementation guidance.`;

      const response = await this.callLLM(decisionPrompt, 0.6);

      // Extract confidence score from response (simple heuristic)
      const confidenceScore = this.extractConfidenceScore(response);

      // Save decision
      const result = await query(`
        INSERT INTO alice_strategy.decisions (
          project_id, decision_type, title, description, rationale,
          impact_assessment, confidence_score, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        context.projectId,
        decisionType,
        question,
        response.substring(0, 500), // First 500 chars as description
        response,
        'See full analysis in rationale',
        confidenceScore,
        'proposed'
      ]);

      // Request risk assessment from Elsa
      if (includeRiskAssessment) {
        await this.sendMessage('Elsa', 'assess_decision', {
          decisionId: result.rows[0].id,
          decision: { question, decisionType, response }
        });
      }

      return {
        success: true,
        data: {
          decisionId: result.rows[0].id,
          recommendation: response,
          confidenceScore,
          decisionType
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Set strategic goals with OKR framework
   */
  private async setGoals(params: any, context: AgentContext): Promise<TaskResult> {
    const {
      objective,
      timeframe = '1 year',
      currentState,
      desiredState
    } = params;

    try {
      // Build goal-setting prompt
      const goalPrompt = `${ALICE_TASK_PROMPTS.set_goals}

Objective: ${objective}
Timeframe: ${timeframe}
Current State: ${currentState || 'Not specified'}
Desired State: ${desiredState || 'Not specified'}

Please define:
1. A clear, inspiring objective
2. 3-5 measurable key results
3. Initiatives to achieve each key result
4. Success metrics and tracking approach
5. Dependencies and risk factors`;

      const response = await this.callLLM(goalPrompt, 0.7);

      // Parse the response to extract goal components (simplified)
      const goalName = objective;
      const description = response;

      // Save goal
      const result = await query(`
        INSERT INTO alice_strategy.goals (project_id, goal_name, description, target_date, priority, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        context.projectId,
        goalName,
        description,
        this.calculateTargetDate(timeframe),
        1, // High priority
        'active'
      ]);

      // Create milestone in Amy's tracker
      await this.sendMessage('Amy', 'create_milestone', {
        goalId: result.rows[0].id,
        goalName,
        targetDate: this.calculateTargetDate(timeframe)
      });

      return {
        success: true,
        data: {
          goalId: result.rows[0].id,
          goalName,
          okrFramework: response,
          targetDate: this.calculateTargetDate(timeframe)
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Comprehensive situation assessment with LLM analysis
   */
  private async assessSituation(params: any, context: AgentContext): Promise<TaskResult> {
    if (!context.projectId) {
      return { success: false, error: 'Project ID required' };
    }

    try {
      // Gather comprehensive data
      const situationData = await this.gatherSituationData(context.projectId);

      // Build assessment prompt
      const assessmentPrompt = `${ALICE_TASK_PROMPTS.assess_situation}

Project Data:
${JSON.stringify(situationData, null, 2)}

Please provide:
1. Executive Summary (2-3 sentences)
2. Key Findings (top 5 insights)
3. Strategic Opportunities
4. Critical Risks
5. Recommended Actions
6. Questions to Resolve

Focus on actionable insights and strategic implications.`;

      const analysis = await this.callLLM(assessmentPrompt, 0.7);

      return {
        success: true,
        data: {
          rawData: situationData,
          strategicAnalysis: analysis,
          timestamp: new Date(),
          projectId: context.projectId
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper: Gather comprehensive situation data from all agents
   */
  private async gatherSituationData(projectId: number): Promise<any> {
    const situation: any = {
      projectId,
      timestamp: new Date()
    };

    // Financial data (graceful degradation if tables don't exist)
    try {
      const financialData = await query(`
        SELECT COUNT(*) as model_count
        FROM sec_filings WHERE id IN (SELECT filing_id FROM financial_data)
      `, []);
      situation.financial = financialData.rows[0] || { model_count: 0 };
    } catch (error) {
      situation.financial = { model_count: 0 };
    }

    // Market intelligence (graceful degradation)
    try {
      const marketData = await query(`SELECT COUNT(*) as research_count FROM activity_timeline WHERE agent_name = 'Belle' LIMIT 1`, []);
      situation.market = marketData.rows[0] || { research_count: 0 };
    } catch (error) {
      situation.market = { research_count: 0 };
    }

    // Risk status (graceful degradation)
    try {
      const riskData = await query(`SELECT COUNT(*) as total_risks FROM guardrails LIMIT 1`, []);
      situation.risks = riskData.rows[0] || { total_risks: 0 };
    } catch (error) {
      situation.risks = { total_risks: 0 };
    }

    // Action items (graceful degradation)
    try {
      const actionsData = await query(`SELECT COUNT(*) as pending_actions FROM activity_timeline WHERE activity_type LIKE '%action%' LIMIT 1`, []);
      situation.actions = actionsData.rows[0] || { pending_actions: 0 };
    } catch (error) {
      situation.actions = { pending_actions: 0 };
    }

    // Compliance status (graceful degradation)
    try {
      const complianceData = await query(`SELECT COUNT(*) as total_certifications FROM guardrails WHERE is_active = 1 LIMIT 1`, []);
      situation.compliance = complianceData.rows[0] || { total_certifications: 0 };
    } catch (error) {
      situation.compliance = { total_certifications: 0 };
    }

    // Recent decisions (graceful degradation)
    try {
      const decisionsData = await query(`SELECT COUNT(*) as total_decisions FROM activity_timeline WHERE agent_name = 'Alice' AND activity_type LIKE '%decision%' LIMIT 1`, []);
      situation.decisions = decisionsData.rows[0] || { total_decisions: 0 };
    } catch (error) {
      situation.decisions = { total_decisions: 0 };
    }

    return situation;
  }

  /**
   * Helper: Extract confidence score from LLM response
   */
  private extractConfidenceScore(response: string): number {
    // Look for patterns like "confidence: 85%" or "85% confident"
    const patterns = [
      /confidence[:\s]+(\d+)%/i,
      /(\d+)%\s+confiden/i,
      /conviction[:\s]+(\d+)%/i
    ];

    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match && match[1]) {
        return parseInt(match[1]) / 100;
      }
    }

    // Default to 0.7 if no confidence found
    return 0.7;
  }

  /**
   * Helper: Calculate target date from timeframe string
   */
  private calculateTargetDate(timeframe: string): Date {
    const now = new Date();
    const lower = timeframe.toLowerCase();

    if (lower.includes('week')) {
      const weeks = parseInt(lower) || 1;
      now.setDate(now.getDate() + weeks * 7);
    } else if (lower.includes('month')) {
      const months = parseInt(lower) || 1;
      now.setMonth(now.getMonth() + months);
    } else if (lower.includes('quarter')) {
      const quarters = parseInt(lower) || 1;
      now.setMonth(now.getMonth() + quarters * 3);
    } else if (lower.includes('year')) {
      const years = parseInt(lower) || 1;
      now.setFullYear(now.getFullYear() + years);
    } else {
      // Default to 3 months
      now.setMonth(now.getMonth() + 3);
    }

    return now;
  }

  /**
   * Clear conversation history
   */
  public resetConversation(): void {
    this.clearHistory();
  }

  /**
   * Get current conversation state
   */
  public getConversationState(): any {
    return {
      messageCount: this.getHistory().length,
      history: this.getHistory()
    };
  }

  /**
   * Detect if question requires financial data
   */
  private detectFinancialQuestion(query: string): boolean {
    const financialKeywords = [
      '매출', '수익', 'revenue', '순이익', 'net income',
      '자산', 'assets', '부채', 'liabilities', '현금', 'cash',
      '재무', 'financial', 'financials', '실적', 'earnings',
      '분기', 'quarterly', '연간', 'annual', '10-K', '10-Q',
      'balance sheet', 'income statement', 'cash flow',
      'ebitda', 'eps', 'roe', 'roa', '영업이익', 'operating income'
    ];

    const lowerQuery = query.toLowerCase();
    return financialKeywords.some(keyword => lowerQuery.includes(keyword.toLowerCase()));
  }

  /**
   * Extract company ticker from query
   */
  private extractTicker(query: string): string | null {
    // Common patterns for ticker mentions
    const patterns = [
      /\b([A-Z]{1,5})\s+(매출|수익|재무|실적)/,  // "JOBY 매출"
      /([A-Z]{1,5})\s+Aviation/i,                 // "JOBY Aviation"
      /ticker:\s*([A-Z]{1,5})/i,                  // "ticker: JOBY"
      /\(([A-Z]{1,5})\)/,                         // "(JOBY)"
      /\b([A-Z]{2,5})\b/                          // Standalone ticker (2-5 caps)
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].toUpperCase();
      }
    }

    return null;
  }
}
