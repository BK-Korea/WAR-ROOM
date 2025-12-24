# WAR-ROOM: Multi-Agent Business Intelligence System

A sophisticated multi-agent system designed to support strategic business intelligence, financial analysis, market research, compliance, and project management.

## Architecture Overview

WAR-ROOM uses a **single PostgreSQL database with schema separation** approach, combining the benefits of:
- Unified data access across agents
- Clear separation of responsibilities
- Easy cross-agent data analysis
- Simplified deployment and maintenance

### Database Structure

```
war_room (PostgreSQL)
├── shared              # Common data (projects, companies, sessions)
├── alice_strategy      # Strategic decisions and goals
├── dorothy_finance     # Financial models and valuations
├── belle_market        # Market intelligence and research
├── anna_compliance     # Regulations and certifications
├── wendy_meetings      # Meeting records and action items
├── aurora_ops          # Operational metrics and processes
├── elsa_risk           # Risk assessments and guardrails
└── amy_tracker         # Project history and change logs
```

## Meet the Agents

### 1. **Alice** - Strategic Lead
- **Role:** Overall strategy and decision-making
- **Responsibilities:**
  - Strategic analysis and planning
  - High-level decision making
  - Goal setting and tracking
  - Cross-functional coordination

### 2. **Dorothy** - Financial Analyst
- **Role:** Financial modeling and valuation
- **Responsibilities:**
  - Create financial models (DCF, Comps, etc.)
  - Calculate company valuations
  - Analyze financial statements
  - Track financial metrics

### 3. **Belle** - Market Intelligence
- **Role:** Market research and competitor analysis
- **Responsibilities:**
  - Conduct market research
  - Gather competitor intelligence
  - Monitor news and industry reports
  - Analyze market trends

### 4. **Anna** - Compliance Specialist
- **Role:** Regulatory compliance and certifications
- **Responsibilities:**
  - Track regulations and requirements
  - Manage certification processes
  - Perform compliance checks
  - Report compliance status

### 5. **Wendy** - Meeting Coordinator
- **Role:** Meeting documentation and action tracking
- **Responsibilities:**
  - Record and transcribe meetings
  - Extract insights from discussions
  - Create and track action items
  - Generate meeting summaries

### 6. **Aurora** - Operations Manager
- **Role:** Internal data and operations
- **Responsibilities:**
  - Track operational metrics
  - Document processes
  - Optimize data collection
  - Manage internal data sources

### 7. **Elsa** - Risk Guardian
- **Role:** Risk assessment and compliance monitoring
- **Responsibilities:**
  - Assess and categorize risks
  - Enforce compliance guardrails
  - Monitor violations
  - Generate risk alerts

### 8. **Amy** - Project Historian
- **Role:** Project tracking and history
- **Responsibilities:**
  - Log project events
  - Track milestones
  - Generate project timelines
  - Audit change history

## Agent Communication

Agents communicate through a message-passing system orchestrated by the `WarRoom` class:

```typescript
// Example: Alice requests financial analysis from Dorothy
await alice.sendMessage('Dorothy', 'request_analysis', {
  projectId: 1,
  modelType: 'DCF'
});

// Dorothy receives and processes the request
// Dorothy sends results back to Alice
```

### Key Message Flows

1. **Strategic Decision Flow:**
   - Alice → Dorothy (request financial data)
   - Alice → Belle (request market data)
   - Alice → Elsa (risk assessment)
   - Alice makes decision

2. **Risk Monitoring Flow:**
   - Belle → Elsa (negative news detected)
   - Anna → Elsa (compliance issue)
   - Aurora → Elsa (metric alert)
   - Elsa → Alice (critical risk notification)

3. **Action Item Flow:**
   - Wendy creates action items
   - Wendy → relevant agent (high-priority actions)
   - Amy logs all activities

## Installation

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Run database migration
npm run db:migrate

# Seed with sample data
npm run db:seed
```

## Usage

### Basic Usage

```typescript
import { WarRoom } from './src/index.js';

const warRoom = new WarRoom();
await warRoom.initialize();

// Execute a task with a specific agent
const result = await warRoom.executeTask(
  'Alice',
  'assess_situation',
  {},
  { projectId: 1 }
);

console.log(result);
```

### Collaborative Tasks

```typescript
// Multiple agents working together
const results = await warRoom.runCollaborativeTask({
  projectId: 1,
  taskDescription: 'Comprehensive project review',
  involvedAgents: ['Alice', 'Dorothy', 'Belle', 'Elsa', 'Amy']
});
```

### Individual Agent Tasks

```typescript
// Strategic decision
await warRoom.executeTask('Alice', 'make_decision', {
  title: 'Proceed with acquisition',
  description: 'Strategic analysis complete',
  decisionType: 'acquisition',
  confidenceScore: 0.85
}, { projectId: 1 });

// Financial modeling
await warRoom.executeTask('Dorothy', 'create_model', {
  companyId: 1,
  modelName: 'Company X DCF',
  modelType: 'DCF',
  modelData: { /* ... */ }
}, { projectId: 1 });

// Market research
await warRoom.executeTask('Belle', 'research_market', {
  researchTopic: 'SaaS Market Analysis',
  researchType: 'market_size',
  findings: 'Market expected to reach $50B by 2025'
}, { projectId: 1 });
```

## Development

```bash
# Development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test
```

## Database Schema Highlights

### Shared Data
- **Projects:** Central project information
- **Companies:** Company profiles and details
- **Sessions:** Work session tracking

### Agent-Specific Schemas
Each agent has dedicated tables in their schema:
- Strategic decisions, goals, analysis (Alice)
- Financial models, valuations, statements (Dorothy)
- Market research, competitor intel, news (Belle)
- Regulations, certifications, compliance checks (Anna)
- Meetings, transcripts, action items, insights (Wendy)
- Metrics, processes, optimization logs (Aurora)
- Risk assessments, guardrails, violations, alerts (Elsa)
- Event history, change logs, milestones, timeline (Amy)

## Design Decisions

### Why Single Database?

**Advantages:**
- ✅ Seamless data sharing between agents
- ✅ ACID transactions across schemas
- ✅ Simple backup and disaster recovery
- ✅ Easier deployment and operations
- ✅ Cross-agent analytics and reporting
- ✅ Consistent data model

**Schema Separation Provides:**
- ✅ Clear ownership and boundaries
- ✅ Independent evolution of agent data
- ✅ Fine-grained access control
- ✅ Logical organization
- ✅ Easy migration path if needed

### Agent Collaboration Model

Agents collaborate through:
1. **Direct Messaging:** Asynchronous message passing
2. **Shared Database:** Read access to other schemas
3. **Event Logging:** All activities tracked by Amy
4. **Orchestration:** Coordinated by WarRoom

## Future Enhancements

- [ ] AI/LLM integration for intelligent decision-making
- [ ] Real-time dashboard for agent monitoring
- [ ] Webhook support for external integrations
- [ ] Advanced workflow automation
- [ ] Custom agent plugin system
- [ ] Multi-tenancy support
- [ ] GraphQL API layer

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines first.
