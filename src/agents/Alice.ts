import { BaseAgent } from './BaseAgent.js';
import { AgentContext, TaskResult } from '../types/agent.js';
import { query } from '../db/connection.js';

export class Alice extends BaseAgent {
  constructor() {
    super({
      name: 'Alice',
      role: 'Strategic Lead',
      description: 'Strategic decision-making and overall project direction',
      capabilities: [
        {
          name: 'analyze_strategy',
          description: 'Analyze strategic options and provide recommendations'
        },
        {
          name: 'make_decision',
          description: 'Make strategic decisions based on available data'
        },
        {
          name: 'set_goals',
          description: 'Define and track strategic goals'
        },
        {
          name: 'assess_situation',
          description: 'Assess current situation across all dimensions'
        }
      ],
      schema: 'alice_strategy'
    });
  }

  protected async onInitialize(): Promise<void> {
    // Alice-specific initialization
    console.log('Alice is ready to lead strategic initiatives');
  }

  protected async performTask(task: string, params: any, context: AgentContext): Promise<TaskResult> {
    switch (task) {
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

  private async analyzeStrategy(params: any, context: AgentContext): Promise<TaskResult> {
    const { analysisType, data } = params;

    const result = await query(`
      INSERT INTO alice_strategy.analysis_history (project_id, analysis_type, analysis_data, insights)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [context.projectId, analysisType, JSON.stringify(data), params.insights || '']);

    return {
      success: true,
      data: {
        analysisId: result.rows[0].id,
        type: analysisType
      }
    };
  }

  private async makeDecision(params: any, context: AgentContext): Promise<TaskResult> {
    const { title, description, rationale, decisionType, confidenceScore } = params;

    // Request input from other agents if needed
    if (decisionType === 'financial') {
      await this.sendMessage('Dorothy', 'request_analysis', { context });
    }
    if (decisionType === 'market') {
      await this.sendMessage('Belle', 'request_research', { context });
    }

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
      title,
      description,
      rationale,
      params.impactAssessment || '',
      confidenceScore || 0.5,
      'proposed'
    ]);

    // Notify Elsa to check for risks
    await this.sendMessage('Elsa', 'assess_decision', {
      decisionId: result.rows[0].id,
      decision: params
    });

    return {
      success: true,
      data: {
        decisionId: result.rows[0].id,
        title
      }
    };
  }

  private async setGoals(params: any, context: AgentContext): Promise<TaskResult> {
    const { goalName, description, targetDate, priority } = params;

    const result = await query(`
      INSERT INTO alice_strategy.goals (project_id, goal_name, description, target_date, priority)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [context.projectId, goalName, description, targetDate, priority || 1]);

    // Create milestone in Amy's tracker
    await this.sendMessage('Amy', 'create_milestone', {
      goalId: result.rows[0].id,
      goalName,
      targetDate
    });

    return {
      success: true,
      data: {
        goalId: result.rows[0].id,
        goalName
      }
    };
  }

  private async assessSituation(params: any, context: AgentContext): Promise<TaskResult> {
    if (!context.projectId) {
      return { success: false, error: 'Project ID required' };
    }

    // Gather data from all agents
    const situation: any = {};

    // Get financial status from Dorothy
    const financialData = await query(`
      SELECT COUNT(*) as model_count,
             (SELECT COUNT(*) FROM dorothy_finance.valuations WHERE company_id IN
               (SELECT id FROM shared.companies WHERE id IN
                 (SELECT company_id FROM dorothy_finance.financial_models WHERE project_id = $1)
               )
             ) as valuation_count
      FROM dorothy_finance.financial_models WHERE project_id = $1
    `, [context.projectId]);
    situation.financial = financialData.rows[0];

    // Get market intel from Belle
    const marketData = await query(`
      SELECT COUNT(*) as research_count FROM belle_market.research WHERE project_id = $1
    `, [context.projectId]);
    situation.market = marketData.rows[0];

    // Get risk status from Elsa
    const riskData = await query(`
      SELECT COUNT(*) as total_risks,
             COUNT(CASE WHEN likelihood = 'high' AND impact = 'high' THEN 1 END) as critical_risks
      FROM elsa_risk.assessments WHERE project_id = $1
    `, [context.projectId]);
    situation.risks = riskData.rows[0];

    // Get pending action items from Wendy
    const actionsData = await query(`
      SELECT COUNT(*) as pending_actions
      FROM wendy_meetings.action_items
      WHERE meeting_id IN (SELECT id FROM wendy_meetings.meetings WHERE project_id = $1)
      AND status = 'pending'
    `, [context.projectId]);
    situation.actions = actionsData.rows[0];

    return {
      success: true,
      data: situation
    };
  }
}
