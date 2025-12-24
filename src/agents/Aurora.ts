import { BaseAgent } from './BaseAgent.js';
import { AgentContext, TaskResult } from '../types/agent.js';
import { query } from '../db/connection.js';

export class Aurora extends BaseAgent {
  constructor() {
    super({
      name: 'Aurora',
      role: 'Operations Manager',
      description: 'Internal data collection, optimization, and operational metrics tracking',
      capabilities: [
        {
          name: 'track_metrics',
          description: 'Track and analyze operational metrics'
        },
        {
          name: 'document_process',
          description: 'Document operational processes'
        },
        {
          name: 'optimize_data',
          description: 'Optimize data collection and storage'
        },
        {
          name: 'manage_sources',
          description: 'Manage internal data sources'
        }
      ],
      schema: 'aurora_ops'
    });
  }

  protected async onInitialize(): Promise<void> {
    console.log('Aurora is ready to optimize operations');
  }

  protected async performTask(task: string, params: any, context: AgentContext): Promise<TaskResult> {
    switch (task) {
      case 'track_metrics':
        return await this.trackMetrics(params, context);
      case 'document_process':
        return await this.documentProcess(params, context);
      case 'optimize_data':
        return await this.optimizeData(params, context);
      case 'manage_sources':
        return await this.manageSources(params, context);
      default:
        return {
          success: false,
          error: `Unknown task: ${task}`
        };
    }
  }

  private async trackMetrics(params: any, context: AgentContext): Promise<TaskResult> {
    const {
      metricName,
      metricCategory,
      metricValue,
      unit,
      measurementDate,
      metadata
    } = params;

    const result = await query(`
      INSERT INTO aurora_ops.metrics
        (project_id, metric_name, metric_category, metric_value, unit, measurement_date, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      context.projectId,
      metricName,
      metricCategory,
      metricValue,
      unit,
      measurementDate || new Date(),
      JSON.stringify(metadata || {})
    ]);

    // If metric is below threshold, notify Elsa for risk assessment
    if (params.alertThreshold && metricValue < params.alertThreshold) {
      await this.sendMessage('Elsa', 'metric_alert', {
        metricId: result.rows[0].id,
        name: metricName,
        value: metricValue,
        threshold: params.alertThreshold
      });
    }

    return {
      success: true,
      data: {
        metricId: result.rows[0].id,
        name: metricName,
        value: metricValue
      }
    };
  }

  private async documentProcess(params: any, context: AgentContext): Promise<TaskResult> {
    const {
      processName,
      description,
      steps,
      owner,
      frequency
    } = params;

    const result = await query(`
      INSERT INTO aurora_ops.processes
        (project_id, process_name, description, steps, owner, frequency)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      context.projectId,
      processName,
      description,
      steps || [],
      owner,
      frequency
    ]);

    return {
      success: true,
      data: {
        processId: result.rows[0].id,
        name: processName
      }
    };
  }

  private async optimizeData(params: any, context: AgentContext): Promise<TaskResult> {
    const {
      optimizationType,
      targetArea,
      beforeMetrics,
      afterMetrics,
      recommendations
    } = params;

    // Calculate improvement
    const improvement = this.calculateImprovement(beforeMetrics, afterMetrics);

    const result = await query(`
      INSERT INTO aurora_ops.optimization_logs
        (optimization_type, target_area, before_metrics, after_metrics,
         improvement_percentage, recommendations)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      optimizationType,
      targetArea,
      JSON.stringify(beforeMetrics),
      JSON.stringify(afterMetrics),
      improvement,
      recommendations || []
    ]);

    // Notify Alice about significant improvements
    if (improvement > 20) {
      await this.sendMessage('Alice', 'optimization_success', {
        optimizationId: result.rows[0].id,
        area: targetArea,
        improvement
      });
    }

    return {
      success: true,
      data: {
        optimizationId: result.rows[0].id,
        improvement: `${improvement}%`
      }
    };
  }

  private calculateImprovement(before: any, after: any): number {
    // Simple improvement calculation
    if (!before.value || !after.value) return 0;
    return ((after.value - before.value) / before.value) * 100;
  }

  private async manageSources(params: any, context: AgentContext): Promise<TaskResult> {
    const { sourceName, sourceType, connectionInfo, action } = params;

    if (action === 'add') {
      const result = await query(`
        INSERT INTO aurora_ops.data_sources
          (source_name, source_type, connection_info, last_sync, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [
        sourceName,
        sourceType,
        JSON.stringify(connectionInfo),
        new Date(),
        'active'
      ]);

      return {
        success: true,
        data: {
          sourceId: result.rows[0].id,
          name: sourceName
        }
      };
    } else if (action === 'sync') {
      await query(`
        UPDATE aurora_ops.data_sources
        SET last_sync = $1, status = $2
        WHERE source_name = $3
      `, [new Date(), 'active', sourceName]);

      return {
        success: true,
        data: { name: sourceName, lastSync: new Date() }
      };
    }

    return { success: false, error: 'Invalid action' };
  }

  protected async getMetrics(): Promise<Record<string, any>> {
    const result = await query(`
      SELECT COUNT(*) as total_metrics,
             COUNT(DISTINCT metric_category) as categories,
             COUNT(DISTINCT project_id) as projects
      FROM aurora_ops.metrics
    `);

    return result.rows[0];
  }
}
