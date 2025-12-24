import { BaseAgent } from './BaseAgent.js';
import { AgentContext, TaskResult } from '../types/agent.js';
import { query } from '../db/connection.js';

export class Amy extends BaseAgent {
  constructor() {
    super({
      name: 'Amy',
      role: 'Project Historian',
      description: 'Project history tracking, change logging, and milestone management',
      capabilities: [
        {
          name: 'log_event',
          description: 'Log project events and changes'
        },
        {
          name: 'track_milestone',
          description: 'Track project milestones'
        },
        {
          name: 'generate_timeline',
          description: 'Generate project timeline and history'
        },
        {
          name: 'audit_changes',
          description: 'Audit and review change history'
        }
      ],
      schema: 'amy_tracker'
    });
  }

  protected async onInitialize(): Promise<void> {
    console.log('Amy is ready to track project history');
  }

  protected async performTask(task: string, params: any, context: AgentContext): Promise<TaskResult> {
    switch (task) {
      case 'log_event':
        return await this.logEvent(params, context);
      case 'track_milestone':
        return await this.trackMilestone(params, context);
      case 'generate_timeline':
        return await this.generateTimeline(params, context);
      case 'audit_changes':
        return await this.auditChanges(params, context);
      default:
        return {
          success: false,
          error: `Unknown task: ${task}`
        };
    }
  }

  private async logEvent(params: any, context: AgentContext): Promise<TaskResult> {
    const { eventType, eventDescription, changedBy, changeDetails } = params;

    const result = await query(`
      INSERT INTO amy_tracker.history
        (project_id, event_type, event_description, changed_by, change_details)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
      context.projectId,
      eventType,
      eventDescription,
      changedBy || 'System',
      JSON.stringify(changeDetails || {})
    ]);

    return {
      success: true,
      data: {
        eventId: result.rows[0].id,
        eventType
      }
    };
  }

  private async trackMilestone(params: any, context: AgentContext): Promise<TaskResult> {
    const { milestoneName, description, targetDate, status, deliverables } = params;

    const result = await query(`
      INSERT INTO amy_tracker.milestones
        (project_id, milestone_name, description, target_date, status, deliverables)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      context.projectId,
      milestoneName,
      description,
      targetDate,
      status || 'pending',
      deliverables || []
    ]);

    // Log the milestone creation as an event
    await this.logEvent({
      eventType: 'milestone_created',
      eventDescription: `Milestone created: ${milestoneName}`,
      changedBy: params.createdBy || 'System',
      changeDetails: { milestoneId: result.rows[0].id }
    }, context);

    // If milestone is completed, notify Alice
    if (status === 'completed') {
      await this.sendMessage('Alice', 'milestone_completed', {
        milestoneId: result.rows[0].id,
        name: milestoneName
      });
    }

    return {
      success: true,
      data: {
        milestoneId: result.rows[0].id,
        name: milestoneName
      }
    };
  }

  private async generateTimeline(params: any, context: AgentContext): Promise<TaskResult> {
    if (!context.projectId) {
      return { success: false, error: 'Project ID required' };
    }

    // Get all historical events
    const history = await query(`
      SELECT * FROM amy_tracker.history
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [context.projectId, params.limit || 50]);

    // Get all activity timeline
    const activities = await query(`
      SELECT * FROM amy_tracker.activity_timeline
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [context.projectId, params.limit || 50]);

    // Get milestones
    const milestones = await query(`
      SELECT * FROM amy_tracker.milestones
      WHERE project_id = $1
      ORDER BY target_date ASC
    `, [context.projectId]);

    // Combine and sort by date
    const timeline = [
      ...history.rows.map((h: any) => ({ ...h, source: 'history' })),
      ...activities.rows.map((a: any) => ({ ...a, source: 'activity' })),
      ...milestones.rows.map((m: any) => ({ ...m, source: 'milestone' }))
    ].sort((a, b) => {
      const dateA = a.created_at || a.target_date;
      const dateB = b.created_at || b.target_date;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return {
      success: true,
      data: {
        timeline,
        totalEvents: timeline.length,
        milestones: milestones.rows
      }
    };
  }

  private async auditChanges(params: any, context: AgentContext): Promise<TaskResult> {
    const { entityType, entityId, startDate, endDate } = params;

    let whereClause = '1=1';
    const queryParams: any[] = [];

    if (entityType) {
      queryParams.push(entityType);
      whereClause += ` AND entity_type = $${queryParams.length}`;
    }

    if (entityId) {
      queryParams.push(entityId);
      whereClause += ` AND entity_id = $${queryParams.length}`;
    }

    if (startDate) {
      queryParams.push(startDate);
      whereClause += ` AND created_at >= $${queryParams.length}`;
    }

    if (endDate) {
      queryParams.push(endDate);
      whereClause += ` AND created_at <= $${queryParams.length}`;
    }

    const changes = await query(`
      SELECT * FROM amy_tracker.change_logs
      WHERE ${whereClause}
      ORDER BY created_at DESC
    `, queryParams);

    return {
      success: true,
      data: {
        changes: changes.rows,
        totalChanges: changes.rowCount
      }
    };
  }

  async logChange(
    entityType: string,
    entityId: number,
    changeType: string,
    fieldName: string,
    oldValue: any,
    newValue: any,
    changedBy: string
  ): Promise<void> {
    await query(`
      INSERT INTO amy_tracker.change_logs
        (entity_type, entity_id, change_type, field_name, old_value, new_value, changed_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      entityType,
      entityId,
      changeType,
      fieldName,
      String(oldValue),
      String(newValue),
      changedBy
    ]);
  }

  protected async getMetrics(): Promise<Record<string, any>> {
    const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM amy_tracker.history) as total_events,
        (SELECT COUNT(*) FROM amy_tracker.change_logs) as total_changes,
        (SELECT COUNT(*) FROM amy_tracker.milestones WHERE status = 'completed') as completed_milestones,
        (SELECT COUNT(*) FROM amy_tracker.milestones WHERE status != 'completed') as pending_milestones
    `);

    return result.rows[0];
  }
}
