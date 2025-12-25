import { Agent, AgentContext, AgentMessage, TaskResult } from '../types/agent';
import { Alice } from '../agents/Alice';
import { Dorothy } from '../agents/Dorothy';
import { Belle } from '../agents/Belle';
import { Anna } from '../agents/Anna';
import { Wendy } from '../agents/Wendy';
import { Aurora } from '../agents/Aurora';
import { Elsa } from '../agents/Elsa';
import { Amy } from '../agents/Amy';

export class WarRoom {
  private agents: Map<string, Agent>;
  private messageQueue: AgentMessage[];
  private isProcessing: boolean;

  constructor() {
    this.agents = new Map();
    this.messageQueue = [];
    this.isProcessing = false;
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing WAR-ROOM...\n');

    // Create all agents
    const alice = new Alice();
    const dorothy = new Dorothy();
    const belle = new Belle();
    const anna = new Anna();
    const wendy = new Wendy();
    const aurora = new Aurora();
    const elsa = new Elsa();
    const amy = new Amy();

    // Register agents
    this.agents.set('Alice', alice);
    this.agents.set('Dorothy', dorothy);
    this.agents.set('Belle', belle);
    this.agents.set('Anna', anna);
    this.agents.set('Wendy', wendy);
    this.agents.set('Aurora', aurora);
    this.agents.set('Elsa', elsa);
    this.agents.set('Amy', amy);

    // Initialize all agents
    for (const [name, agent] of this.agents) {
      await agent.initialize();
    }

    // Patch send message to use orchestrator
    this.patchAgentMessaging();

    console.log('\n✅ WAR-ROOM initialized successfully!');
    console.log(`📊 ${this.agents.size} agents ready\n`);
  }

  private patchAgentMessaging(): void {
    for (const agent of this.agents.values()) {
      const originalSendMessage = (agent as any).sendMessage.bind(agent);
      (agent as any).sendMessage = async (to: string, type: string, payload: any) => {
        await this.routeMessage({
          from: agent.metadata.name,
          to,
          type,
          payload,
          timestamp: new Date()
        });
        await originalSendMessage(to, type, payload);
      };
    }
  }

  async executeTask(
    agentName: string,
    task: string,
    params: any,
    context: AgentContext
  ): Promise<TaskResult> {
    const agent = this.agents.get(agentName);

    if (!agent) {
      return {
        success: false,
        error: `Agent not found: ${agentName}`
      };
    }

    console.log(`\n🎯 Executing task: ${agentName} -> ${task}`);
    const result = await agent.execute(task, params, context);

    // Process any queued messages
    await this.processMessageQueue();

    return result;
  }

  private async routeMessage(message: AgentMessage): Promise<void> {
    this.messageQueue.push(message);
  }

  private async processMessageQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (!message) continue;

      const recipient = this.agents.get(message.to);
      if (recipient) {
        console.log(`📨 Message: ${message.from} -> ${message.to} (${message.type})`);
        await recipient.handleMessage(message);
      } else {
        console.warn(`⚠️  No recipient found for message to: ${message.to}`);
      }
    }

    this.isProcessing = false;
  }

  async getAgent(name: string): Promise<Agent | undefined> {
    return this.agents.get(name);
  }

  async getAllAgentStatuses(): Promise<any> {
    const statuses: any = {};

    for (const [name, agent] of this.agents) {
      statuses[name] = await agent.getStatus();
    }

    return statuses;
  }

  async runCollaborativeTask(params: {
    projectId: number;
    taskDescription: string;
    involvedAgents: string[];
  }): Promise<any> {
    const context: AgentContext = {
      projectId: params.projectId
    };

    console.log(`\n🤝 Collaborative Task: ${params.taskDescription}`);
    console.log(`👥 Involved agents: ${params.involvedAgents.join(', ')}\n`);

    const results: any = {};

    // Execute tasks in sequence, allowing agents to communicate
    for (const agentName of params.involvedAgents) {
      const agent = this.agents.get(agentName);
      if (!agent) {
        console.warn(`⚠️  Agent not found: ${agentName}`);
        continue;
      }

      // Let each agent contribute based on their role
      const taskMap: Record<string, string> = {
        'Alice': 'assess_situation',
        'Dorothy': 'track_metrics',
        'Belle': 'research_market',
        'Anna': 'report_status',
        'Wendy': 'summarize_meetings',
        'Aurora': 'track_metrics',
        'Elsa': 'monitor_violations',
        'Amy': 'generate_timeline'
      };

      const task = taskMap[agentName];
      if (task) {
        results[agentName] = await this.executeTask(agentName, task, {}, context);
      }
    }

    return results;
  }

  async shutdown(): Promise<void> {
    console.log('\n👋 Shutting down WAR-ROOM...');
    this.agents.clear();
    this.messageQueue = [];
    console.log('✅ WAR-ROOM shut down successfully');
  }
}
