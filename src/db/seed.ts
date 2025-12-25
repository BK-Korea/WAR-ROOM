import { query, closePool } from './connection';

async function seed() {
  console.log('Seeding database with sample data...');

  try {
    // Create a sample project
    const projectResult = await query(`
      INSERT INTO shared.projects (name, description, status)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Tech Startup Evaluation', 'Evaluating acquisition of a SaaS company', 'active']);

    const projectId = projectResult.rows[0].id;
    console.log(`✅ Created project: ${projectId}`);

    // Create a sample company
    const companyResult = await query(`
      INSERT INTO shared.companies (name, industry, website, description)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, ['CloudTech Solutions', 'SaaS', 'https://cloudtech.example.com', 'Cloud-based project management software']);

    const companyId = companyResult.rows[0].id;
    console.log(`✅ Created company: ${companyId}`);

    // Alice: Strategic decision
    await query(`
      INSERT INTO alice_strategy.decisions (project_id, decision_type, title, description, confidence_score, status)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [projectId, 'acquisition', 'Proceed with Due Diligence', 'Initial analysis shows strong product-market fit and growth potential', 0.75, 'approved']);
    console.log('✅ Alice: Created strategic decision');

    // Dorothy: Financial model
    await query(`
      INSERT INTO dorothy_finance.financial_models (project_id, company_id, model_name, model_type, model_data)
      VALUES ($1, $2, $3, $4, $5)
    `, [projectId, companyId, 'CloudTech DCF Model', 'DCF', JSON.stringify({
      revenue_2024: 5000000,
      growth_rate: 0.35,
      ebitda_margin: 0.25
    })]);
    console.log('✅ Dorothy: Created financial model');

    // Belle: Market research
    await query(`
      INSERT INTO belle_market.research (project_id, research_topic, research_type, findings)
      VALUES ($1, $2, $3, $4)
    `, [projectId, 'SaaS Project Management Market', 'market_size', 'Global market expected to reach $15B by 2025, growing at 12% CAGR']);
    console.log('✅ Belle: Created market research');

    // Anna: Compliance check
    await query(`
      INSERT INTO anna_compliance.certifications (project_id, certification_name, certifying_body, status)
      VALUES ($1, $2, $3, $4)
    `, [projectId, 'SOC 2 Type II', 'AICPA', 'required']);
    console.log('✅ Anna: Created compliance item');

    // Wendy: Meeting record
    const meetingResult = await query(`
      INSERT INTO wendy_meetings.meetings (project_id, meeting_title, meeting_date, participants, duration_minutes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [projectId, 'Initial Strategy Discussion', new Date(), ['Alice', 'Dorothy', 'Belle'], 60]);

    const meetingId = meetingResult.rows[0].id;

    await query(`
      INSERT INTO wendy_meetings.action_items (meeting_id, action_description, assigned_to, due_date, priority, status)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [meetingId, 'Complete financial model', 'Dorothy', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'high', 'in_progress']);
    console.log('✅ Wendy: Created meeting and action item');

    // Aurora: Operational metric
    await query(`
      INSERT INTO aurora_ops.metrics (project_id, metric_name, metric_category, metric_value, unit, measurement_date)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [projectId, 'Customer Churn Rate', 'retention', 5.2, 'percentage', new Date()]);
    console.log('✅ Aurora: Created operational metric');

    // Elsa: Risk assessment
    await query(`
      INSERT INTO elsa_risk.assessments (project_id, risk_category, risk_description, likelihood, impact, risk_score)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [projectId, 'market', 'Increased competition from established players', 'medium', 'medium', 0.60]);
    console.log('✅ Elsa: Created risk assessment');

    // Amy: Project history
    await query(`
      INSERT INTO amy_tracker.history (project_id, event_type, event_description, changed_by)
      VALUES ($1, $2, $3, $4)
    `, [projectId, 'project_created', 'Project initiated for CloudTech evaluation', 'System']);

    await query(`
      INSERT INTO amy_tracker.milestones (project_id, milestone_name, description, target_date, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [projectId, 'Complete Due Diligence', 'Finish all due diligence activities', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'in_progress']);
    console.log('✅ Amy: Created project history and milestone');

    console.log('\n✅ Database seeded successfully!');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await closePool();
  }
}

seed();
