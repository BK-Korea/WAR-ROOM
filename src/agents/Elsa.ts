import { BaseAgent } from './BaseAgent.js';
import { AgentContext, AgentMessage, TaskResult } from '../types/agent.js';
import { query } from '../db/connection.js';

export class Elsa extends BaseAgent {
  constructor() {
    super({
      name: 'Elsa',
      role: 'Risk & Compliance Guardian',
      description: 'Risk assessment, compliance monitoring, and guardrail enforcement',
      capabilities: [
        {
          name: 'assess_risk',
          description: 'Assess and categorize risks'
        },
        {
          name: 'enforce_guardrails',
          description: 'Enforce compliance guardrails'
        },
        {
          name: 'monitor_violations',
          description: 'Monitor and report violations'
        },
        {
          name: 'generate_alerts',
          description: 'Generate risk alerts and notifications'
        }
      ],
      schema: 'elsa_risk'
    });
  }

  protected async onInitialize(): Promise<void> {
    console.log('Elsa is ready to guard against risks');
    await this.loadGuardrails();
  }

  private async loadGuardrails(): Promise<void> {
    // Load active guardrails into memory for quick checking
    try {
      const guardrails = await query(`
        SELECT * FROM guardrails WHERE is_active = 1
      `);
      console.log(`Loaded ${guardrails.rowCount} active guardrails`);
    } catch (error) {
      console.warn('⚠️  Could not load guardrails (DB not available)');
    }
  }

  protected setupMessageHandlers(): void {
    this.registerMessageHandler('assess_decision', this.handleAssessDecision.bind(this));
    this.registerMessageHandler('new_regulation', this.handleNewRegulation.bind(this));
    this.registerMessageHandler('compliance_issue', this.handleComplianceIssue.bind(this));
    this.registerMessageHandler('news_risk', this.handleNewsRisk.bind(this));
    this.registerMessageHandler('metric_alert', this.handleMetricAlert.bind(this));
  }

  protected async performTask(task: string, params: any, context: AgentContext): Promise<TaskResult> {
    switch (task) {
      case 'assess_risk':
        return await this.assessRisk(params, context);
      case 'enforce_guardrails':
        return await this.enforceGuardrails(params, context);
      case 'monitor_violations':
        return await this.monitorViolations(params, context);
      case 'generate_alerts':
        return await this.generateAlerts(params, context);
      default:
        return {
          success: false,
          error: `Unknown task: ${task}`
        };
    }
  }

