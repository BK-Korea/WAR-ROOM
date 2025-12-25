import { BaseAgent } from './BaseAgent';
import { AgentContext, TaskResult } from '../types/agent';
import { query } from '../db/connection';

export class Belle extends BaseAgent {
  constructor() {
    super({
      name: 'Belle',
      role: 'Market Intelligence',
      description: 'Market research, competitor intelligence, and news monitoring',
      capabilities: [
        {
          name: 'research_market',
          description: 'Conduct market research and analysis'
        },
        {
          name: 'gather_intel',
          description: 'Gather competitor intelligence'
        },
        {
          name: 'monitor_news',
          description: 'Monitor and analyze news and articles'
        },
        {
          name: 'analyze_reports',
          description: 'Analyze industry reports'
        }
      ],
      schema: 'belle_market'
    });
  }

  protected async onInitialize(): Promise<void> {
    console.log('Belle is ready to gather market intelligence');
  }

  protected async performTask(task: string, params: any, context: AgentContext): Promise<TaskResult> {
    switch (task) {
      case 'research_market':
        return await this.researchMarket(params, context);
      case 'gather_intel':
        return await this.gatherIntel(params, context);
      case 'monitor_news':
        return await this.monitorNews(params, context);
      case 'analyze_reports':
        return await this.analyzeReports(params, context);
      default:
        return {
          success: false,
          error: `Unknown task: ${task}`
        };
    }
  }

  private async researchMarket(params: any, context: AgentContext): Promise<TaskResult> {
    const { researchTopic, researchType, findings, sources, data } = params;

    const result = await query(`
      INSERT INTO belle_market.research
        (project_id, research_topic, research_type, findings, sources, data)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      context.projectId,
      researchTopic,
      researchType,
      findings,
      sources || [],
      JSON.stringify(data || {})
    ]);

    // Notify Alice about new market research
    await this.sendMessage('Alice', 'research_complete', {
      researchId: result.rows[0].id,
      topic: researchTopic,
      findings
    });

    return {
      success: true,
      data: {
        researchId: result.rows[0].id,
        topic: researchTopic
      }
    };
  }

  private async gatherIntel(params: any, context: AgentContext): Promise<TaskResult> {
    const {
      companyId,
      competitorName,
      intelType,
      summary,
      details,
      sourceUrl,
      credibilityScore
    } = params;

    const result = await query(`
      INSERT INTO belle_market.competitor_intel
        (company_id, competitor_name, intel_type, summary, details, source_url, credibility_score)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      companyId,
      competitorName,
      intelType,
      summary,
      JSON.stringify(details || {}),
      sourceUrl,
      credibilityScore || 0.7
    ]);

    // Check if this is critical intel - notify Alice
    if (intelType === 'strategy' || intelType === 'pricing') {
      await this.sendMessage('Alice', 'critical_intel', {
        intelId: result.rows[0].id,
        competitor: competitorName,
        type: intelType,
        summary
      });
    }

    return {
      success: true,
      data: {
        intelId: result.rows[0].id,
        competitor: competitorName
      }
    };
  }

  private async monitorNews(params: any, context: AgentContext): Promise<TaskResult> {
    const {
      companyId,
      title,
      content,
      source,
      url,
      publishedDate,
      sentiment,
      relevanceScore,
      tags
    } = params;

    const result = await query(`
      INSERT INTO belle_market.news_articles
        (company_id, title, content, source, url, published_date, sentiment, relevance_score, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      companyId,
      title,
      content,
      source,
      url,
      publishedDate,
      sentiment || 'neutral',
      relevanceScore || 0.5,
      tags || []
    ]);

    // If negative sentiment and high relevance, notify Elsa (risk monitoring)
    if (sentiment === 'negative' && (relevanceScore || 0) > 0.7) {
      await this.sendMessage('Elsa', 'news_risk', {
        articleId: result.rows[0].id,
        title,
        sentiment
      });
    }

    return {
      success: true,
      data: {
        articleId: result.rows[0].id,
        title,
        sentiment
      }
    };
  }

  private async analyzeReports(params: any, context: AgentContext): Promise<TaskResult> {
    const {
      reportTitle,
      industry,
      publisher,
      publicationDate,
      summary,
      keyFindings,
      reportUrl
    } = params;

    const result = await query(`
      INSERT INTO belle_market.reports
        (report_title, industry, publisher, publication_date, summary, key_findings, report_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      reportTitle,
      industry,
      publisher,
      publicationDate,
      summary,
      keyFindings || [],
      reportUrl
    ]);

    // Share key findings with Alice
    await this.sendMessage('Alice', 'report_analyzed', {
      reportId: result.rows[0].id,
      title: reportTitle,
      keyFindings
    });

    return {
      success: true,
      data: {
        reportId: result.rows[0].id,
        title: reportTitle
      }
    };
  }
}
