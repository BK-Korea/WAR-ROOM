import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export interface GLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GLMCompletionParams {
  model?: string;
  messages: GLMMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface GLMResponse {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class GLMClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.GLM_API_KEY || '';
    this.baseURL = process.env.GLM_API_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
    this.defaultModel = 'glm-4';

    if (!this.apiKey) {
      console.warn('⚠️  GLM_API_KEY not found in environment variables');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
  }

  async chat(params: GLMCompletionParams): Promise<string> {
    try {
      const response = await this.client.post<GLMResponse>('/chat/completions', {
        model: params.model || this.defaultModel,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        top_p: params.top_p ?? 0.9,
        max_tokens: params.max_tokens ?? 2000,
        stream: false
      });

      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error('GLM API Error:', error.response?.data || error.message);
      throw new Error(`GLM API call failed: ${error.message}`);
    }
  }

  async chatWithSystem(systemPrompt: string, userMessage: string, temperature: number = 0.7): Promise<string> {
    return this.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature
    });
  }

  async chatWithHistory(messages: GLMMessage[], temperature: number = 0.7): Promise<string> {
    return this.chat({
      messages,
      temperature
    });
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

// Singleton instance
export const glmClient = new GLMClient();
