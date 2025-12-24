import { Agent, AgentContext, AgentMessage, AgentMetadata, AgentStatus, TaskResult } from '../types/agent.js';
import { query } from '../db/connection.js';

export abstract class BaseAgent implements Agent {
  public metadata: AgentMetadata;
  protected state: 'idle' | 'busy' | 'error' = 'idle';
  protected currentTask?: string;
  protected lastActivity?: Date;
  protected messageHandlers: Map<string, (message: AgentMessage) => Promise<void>>;

  constructor(metadata: AgentMetadata) {
    this.metadata = metadata;
    this.messageHandlers = new Map();
    this.setupMessageHandlers();
  }

  async initialize(): Promise<void> {
    console.log(`Initializing ${this.metadata.name}...`);
    await this.onInitialize();
    console.log(`✅ ${this.metadata.name} initialized`);
  }

  protected abstract onInitialize(): Promise<void>;

  async execute(task: string, params: any, context: AgentContext): Promise<TaskResult> {
    this.state = 'busy';
    this.currentTask = task;
    this.lastActivity = new Date();

    try {
      console.log(`[${this.metadata.name}] Executing task: ${task}`);
      const result = await this.performTask(task, params, context);

      // Log activity to Amy's tracker
      await this.logActivity(task, context, result);

      this.state = 'idle';
      this.currentTask = undefined;
      return result;

    } catch (error) {
      console.error(`[${this.metadata.name}] Task failed:`, error);
      this.state = 'error';
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  protected abstract performTask(task: string, params: any, context: AgentContext): Promise<TaskResult>;

  async handleMessage(message: AgentMessage): Promise<void> {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      await handler(message);
    } else {
      console.warn(`[${this.metadata.name}] No handler for message type: ${message.type}`);
    }
  }

  protected setupMessageHandlers(): void {
    // Override in subclasses to register message handlers
  }

  protected registerMessageHandler(type: string, handler: (message: AgentMessage) => Promise<void>): void {
    this.messageHandlers.set(type, handler);
  }

  async getStatus(): Promise<AgentStatus> {
    return {
      name: this.metadata.name,
      state: this.state,
      currentTask: this.currentTask,
      lastActivity: this.lastActivity,
      metrics: await this.getMetrics()
    };
  }

  protected async getMetrics(): Promise<Record<string, any>> {
    // Override in subclasses for specific metrics
    return {};
  }

  protected async logActivity(task: string, context: AgentContext, result: TaskResult): Promise<void> {
    if (!context.projectId) return;

    try {
      await query(`
        INSERT INTO amy_tracker.activity_timeline (project_id, agent_name, activity_type, activity_description, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        context.projectId,
        this.metadata.name,
        task,
        result.success ? 'Completed successfully' : 'Failed',
        JSON.stringify({ result, timestamp: new Date() })
      ]);
    } catch (error) {
      console.error(`[${this.metadata.name}] Failed to log activity:`, error);
    }
  }

  protected async sendMessage(to: string, type: string, payload: any): Promise<void> {
    const message: AgentMessage = {
      from: this.metadata.name,
      to,
      type,
      payload,
      timestamp: new Date()
    };

    // This will be implemented by the orchestrator
    console.log(`[${this.metadata.name}] Sending message to ${to}:`, type);
  }
}
