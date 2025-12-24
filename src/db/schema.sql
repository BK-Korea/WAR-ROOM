-- WAR-ROOM Database Schema
-- Architecture: Single Database with Schema Separation

-- ==============================================
-- SHARED SCHEMA (Common Data)
-- ==============================================

CREATE SCHEMA IF NOT EXISTS shared;

-- Projects table (shared across all agents)
CREATE TABLE shared.projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Companies table (shared)
CREATE TABLE shared.companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    website VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table (for tracking work sessions)
CREATE TABLE shared.sessions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES shared.projects(id),
    session_name VARCHAR(255),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    summary TEXT
);

-- ==============================================
-- ALICE SCHEMA (Strategy)
-- ==============================================

CREATE SCHEMA IF NOT EXISTS alice_strategy;

-- Strategic decisions made by Alice
CREATE TABLE alice_strategy.decisions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES shared.projects(id),
    decision_type VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    rationale TEXT,
    impact_assessment TEXT,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    status VARCHAR(50) DEFAULT 'proposed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Strategic goals
CREATE TABLE alice_strategy.goals (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES shared.projects(id),
    goal_name VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Strategy analysis history
CREATE TABLE alice_strategy.analysis_history (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES shared.projects(id),
    analysis_type VARCHAR(100),
    analysis_data JSONB,
    insights TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- DOROTHY SCHEMA (Finance)
-- ==============================================

CREATE SCHEMA IF NOT EXISTS dorothy_finance;

-- Financial models
CREATE TABLE dorothy_finance.financial_models (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES shared.projects(id),
    company_id INTEGER REFERENCES shared.companies(id),
    model_name VARCHAR(255) NOT NULL,
    model_type VARCHAR(100), -- DCF, Comps, LBO, etc.
    model_data JSONB,
    assumptions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Valuations
CREATE TABLE dorothy_finance.valuations (
    id SERIAL PRIMARY KEY,
    financial_model_id INTEGER REFERENCES dorothy_finance.financial_models(id),
    company_id INTEGER REFERENCES shared.companies(id),
    valuation_date DATE,
    valuation_method VARCHAR(100),
    enterprise_value DECIMAL(20,2),
    equity_value DECIMAL(20,2),
    key_metrics JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Financial statements
CREATE TABLE dorothy_finance.financial_statements (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES shared.companies(id),
    statement_type VARCHAR(50), -- income, balance_sheet, cash_flow
    period_start DATE,
    period_end DATE,
    statement_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- BELLE SCHEMA (Market Intelligence)
-- ==============================================

CREATE SCHEMA IF NOT EXISTS belle_market;

-- Market research
CREATE TABLE belle_market.research (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES shared.projects(id),
    research_topic VARCHAR(255),
    research_type VARCHAR(100), -- market_size, trends, customer_analysis
    findings TEXT,
    sources TEXT[],
    data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Competitor intelligence
CREATE TABLE belle_market.competitor_intel (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES shared.companies(id),
    competitor_name VARCHAR(255),
    intel_type VARCHAR(100), -- product, pricing, strategy, news
    summary TEXT,
    details JSONB,
    source_url VARCHAR(500),
    credibility_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- News and articles
CREATE TABLE belle_market.news_articles (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES shared.companies(id),
    title VARCHAR(500),
    content TEXT,
    source VARCHAR(255),
    url VARCHAR(500),
    published_date TIMESTAMP,
    sentiment VARCHAR(50), -- positive, neutral, negative
    relevance_score DECIMAL(3,2),
    tags VARCHAR(100)[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Market reports
CREATE TABLE belle_market.reports (
    id SERIAL PRIMARY KEY,
    report_title VARCHAR(500),
    industry VARCHAR(100),
    publisher VARCHAR(255),
    publication_date DATE,
    summary TEXT,
    key_findings TEXT[],
    report_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- ANNA SCHEMA (Compliance & Regulations)
-- ==============================================

CREATE SCHEMA IF NOT EXISTS anna_compliance;

-- Regulations tracking
CREATE TABLE anna_compliance.regulations (
    id SERIAL PRIMARY KEY,
    regulation_name VARCHAR(255) NOT NULL,
    jurisdiction VARCHAR(100),
    industry VARCHAR(100),
    category VARCHAR(100),
    description TEXT,
    effective_date DATE,
    requirements TEXT[],
    source_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Certifications tracking
CREATE TABLE anna_compliance.certifications (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES shared.projects(id),
    certification_name VARCHAR(255),
    certifying_body VARCHAR(255),
    status VARCHAR(50), -- required, in_progress, obtained, expired
    application_date DATE,
    expiry_date DATE,
    requirements TEXT[],
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compliance checks
CREATE TABLE anna_compliance.compliance_checks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES shared.projects(id),
    regulation_id INTEGER REFERENCES anna_compliance.regulations(id),
    check_date DATE,
    compliance_status VARCHAR(50), -- compliant, non_compliant, needs_review
    findings TEXT,
    recommendations TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- WENDY SCHEMA (Meetings & Documentation)
-- ==============================================

CREATE SCHEMA IF NOT EXISTS wendy_meetings;

-- Meeting records
CREATE TABLE wendy_meetings.meetings (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES shared.projects(id),
    meeting_title VARCHAR(255),
    meeting_date TIMESTAMP,
    participants VARCHAR(255)[],
    duration_minutes INTEGER,
    meeting_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Meeting transcripts
CREATE TABLE wendy_meetings.transcripts (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES wendy_meetings.meetings(id),
    transcript_text TEXT,
    summary TEXT,
    key_points TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Action items
CREATE TABLE wendy_meetings.action_items (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES wendy_meetings.meetings(id),
    action_description TEXT,
    assigned_to VARCHAR(255),
    due_date DATE,
    priority VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insights extracted from meetings
CREATE TABLE wendy_meetings.insights (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES wendy_meetings.meetings(id),
    insight_type VARCHAR(100),
    insight_text TEXT,
    importance_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- AURORA SCHEMA (Operations & Internal Data)
-- ==============================================

CREATE SCHEMA IF NOT EXISTS aurora_ops;

-- Operational metrics
CREATE TABLE aurora_ops.metrics (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES shared.projects(id),
    metric_name VARCHAR(255),
    metric_category VARCHAR(100),
    metric_value DECIMAL(20,4),
    unit VARCHAR(50),
    measurement_date DATE,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Process documentation
CREATE TABLE aurora_ops.processes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES shared.projects(id),
    process_name VARCHAR(255),
    description TEXT,
    steps TEXT[],
    owner VARCHAR(255),
    frequency VARCHAR(100),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data optimization logs
CREATE TABLE aurora_ops.optimization_logs (
    id SERIAL PRIMARY KEY,
    optimization_type VARCHAR(100),
    target_area VARCHAR(255),
    before_metrics JSONB,
    after_metrics JSONB,
    improvement_percentage DECIMAL(5,2),
    recommendations TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Internal data sources
CREATE TABLE aurora_ops.data_sources (
    id SERIAL PRIMARY KEY,
    source_name VARCHAR(255),
    source_type VARCHAR(100),
    connection_info JSONB,
    last_sync TIMESTAMP,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- ELSA SCHEMA (Risk & Compliance Guardrails)
-- ==============================================

CREATE SCHEMA IF NOT EXISTS elsa_risk;

-- Risk assessments
CREATE TABLE elsa_risk.assessments (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES shared.projects(id),
    risk_category VARCHAR(100),
    risk_description TEXT,
    likelihood VARCHAR(50), -- low, medium, high
    impact VARCHAR(50), -- low, medium, high, critical
    risk_score DECIMAL(3,2),
    mitigation_strategy TEXT,
    status VARCHAR(50) DEFAULT 'identified',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compliance guardrails
CREATE TABLE elsa_risk.guardrails (
    id SERIAL PRIMARY KEY,
    guardrail_name VARCHAR(255),
    category VARCHAR(100),
    description TEXT,
    rule_definition JSONB,
    severity VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Guardrail violations
CREATE TABLE elsa_risk.violations (
    id SERIAL PRIMARY KEY,
    guardrail_id INTEGER REFERENCES elsa_risk.guardrails(id),
    project_id INTEGER REFERENCES shared.projects(id),
    violation_description TEXT,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    status VARCHAR(50) DEFAULT 'open'
);

-- Risk monitoring
CREATE TABLE elsa_risk.monitoring_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(100),
    severity VARCHAR(50),
    message TEXT,
    context JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP
);

-- ==============================================
-- AMY SCHEMA (Project History & Tracking)
-- ==============================================

CREATE SCHEMA IF NOT EXISTS amy_tracker;

-- Project history
CREATE TABLE amy_tracker.history (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES shared.projects(id),
    event_type VARCHAR(100),
    event_description TEXT,
    changed_by VARCHAR(255),
    change_details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Change logs
CREATE TABLE amy_tracker.change_logs (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(100), -- project, decision, model, etc.
    entity_id INTEGER,
    change_type VARCHAR(50), -- create, update, delete
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    changed_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Milestones
CREATE TABLE amy_tracker.milestones (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES shared.projects(id),
    milestone_name VARCHAR(255),
    description TEXT,
    target_date DATE,
    actual_date DATE,
    status VARCHAR(50),
    deliverables TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity timeline
CREATE TABLE amy_tracker.activity_timeline (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES shared.projects(id),
    agent_name VARCHAR(100),
    activity_type VARCHAR(100),
    activity_description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- INDEXES for Performance
-- ==============================================

-- Shared schema indexes
CREATE INDEX idx_projects_status ON shared.projects(status);
CREATE INDEX idx_companies_industry ON shared.companies(industry);
CREATE INDEX idx_sessions_project ON shared.sessions(project_id);

-- Alice indexes
CREATE INDEX idx_alice_decisions_project ON alice_strategy.decisions(project_id);
CREATE INDEX idx_alice_goals_project ON alice_strategy.goals(project_id);

-- Dorothy indexes
CREATE INDEX idx_dorothy_models_project ON dorothy_finance.financial_models(project_id);
CREATE INDEX idx_dorothy_valuations_company ON dorothy_finance.valuations(company_id);

-- Belle indexes
CREATE INDEX idx_belle_research_project ON belle_market.research(project_id);
CREATE INDEX idx_belle_intel_company ON belle_market.competitor_intel(company_id);
CREATE INDEX idx_belle_news_company ON belle_market.news_articles(company_id);

-- Anna indexes
CREATE INDEX idx_anna_compliance_project ON anna_compliance.compliance_checks(project_id);
CREATE INDEX idx_anna_certifications_project ON anna_compliance.certifications(project_id);

-- Wendy indexes
CREATE INDEX idx_wendy_meetings_project ON wendy_meetings.meetings(project_id);
CREATE INDEX idx_wendy_actions_meeting ON wendy_meetings.action_items(meeting_id);

-- Aurora indexes
CREATE INDEX idx_aurora_metrics_project ON aurora_ops.metrics(project_id);
CREATE INDEX idx_aurora_processes_project ON aurora_ops.processes(project_id);

-- Elsa indexes
CREATE INDEX idx_elsa_assessments_project ON elsa_risk.assessments(project_id);
CREATE INDEX idx_elsa_violations_status ON elsa_risk.violations(status);

-- Amy indexes
CREATE INDEX idx_amy_history_project ON amy_tracker.history(project_id);
CREATE INDEX idx_amy_milestones_project ON amy_tracker.milestones(project_id);
CREATE INDEX idx_amy_timeline_project ON amy_tracker.activity_timeline(project_id);

-- ==============================================
-- FUNCTIONS & TRIGGERS
-- ==============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON shared.projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON shared.companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alice_decisions_updated_at BEFORE UPDATE ON alice_strategy.decisions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dorothy_models_updated_at BEFORE UPDATE ON dorothy_finance.financial_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_anna_regulations_updated_at BEFORE UPDATE ON anna_compliance.regulations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_elsa_assessments_updated_at BEFORE UPDATE ON elsa_risk.assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