  private async assessRisk(params: any, context: AgentContext): Promise<TaskResult> {
    const {
      riskCategory,
      riskDescription,
      likelihood,
      impact,
      mitigationStrategy
    } = params;

    // Calculate risk score
    const riskScore = this.calculateRiskScore(likelihood, impact);

    const result = await query(`
      INSERT INTO elsa_risk.assessments
        (project_id, risk_category, risk_description, likelihood, impact,
         risk_score, mitigation_strategy, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      context.projectId,
      riskCategory,
      riskDescription,
      likelihood,
      impact,
      riskScore,
      mitigationStrategy,
      'identified'
    ]);

    // If high risk, notify Alice immediately
    if (riskScore > 0.7) {
      await this.sendMessage('Alice', 'critical_risk', {
        riskId: result.rows[0].id,
        category: riskCategory,
        description: riskDescription,
        score: riskScore
      });
    }

    return {
      success: true,
      data: {
        riskId: result.rows[0].id,
        riskScore,
        severity: this.getRiskSeverity(riskScore)
      }
    };
  }

  private calculateRiskScore(likelihood: string, impact: string): number {
    const likelihoodMap: Record<string, number> = {
      'low': 0.2,
      'medium': 0.5,
      'high': 0.8,
      'critical': 1.0
    };

    const impactMap: Record<string, number> = {
      'low': 0.2,
      'medium': 0.5,
      'high': 0.8,
      'critical': 1.0
    };

    return (likelihoodMap[likelihood] || 0.5) * (impactMap[impact] || 0.5);
  }

  private getRiskSeverity(score: number): string {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.3) return 'medium';
    return 'low';
  }

  private async enforceGuardrails(params: any, context: AgentContext): Promise<TaskResult> {
    const { action, data } = params;

    // Get applicable guardrails
    const guardrails = await query(`
      SELECT * FROM elsa_risk.guardrails
      WHERE is_active = true AND category = $1
    `, [params.category || 'general']);

    const violations = [];

    for (const guardrail of guardrails.rows) {
      const isViolated = this.checkGuardrail(guardrail, data);

      if (isViolated) {
        const violation = await query(`
          INSERT INTO elsa_risk.violations
            (guardrail_id, project_id, violation_description, status)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, [
          guardrail.id,
          context.projectId,
          `Guardrail "${guardrail.guardrail_name}" violated: ${isViolated}`,
          'open'
        ]);

        violations.push({
          guardrailName: guardrail.guardrail_name,
          severity: guardrail.severity,
          description: isViolated
        });

        // Send alert
        await this.generateAlert({
          alertType: 'guardrail_violation',
          severity: guardrail.severity,
          message: `Guardrail violated: ${guardrail.guardrail_name}`,
          context: { guardrailId: guardrail.id, violationId: violation.rows[0].id }
        });
      }
    }

    return {
      success: true,
      data: {
        violations,
        blocked: violations.some((v: any) => v.severity === 'critical')
      }
    };
  }

  private checkGuardrail(guardrail: any, data: any): string | null {
    // Simple guardrail checking logic
    const rules = guardrail.rule_definition;

    if (rules.maxValue && data.value > rules.maxValue) {
      return `Value ${data.value} exceeds maximum ${rules.maxValue}`;
    }

    if (rules.minValue && data.value < rules.minValue) {
      return `Value ${data.value} below minimum ${rules.minValue}`;
    }

    if (rules.requiredFields) {
      for (const field of rules.requiredFields) {
        if (!data[field]) {
          return `Required field missing: ${field}`;
        }
      }
    }

    return null;
  }

  private async monitorViolations(params: any, context: AgentContext): Promise<TaskResult> {
    const violations = await query(`
      SELECT v.*, g.guardrail_name, g.severity
      FROM elsa_risk.violations v
      JOIN elsa_risk.guardrails g ON v.guardrail_id = g.id
      WHERE v.project_id = $1 AND v.status = 'open'
      ORDER BY g.severity DESC, v.detected_at DESC
    `, [context.projectId]);

    return {
      success: true,
      data: {
        openViolations: violations.rowCount,
        violations: violations.rows
      }
    };
  }

  private async generateAlerts(params: any, context: AgentContext): Promise<TaskResult> {
    await this.generateAlert(params);

    return {
      success: true,
      data: { alertGenerated: true }
    };
  }

  private async generateAlert(params: any): Promise<void> {
    await query(`
      INSERT INTO elsa_risk.monitoring_alerts
        (alert_type, severity, message, context)
      VALUES ($1, $2, $3, $4)
    `, [
      params.alertType,
      params.severity,
      params.message,
      JSON.stringify(params.context || {})
    ]);

    // If critical, notify Alice
    if (params.severity === 'critical') {
      await this.sendMessage('Alice', 'critical_alert', params);
    }
  }

  // Message handlers
  private async handleAssessDecision(message: AgentMessage): Promise<void> {
    const { decisionId, decision } = message.payload;

    // Assess risks associated with the decision
    await this.assessRisk({
      riskCategory: 'decision',
      riskDescription: `Risk assessment for decision: ${decision.title}`,
      likelihood: 'medium',
      impact: decision.impact || 'medium',
      mitigationStrategy: 'Review and monitor'
    }, { projectId: message.payload.context?.projectId });
  }

  private async handleNewRegulation(message: AgentMessage): Promise<void> {
    // Create a compliance risk
    await this.generateAlert({
      alertType: 'new_regulation',
      severity: 'medium',
      message: `New regulation: ${message.payload.name}`,
      context: { regulationId: message.payload.regulationId }
    });
  }

  private async handleComplianceIssue(message: AgentMessage): Promise<void> {
    // Create high-priority risk
    await this.generateAlert({
      alertType: 'compliance_issue',
      severity: 'high',
      message: 'Compliance issue detected',
      context: message.payload
    });
  }

  private async handleNewsRisk(message: AgentMessage): Promise<void> {
    // Monitor negative news as potential risk
    await this.generateAlert({
      alertType: 'reputation_risk',
      severity: 'medium',
      message: `Negative news detected: ${message.payload.title}`,
      context: message.payload
    });
  }

  private async handleMetricAlert(message: AgentMessage): Promise<void> {
    // Assess operational risk from metrics
    await this.assessRisk({
      riskCategory: 'operational',
      riskDescription: `Metric ${message.payload.name} below threshold`,
      likelihood: 'medium',
      impact: 'medium',
      mitigationStrategy: 'Investigate and address metric decline'
    }, { projectId: message.payload.projectId });
  }
}
