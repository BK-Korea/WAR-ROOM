import { BaseAgent } from './BaseAgent';
import { AgentContext, TaskResult } from '../types/agent';
import { query } from '../db/connection';

export class Wendy extends BaseAgent {
  constructor() {
    super({
      name: 'Wendy',
      role: 'Meeting Coordinator',
      description: 'Meeting recording, transcription, analysis, and action item tracking',
      capabilities: [
        {
          name: 'record_meeting',
          description: 'Record and transcribe meetings'
        },
        {
          name: 'extract_insights',
          description: 'Extract insights and key points from meetings'
        },
        {
          name: 'manage_actions',
          description: 'Create and track action items'
        },
        {
          name: 'summarize_meetings',
          description: 'Generate meeting summaries'
        }
      ],
      schema: 'wendy_meetings'
    });
  }

  protected async onInitialize(): Promise<void> {
    console.log('Wendy is ready to manage meetings and action items');
  }

  protected async performTask(task: string, params: any, context: AgentContext): Promise<TaskResult> {
    switch (task) {
      case 'record_meeting':
        return await this.recordMeeting(params, context);
      case 'extract_insights':
        return await this.extractInsights(params, context);
      case 'manage_actions':
        return await this.manageActions(params, context);
      case 'summarize_meetings':
        return await this.summarizeMeetings(params, context);
      default:
        return {
          success: false,
          error: `Unknown task: ${task}`
        };
    }
  }

  private async recordMeeting(params: any, context: AgentContext): Promise<TaskResult> {
    const {
      meetingTitle,
      meetingDate,
      participants,
      durationMinutes,
      meetingType,
      transcript,
      summary,
      keyPoints
    } = params;

    // Create meeting record
    const meetingResult = await query(`
      INSERT INTO wendy_meetings.meetings
        (project_id, meeting_title, meeting_date, participants, duration_minutes, meeting_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      context.projectId,
      meetingTitle,
      meetingDate || new Date(),
      participants || [],
      durationMinutes,
      meetingType
    ]);

    const meetingId = meetingResult.rows[0].id;

    // Store transcript if provided
    if (transcript) {
      await query(`
        INSERT INTO wendy_meetings.transcripts
          (meeting_id, transcript_text, summary, key_points)
        VALUES ($1, $2, $3, $4)
      `, [meetingId, transcript, summary, keyPoints || []]);
    }

    return {
      success: true,
      data: {
        meetingId,
        title: meetingTitle
      }
    };
  }

  private async extractInsights(params: any, context: AgentContext): Promise<TaskResult> {
    const { meetingId, insights } = params;

    const insertedInsights = [];

    for (const insight of insights) {
      const result = await query(`
        INSERT INTO wendy_meetings.insights
          (meeting_id, insight_type, insight_text, importance_score)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [
        meetingId,
        insight.type,
        insight.text,
        insight.importanceScore || 0.5
      ]);

      insertedInsights.push(result.rows[0].id);

      // If high-importance strategic insight, notify Alice
      if (insight.type === 'strategic' && (insight.importanceScore || 0) > 0.7) {
        await this.sendMessage('Alice', 'strategic_insight', {
          insightId: result.rows[0].id,
          text: insight.text,
          meetingId
        });
      }
    }

    return {
      success: true,
      data: {
        insightCount: insertedInsights.length,
        insightIds: insertedInsights
      }
    };
  }

  private async manageActions(params: any, context: AgentContext): Promise<TaskResult> {
    const { meetingId, actions } = params;

    const createdActions = [];

    for (const action of actions) {
      const result = await query(`
        INSERT INTO wendy_meetings.action_items
          (meeting_id, action_description, assigned_to, due_date, priority, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        meetingId,
        action.description,
        action.assignedTo,
        action.dueDate,
        action.priority || 'medium',
        action.status || 'pending'
      ]);

      createdActions.push({
        id: result.rows[0].id,
        description: action.description,
        assignedTo: action.assignedTo
      });

      // If high priority, notify relevant agents
      if (action.priority === 'high') {
        const agentMap: Record<string, string> = {
          'Alice': 'Alice',
          'Dorothy': 'Dorothy',
          'Belle': 'Belle',
          'Anna': 'Anna',
          'Aurora': 'Aurora',
          'Elsa': 'Elsa'
        };

        const targetAgent = agentMap[action.assignedTo];
        if (targetAgent) {
          await this.sendMessage(targetAgent, 'action_assigned', {
            actionId: result.rows[0].id,
            description: action.description,
            dueDate: action.dueDate
          });
        }
      }
    }

    return {
      success: true,
      data: {
        actionCount: createdActions.length,
        actions: createdActions
      }
    };
  }

  private async summarizeMeetings(params: any, context: AgentContext): Promise<TaskResult> {
    if (!context.projectId) {
      return { success: false, error: 'Project ID required' };
    }

    const meetings = await query(`
      SELECT m.*,
             (SELECT COUNT(*) FROM wendy_meetings.action_items WHERE meeting_id = m.id) as action_count,
             (SELECT COUNT(*) FROM wendy_meetings.insights WHERE meeting_id = m.id) as insight_count
      FROM wendy_meetings.meetings m
      WHERE m.project_id = $1
      ORDER BY m.meeting_date DESC
      LIMIT 10
    `, [context.projectId]);

    const pendingActions = await query(`
      SELECT a.*, m.meeting_title
      FROM wendy_meetings.action_items a
      JOIN wendy_meetings.meetings m ON a.meeting_id = m.id
      WHERE m.project_id = $1 AND a.status = 'pending'
      ORDER BY a.due_date ASC
    `, [context.projectId]);

    return {
      success: true,
      data: {
        recentMeetings: meetings.rows,
        pendingActions: pendingActions.rows,
        totalMeetings: meetings.rowCount,
        totalPendingActions: pendingActions.rowCount
      }
    };
  }
}
