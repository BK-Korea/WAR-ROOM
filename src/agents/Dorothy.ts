import { BaseAgent } from './BaseAgent.js';
import { AgentContext, TaskResult } from '../types/agent.js';
import { query } from '../db/connection.js';

export class Dorothy extends BaseAgent {
  constructor() {
    super({
      name: 'Dorothy',
      role: 'Financial Analyst',
      description: 'Financial modeling, valuations, and financial data analysis',
      capabilities: [
        {
          name: 'create_model',
          description: 'Create financial models (DCF, Comps, etc.)'
        },
        {
          name: 'calculate_valuation',
          description: 'Calculate company valuations'
        },
        {
          name: 'analyze_financials',
          description: 'Analyze financial statements'
        },
        {
          name: 'track_metrics',
          description: 'Track and analyze financial metrics'
        }
      ],
      schema: 'dorothy_finance'
    });
  }

  protected async onInitialize(): Promise<void> {
    console.log('Dorothy is ready to analyze financials');
  }

  protected async performTask(task: string, params: any, context: AgentContext): Promise<TaskResult> {
    switch (task) {
      case 'create_model':
        return await this.createModel(params, context);
      case 'calculate_valuation':
        return await this.calculateValuation(params, context);
      case 'analyze_financials':
        return await this.analyzeFinancials(params, context);
      case 'track_metrics':
        return await this.trackMetrics(params, context);
      default:
        return {
          success: false,
          error: `Unknown task: ${task}`
        };
    }
  }

  private async createModel(params: any, context: AgentContext): Promise<TaskResult> {
    const { companyId, modelName, modelType, modelData, assumptions } = params;

    const result = await query(`
      INSERT INTO dorothy_finance.financial_models
        (project_id, company_id, model_name, model_type, model_data, assumptions)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      context.projectId,
      companyId,
      modelName,
      modelType,
      JSON.stringify(modelData),
      assumptions
    ]);

    // Notify Alice about the new model
    await this.sendMessage('Alice', 'model_created', {
      modelId: result.rows[0].id,
      modelName
    });

    return {
      success: true,
      data: {
        modelId: result.rows[0].id,
        modelName,
        modelType
      }
    };
  }

  private async calculateValuation(params: any, context: AgentContext): Promise<TaskResult> {
    const {
      companyId,
      modelId,
      valuationMethod,
      enterpriseValue,
      equityValue,
      keyMetrics
    } = params;

    const result = await query(`
      INSERT INTO dorothy_finance.valuations
        (financial_model_id, company_id, valuation_date, valuation_method,
         enterprise_value, equity_value, key_metrics)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      modelId,
      companyId,
      new Date(),
      valuationMethod,
      enterpriseValue,
      equityValue,
      JSON.stringify(keyMetrics)
    ]);

    // Notify Alice about the valuation
    await this.sendMessage('Alice', 'valuation_complete', {
      valuationId: result.rows[0].id,
      enterpriseValue,
      equityValue,
      method: valuationMethod
    });

    return {
      success: true,
      data: {
        valuationId: result.rows[0].id,
        enterpriseValue,
        equityValue
      }
    };
  }

  private async analyzeFinancials(params: any, context: AgentContext): Promise<TaskResult> {
    const { companyId, statementType, periodStart, periodEnd, statementData } = params;

    const result = await query(`
      INSERT INTO dorothy_finance.financial_statements
        (company_id, statement_type, period_start, period_end, statement_data)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
      companyId,
      statementType,
      periodStart,
      periodEnd,
      JSON.stringify(statementData)
    ]);

    // Calculate key ratios
    const analysis = this.performFinancialAnalysis(statementData);

    return {
      success: true,
      data: {
        statementId: result.rows[0].id,
        analysis
      }
    };
  }

  private performFinancialAnalysis(data: any): any {
    // Simple financial analysis logic
    return {
      revenue: data.revenue || 0,
      grossMargin: data.grossProfit ? (data.grossProfit / data.revenue) * 100 : 0,
      operatingMargin: data.operatingIncome ? (data.operatingIncome / data.revenue) * 100 : 0,
      netMargin: data.netIncome ? (data.netIncome / data.revenue) * 100 : 0
    };
  }

  private async trackMetrics(params: any, context: AgentContext): Promise<TaskResult> {
    const { companyId } = params;

    const models = await query(`
      SELECT id, model_name, model_data
      FROM dorothy_finance.financial_models
      WHERE company_id = $1
      ORDER BY created_at DESC
    `, [companyId]);

    const valuations = await query(`
      SELECT * FROM dorothy_finance.valuations
      WHERE company_id = $1
      ORDER BY valuation_date DESC
      LIMIT 5
    `, [companyId]);

    return {
      success: true,
      data: {
        modelCount: models.rowCount,
        latestValuations: valuations.rows
      }
    };
  }
}
