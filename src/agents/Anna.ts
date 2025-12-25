import { BaseAgent } from './BaseAgent';
import { AgentContext, TaskResult } from '../types/agent';
import { query } from '../db/connection';

export class Anna extends BaseAgent {
  constructor() {
    super({
      name: 'Anna',
      role: 'Compliance Specialist',
      description: 'Industry certifications, regulations, and legal compliance',
      capabilities: [
        {
          name: 'track_regulation',
          description: 'Track and monitor regulatory requirements'
        },
        {
          name: 'manage_certification',
          description: 'Manage certification processes'
        },
        {
          name: 'check_compliance',
          description: 'Perform compliance checks'
        },
        {
          name: 'report_status',
          description: 'Report compliance status'
        }
      ],
      schema: 'anna_compliance'
    });
  }

  protected async onInitialize(): Promise<void> {
    console.log('Anna is ready to ensure compliance');
  }

  protected async performTask(task: string, params: any, context: AgentContext): Promise<TaskResult> {
    switch (task) {
      case 'track_regulation':
        return await this.trackRegulation(params, context);
      case 'manage_certification':
        return await this.manageCertification(params, context);
      case 'check_compliance':
        return await this.checkCompliance(params, context);
      case 'report_status':
        return await this.reportStatus(params, context);
      default:
        return {
          success: false,
          error: `Unknown task: ${task}`
        };
    }
  }

  private async trackRegulation(params: any, context: AgentContext): Promise<TaskResult> {
    const {
      regulationName,
      jurisdiction,
      industry,
      category,
      description,
      effectiveDate,
      requirements,
      sourceUrl
    } = params;

    const result = await query(`
      INSERT INTO anna_compliance.regulations
        (regulation_name, jurisdiction, industry, category, description,
         effective_date, requirements, source_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      regulationName,
      jurisdiction,
      industry,
      category,
      description,
      effectiveDate,
      requirements || [],
      sourceUrl
    ]);

    // Notify Elsa about new regulation for risk assessment
    await this.sendMessage('Elsa', 'new_regulation', {
      regulationId: result.rows[0].id,
      name: regulationName,
      effectiveDate
    });

    return {
      success: true,
      data: {
        regulationId: result.rows[0].id,
        name: regulationName
      }
    };
  }

  private async manageCertification(params: any, context: AgentContext): Promise<TaskResult> {
    const {
      certificationName,
      certifyingBody,
      status,
      applicationDate,
      expiryDate,
      requirements,
      notes
    } = params;

    const result = await query(`
      INSERT INTO anna_compliance.certifications
        (project_id, certification_name, certifying_body, status,
         application_date, expiry_date, requirements, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      context.projectId,
      certificationName,
      certifyingBody,
      status,
      applicationDate,
      expiryDate,
      requirements || [],
      notes
    ]);

    // Create action items in Wendy's system if certification is in progress
    if (status === 'in_progress' || status === 'required') {
      await this.sendMessage('Wendy', 'create_certification_actions', {
        certificationId: result.rows[0].id,
        name: certificationName,
        requirements
      });
    }

    // Notify Alice about certification status
    await this.sendMessage('Alice', 'certification_update', {
      certificationId: result.rows[0].id,
      name: certificationName,
      status
    });

    return {
      success: true,
      data: {
        certificationId: result.rows[0].id,
        name: certificationName,
        status
      }
    };
  }

  private async checkCompliance(params: any, context: AgentContext): Promise<TaskResult> {
    const { regulationId, complianceStatus, findings, recommendations } = params;

    const result = await query(`
      INSERT INTO anna_compliance.compliance_checks
        (project_id, regulation_id, check_date, compliance_status, findings, recommendations)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      context.projectId,
      regulationId,
      new Date(),
      complianceStatus,
      findings,
      recommendations || []
    ]);

    // If non-compliant, notify Elsa for risk assessment
    if (complianceStatus === 'non_compliant') {
      await this.sendMessage('Elsa', 'compliance_issue', {
        checkId: result.rows[0].id,
        regulationId,
        findings
      });
    }

    return {
      success: true,
      data: {
        checkId: result.rows[0].id,
        status: complianceStatus,
        recommendations
      }
    };
  }

  private async reportStatus(params: any, context: AgentContext): Promise<TaskResult> {
    if (!context.projectId) {
      return { success: false, error: 'Project ID required' };
    }

    const certifications = await query(`
      SELECT * FROM anna_compliance.certifications
      WHERE project_id = $1
      ORDER BY status, expiry_date
    `, [context.projectId]);

    const checks = await query(`
      SELECT c.*, r.regulation_name
      FROM anna_compliance.compliance_checks c
      JOIN anna_compliance.regulations r ON c.regulation_id = r.id
      WHERE c.project_id = $1
      ORDER BY c.check_date DESC
      LIMIT 10
    `, [context.projectId]);

    const summary = {
      totalCertifications: certifications.rowCount,
      required: certifications.rows.filter((c: any) => c.status === 'required').length,
      inProgress: certifications.rows.filter((c: any) => c.status === 'in_progress').length,
      obtained: certifications.rows.filter((c: any) => c.status === 'obtained').length,
      recentChecks: checks.rows,
      nonCompliant: checks.rows.filter((c: any) => c.compliance_status === 'non_compliant').length
    };

    return {
      success: true,
      data: summary
    };
  }
}
