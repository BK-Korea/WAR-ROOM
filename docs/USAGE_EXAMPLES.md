# WAR-ROOM Usage Examples

## Table of Contents
1. [Basic Setup](#basic-setup)
2. [Strategic Decision Making](#strategic-decision-making)
3. [Financial Analysis](#financial-analysis)
4. [Market Research](#market-research)
5. [Compliance Management](#compliance-management)
6. [Meeting Management](#meeting-management)
7. [Risk Assessment](#risk-assessment)
8. [Collaborative Workflows](#collaborative-workflows)

## Basic Setup

```typescript
import { WarRoom } from './src/index.js';

const warRoom = new WarRoom();
await warRoom.initialize();

const context = { projectId: 1 };
```

## Strategic Decision Making

### Assess Current Situation

```typescript
// Alice analyzes the overall project situation
const assessment = await warRoom.executeTask(
  'Alice',
  'assess_situation',
  {},
  context
);

console.log('Financial Models:', assessment.data.financial.model_count);
console.log('Market Research:', assessment.data.market.research_count);
console.log('Critical Risks:', assessment.data.risks.critical_risks);
console.log('Pending Actions:', assessment.data.actions.pending_actions);
```

### Make Strategic Decision

```typescript
// Alice makes a strategic decision
const decision = await warRoom.executeTask(
  'Alice',
  'make_decision',
  {
    title: 'Proceed with Acquisition',
    description: 'Based on financial and market analysis, recommend proceeding',
    decisionType: 'acquisition',
    rationale: 'Strong product-market fit, healthy financials, manageable risks',
    impactAssessment: 'High positive impact on market position',
    confidenceScore: 0.85
  },
  context
);

// This triggers:
// 1. Dorothy provides financial input
// 2. Belle provides market input
// 3. Elsa assesses risks
// 4. Amy logs the decision
```

### Set Strategic Goals

```typescript
const goal = await warRoom.executeTask(
  'Alice',
  'set_goals',
  {
    goalName: 'Complete Due Diligence',
    description: 'Comprehensive due diligence on target company',
    targetDate: '2025-02-28',
    priority: 1
  },
  context
);

// Amy automatically creates a milestone
```

## Financial Analysis

### Create Financial Model

```typescript
const model = await warRoom.executeTask(
  'Dorothy',
  'create_model',
  {
    companyId: 1,
    modelName: 'CloudTech DCF Analysis',
    modelType: 'DCF',
    modelData: {
      revenue_2024: 5000000,
      revenue_growth_rate: 0.35,
      ebitda_margin: 0.25,
      capex_percentage: 0.05,
      nwc_percentage: 0.10,
      discount_rate: 0.12,
      terminal_growth_rate: 0.03,
      projection_years: 5
    },
    assumptions: 'Conservative growth rate, industry-standard margins'
  },
  context
);

console.log('Model ID:', model.data.modelId);
```

### Calculate Valuation

```typescript
const valuation = await warRoom.executeTask(
  'Dorothy',
  'calculate_valuation',
  {
    companyId: 1,
    modelId: model.data.modelId,
    valuationMethod: 'DCF',
    enterpriseValue: 25000000,
    equityValue: 22000000,
    keyMetrics: {
      ev_to_revenue: 5.0,
      ev_to_ebitda: 20.0,
      implied_share_price: 45.00
    }
  },
  context
);

// Alice is automatically notified of the valuation
```

### Analyze Financial Statements

```typescript
const analysis = await warRoom.executeTask(
  'Dorothy',
  'analyze_financials',
  {
    companyId: 1,
    statementType: 'income',
    periodStart: '2024-01-01',
    periodEnd: '2024-12-31',
    statementData: {
      revenue: 5000000,
      grossProfit: 3500000,
      operatingIncome: 1500000,
      netIncome: 1000000
    }
  },
  context
);

console.log('Gross Margin:', analysis.data.analysis.grossMargin + '%');
console.log('Operating Margin:', analysis.data.analysis.operatingMargin + '%');
```

## Market Research

### Conduct Market Research

```typescript
const research = await warRoom.executeTask(
  'Belle',
  'research_market',
  {
    researchTopic: 'SaaS Project Management Market',
    researchType: 'market_size',
    findings: 'Global market expected to reach $15B by 2025, growing at 12% CAGR',
    sources: [
      'Gartner Market Report 2024',
      'Forrester Research',
      'IDC Industry Analysis'
    ],
    data: {
      market_size_2024: 12000000000,
      market_size_2025: 15000000000,
      cagr: 0.12,
      key_drivers: ['digital transformation', 'remote work', 'automation']
    }
  },
  context
);
```

### Gather Competitor Intelligence

```typescript
const intel = await warRoom.executeTask(
  'Belle',
  'gather_intel',
  {
    companyId: 1,
    competitorName: 'Competitor X',
    intelType: 'pricing',
    summary: 'Competitor reduced pricing by 15% to gain market share',
    details: {
      old_pricing: 99,
      new_pricing: 84,
      discount_percentage: 15,
      effective_date: '2025-01-01'
    },
    sourceUrl: 'https://competitor-x.com/pricing',
    credibilityScore: 0.9
  },
  context
);

// Critical intel (pricing, strategy) automatically notifies Alice
```

### Monitor News

```typescript
const news = await warRoom.executeTask(
  'Belle',
  'monitor_news',
  {
    companyId: 1,
    title: 'CloudTech Announces Series B Funding',
    content: 'CloudTech raised $10M in Series B to expand operations...',
    source: 'TechCrunch',
    url: 'https://techcrunch.com/...',
    publishedDate: new Date(),
    sentiment: 'positive',
    relevanceScore: 0.95,
    tags: ['funding', 'growth', 'expansion']
  },
  context
);

// Negative sentiment + high relevance triggers Elsa risk monitoring
```

## Compliance Management

### Track Regulation

```typescript
const regulation = await warRoom.executeTask(
  'Anna',
  'track_regulation',
  {
    regulationName: 'GDPR',
    jurisdiction: 'EU',
    industry: 'Software',
    category: 'Data Privacy',
    description: 'General Data Protection Regulation',
    effectiveDate: '2018-05-25',
    requirements: [
      'Data protection impact assessments',
      'Right to be forgotten',
      'Data portability',
      'Breach notification within 72 hours'
    ],
    sourceUrl: 'https://gdpr.eu/'
  },
  context
);

// Elsa is notified for risk assessment
```

### Manage Certifications

```typescript
const cert = await warRoom.executeTask(
  'Anna',
  'manage_certification',
  {
    certificationName: 'SOC 2 Type II',
    certifyingBody: 'AICPA',
    status: 'in_progress',
    applicationDate: '2025-01-15',
    expiryDate: null,
    requirements: [
      'Security policies documented',
      'Access controls implemented',
      'Monitoring and logging active',
      'Incident response plan',
      'Third-party audit'
    ],
    notes: 'Audit scheduled for March 2025'
  },
  context
);

// Wendy creates action items for in-progress certifications
```

### Perform Compliance Check

```typescript
const check = await warRoom.executeTask(
  'Anna',
  'check_compliance',
  {
    regulationId: 1,
    complianceStatus: 'compliant',
    findings: 'All GDPR requirements met. DPIAs completed, systems updated.',
    recommendations: [
      'Schedule annual compliance review',
      'Update employee training materials'
    ]
  },
  context
);

// Non-compliant status triggers Elsa risk assessment
```

## Meeting Management

### Record Meeting

```typescript
const meeting = await warRoom.executeTask(
  'Wendy',
  'record_meeting',
  {
    meetingTitle: 'Q1 Strategy Review',
    meetingDate: new Date(),
    participants: ['Alice', 'Dorothy', 'Belle', 'CEO', 'CFO'],
    durationMinutes: 90,
    meetingType: 'strategy',
    transcript: 'Full meeting transcript here...',
    summary: 'Discussed Q1 performance and acquisition strategy',
    keyPoints: [
      'Revenue up 25% YoY',
      'Target company identified',
      'Due diligence to begin in February'
    ]
  },
  context
);
```

### Extract Insights

```typescript
const insights = await warRoom.executeTask(
  'Wendy',
  'extract_insights',
  {
    meetingId: meeting.data.meetingId,
    insights: [
      {
        type: 'strategic',
        text: 'CEO emphasized importance of AI capabilities in target',
        importanceScore: 0.9
      },
      {
        type: 'financial',
        text: 'CFO comfortable with valuation range of $20-25M',
        importanceScore: 0.85
      },
      {
        type: 'risk',
        text: 'Concern about customer concentration in target company',
        importanceScore: 0.75
      }
    ]
  },
  context
);

// High-importance strategic insights notify Alice
```

### Manage Action Items

```typescript
const actions = await warRoom.executeTask(
  'Wendy',
  'manage_actions',
  {
    meetingId: meeting.data.meetingId,
    actions: [
      {
        description: 'Complete financial model for target company',
        assignedTo: 'Dorothy',
        dueDate: '2025-02-15',
        priority: 'high'
      },
      {
        description: 'Gather competitive landscape analysis',
        assignedTo: 'Belle',
        dueDate: '2025-02-10',
        priority: 'high'
      },
      {
        description: 'Review regulatory requirements for acquisition',
        assignedTo: 'Anna',
        dueDate: '2025-02-20',
        priority: 'medium'
      }
    ]
  },
  context
);

// High-priority actions notify assigned agents
```

## Risk Assessment

### Assess Risk

```typescript
const risk = await warRoom.executeTask(
  'Elsa',
  'assess_risk',
  {
    riskCategory: 'market',
    riskDescription: 'New competitor with lower pricing entering market',
    likelihood: 'medium',
    impact: 'high',
    mitigationStrategy: 'Differentiate on features and customer service, monitor pricing'
  },
  context
);

console.log('Risk Score:', risk.data.riskScore);
console.log('Severity:', risk.data.severity);

// High-risk scores automatically notify Alice
```

### Enforce Guardrails

```typescript
// Create a guardrail first (one-time setup)
await query(`
  INSERT INTO elsa_risk.guardrails (guardrail_name, category, description, rule_definition, severity)
  VALUES ($1, $2, $3, $4, $5)
`, [
  'Maximum Deal Size',
  'financial',
  'Acquisitions must be under $50M',
  JSON.stringify({ maxValue: 50000000, field: 'deal_value' }),
  'critical'
]);

// Check action against guardrails
const guardCheck = await warRoom.executeTask(
  'Elsa',
  'enforce_guardrails',
  {
    category: 'financial',
    data: {
      deal_value: 45000000
    }
  },
  context
);

if (guardCheck.data.blocked) {
  console.log('Action blocked by guardrails!');
  console.log('Violations:', guardCheck.data.violations);
}
```

## Collaborative Workflows

### Complete Project Review

```typescript
const review = await warRoom.runCollaborativeTask({
  projectId: 1,
  taskDescription: 'Comprehensive quarterly project review',
  involvedAgents: ['Alice', 'Dorothy', 'Belle', 'Anna', 'Elsa', 'Amy']
});

// Each agent contributes their perspective:
// - Alice: Strategic assessment
// - Dorothy: Financial metrics
// - Belle: Market intelligence
// - Anna: Compliance status
// - Elsa: Risk monitoring
// - Amy: Project timeline

console.log('Review Results:', review);
```

### Acquisition Due Diligence Workflow

```typescript
// 1. Alice initiates assessment
const situation = await warRoom.executeTask('Alice', 'assess_situation', {}, context);

// 2. Dorothy creates financial model
const model = await warRoom.executeTask('Dorothy', 'create_model', {
  companyId: 2,
  modelName: 'Target Co DCF',
  modelType: 'DCF',
  modelData: { /* ... */ }
}, context);

// 3. Belle researches market
const market = await warRoom.executeTask('Belle', 'research_market', {
  researchTopic: 'Target Industry Analysis',
  researchType: 'market_size',
  findings: '...'
}, context);

// 4. Anna checks compliance
const compliance = await warRoom.executeTask('Anna', 'report_status', {}, context);

// 5. Elsa assesses risks
const risks = await warRoom.executeTask('Elsa', 'monitor_violations', {}, context);

// 6. Alice makes decision
const decision = await warRoom.executeTask('Alice', 'make_decision', {
  title: 'Acquisition Decision',
  decisionType: 'acquisition',
  description: 'Go/No-Go decision',
  confidenceScore: 0.8
}, context);

// 7. Amy tracks everything
const timeline = await warRoom.executeTask('Amy', 'generate_timeline', {
  limit: 100
}, context);
```

### Weekly Status Update

```typescript
async function weeklyStatusUpdate(projectId: number) {
  const context = { projectId };

  // Get status from all agents
  const [
    strategic,
    financial,
    market,
    compliance,
    meetings,
    operations,
    risks,
    history
  ] = await Promise.all([
    warRoom.executeTask('Alice', 'assess_situation', {}, context),
    warRoom.executeTask('Dorothy', 'track_metrics', { companyId: 1 }, context),
    warRoom.executeTask('Belle', 'research_market', { /* latest research */ }, context),
    warRoom.executeTask('Anna', 'report_status', {}, context),
    warRoom.executeTask('Wendy', 'summarize_meetings', {}, context),
    warRoom.executeTask('Aurora', 'track_metrics', { /* latest metrics */ }, context),
    warRoom.executeTask('Elsa', 'monitor_violations', {}, context),
    warRoom.executeTask('Amy', 'generate_timeline', { limit: 50 }, context)
  ]);

  return {
    strategic: strategic.data,
    financial: financial.data,
    market: market.data,
    compliance: compliance.data,
    meetings: meetings.data,
    operations: operations.data,
    risks: risks.data,
    history: history.data
  };
}

const weeklyReport = await weeklyStatusUpdate(1);
console.log(JSON.stringify(weeklyReport, null, 2));
```

## Advanced Usage

### Custom Workflows

```typescript
class CustomWorkflow {
  constructor(private warRoom: WarRoom) {}

  async executeDeal(projectId: number, companyId: number) {
    const context = { projectId };

    // Phase 1: Initial Assessment
    console.log('Phase 1: Initial Assessment');
    const assessment = await this.warRoom.executeTask(
      'Alice', 'assess_situation', {}, context
    );

    // Phase 2: Deep Dive
    console.log('Phase 2: Financial & Market Analysis');
    await Promise.all([
      this.warRoom.executeTask('Dorothy', 'create_model', {
        companyId,
        modelName: 'Deal Model',
        modelType: 'DCF',
        modelData: { /* ... */ }
      }, context),
      this.warRoom.executeTask('Belle', 'research_market', {
        researchTopic: 'Industry Analysis',
        researchType: 'market_size',
        findings: '...'
      }, context)
    ]);

    // Phase 3: Risk & Compliance
    console.log('Phase 3: Risk Assessment & Compliance');
    await Promise.all([
      this.warRoom.executeTask('Elsa', 'assess_risk', {
        riskCategory: 'deal',
        riskDescription: 'Overall deal risk',
        likelihood: 'medium',
        impact: 'high'
      }, context),
      this.warRoom.executeTask('Anna', 'check_compliance', {
        regulationId: 1,
        complianceStatus: 'compliant',
        findings: '...'
      }, context)
    ]);

    // Phase 4: Decision
    console.log('Phase 4: Final Decision');
    const decision = await this.warRoom.executeTask(
      'Alice', 'make_decision', {
        title: 'Deal Decision',
        decisionType: 'acquisition',
        confidenceScore: 0.85
      }, context
    );

    return decision;
  }
}

const workflow = new CustomWorkflow(warRoom);
await workflow.executeDeal(1, 2);
```
