export interface AgentContext {
  projectId?: number;
  sessionId?: number;
  userId?: string;
}

export interface AgentMessage {
  from: string;
  to: string;
  type: string;
  payload: any;
  timestamp: Date;
}

export interface AgentCapability {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

export interface AgentMetadata {
  name: string;
  role: string;
  description: string;
  capabilities: AgentCapability[];
  schema: string;
}

export interface TaskResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

export interface Agent {
  metadata: AgentMetadata;
  initialize(): Promise<void>;
  execute(task: string, params: any, context: AgentContext): Promise<TaskResult>;
  handleMessage(message: AgentMessage): Promise<void>;
  getStatus(): Promise<AgentStatus>;
}

export interface AgentStatus {
  name: string;
  state: 'idle' | 'busy' | 'error';
  currentTask?: string;
  lastActivity?: Date;
  metrics?: Record<string, any>;
}
