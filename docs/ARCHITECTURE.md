# WAR-ROOM Architecture

## System Overview

WAR-ROOM is a multi-agent system designed for business intelligence and strategic decision-making. The architecture follows these key principles:

1. **Agent Autonomy:** Each agent operates independently with its own responsibilities
2. **Shared Knowledge Base:** Single database with schema separation
3. **Message-Based Communication:** Asynchronous messaging between agents
4. **Event Sourcing:** Complete audit trail through Amy's tracking
5. **Guardrails:** Elsa enforces compliance and risk boundaries

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         WarRoom                             │
│                    (Orchestrator)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Message Queue & Router                   │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────┬────────────────────────────────┬──────────────┘
             │                                │
    ┌────────┴────────┐              ┌───────┴────────┐
    │     Agents       │              │   Database     │
    │                  │              │   PostgreSQL   │
    │  ┌────────────┐  │              │                │
    │  │   Alice    │──┼──────────────┼─→ alice_strategy
    │  │  (Strategy)│  │              │
    │  └────────────┘  │              │
    │                  │              │
    │  ┌────────────┐  │              │
    │  │  Dorothy   │──┼──────────────┼─→ dorothy_finance
    │  │ (Finance)  │  │              │
    │  └────────────┘  │              │
    │                  │              │
    │  ┌────────────┐  │              │
    │  │   Belle    │──┼──────────────┼─→ belle_market
    │  │  (Market)  │  │              │
    │  └────────────┘  │              │
    │                  │              │
    │  ┌────────────┐  │              │
    │  │    Anna    │──┼──────────────┼─→ anna_compliance
    │  │(Compliance)│  │              │
    │  └────────────┘  │              │
    │                  │              │
    │  ┌────────────┐  │              │
    │  │   Wendy    │──┼──────────────┼─→ wendy_meetings
    │  │ (Meetings) │  │              │
    │  └────────────┘  │              │
    │                  │              │
    │  ┌────────────┐  │              │
    │  │  Aurora    │──┼──────────────┼─→ aurora_ops
    │  │   (Ops)    │  │              │
    │  └────────────┘  │              │
    │                  │              │
    │  ┌────────────┐  │              │
    │  │    Elsa    │──┼──────────────┼─→ elsa_risk
    │  │   (Risk)   │  │              │
    │  └────────────┘  │              │
    │                  │              │
    │  ┌────────────┐  │              │
    │  │    Amy     │──┼──────────────┼─→ amy_tracker
    │  │ (Tracker)  │  │              │
    │  └────────────┘  │              │
    │                  │              │
    └──────────────────┘              │
                                      │
                              ┌───────┴────────┐
                              │  shared schema │
                              │  - projects    │
                              │  - companies   │
                              │  - sessions    │
                              └────────────────┘
```

## Data Flow Patterns

### 1. Strategic Decision Flow

```
User Request
    │
    ↓
  Alice (assess situation)
    │
    ├─→ Dorothy (financial data)
    │      │
    │      └─→ Returns: financial models, valuations
    │
    ├─→ Belle (market data)
    │      │
    │      └─→ Returns: market research, competitor intel
    │
    ├─→ Elsa (risk check)
    │      │
    │      └─→ Returns: risk assessment
    │
    ↓
  Alice (make decision)
    │
    ├─→ Amy (log decision)
    │
    └─→ Returns: decision to user
```

### 2. Compliance Monitoring Flow

```
Anna (compliance check)
    │
    ├─→ non-compliant? ─→ Elsa (assess risk)
    │                          │
    │                          └─→ critical? ─→ Alice (notify)
    │
    ├─→ requires certification? ─→ Wendy (create action items)
    │
    └─→ Amy (log compliance activity)
```

### 3. Meeting Processing Flow

```
Wendy (record meeting)
    │
    ├─→ Store: transcript, summary
    │
    ├─→ Extract insights
    │      │
    │      └─→ strategic insight? ─→ Alice (notify)
    │
    ├─→ Create action items
    │      │
    │      └─→ high priority? ─→ Notify assigned agent
    │
    └─→ Amy (log meeting activity)
```

## Database Design

### Schema Separation Strategy

Each agent has its own schema to:
1. **Isolate Concerns:** Clear boundaries between agent responsibilities
2. **Enable Evolution:** Agents can evolve their schema independently
3. **Control Access:** Fine-grained permissions per schema
4. **Organize Data:** Logical grouping of related tables

### Cross-Schema Queries

Agents can read from other schemas for analysis:

```sql
-- Alice querying Dorothy's financial data
SELECT fm.*, v.enterprise_value
FROM dorothy_finance.financial_models fm
JOIN dorothy_finance.valuations v ON v.financial_model_id = fm.id
WHERE fm.project_id = $1;

-- Elsa checking compliance from Anna
SELECT c.*, r.regulation_name
FROM anna_compliance.compliance_checks c
JOIN anna_compliance.regulations r ON c.regulation_id = r.id
WHERE c.compliance_status = 'non_compliant';
```

### Shared Schema

The `shared` schema contains:
- **Projects:** Central project information shared by all agents
- **Companies:** Company profiles referenced across agents
- **Sessions:** Work sessions for tracking agent activities

## Agent Communication Protocol

### Message Structure

```typescript
interface AgentMessage {
  from: string;        // Sender agent name
  to: string;          // Recipient agent name
  type: string;        // Message type (e.g., 'request_analysis')
  payload: any;        // Message data
  timestamp: Date;     // When message was sent
}
```

### Message Types

**Request Messages:**
- `request_analysis` - Request data analysis
- `request_research` - Request market research
- `assess_decision` - Request risk assessment
- `create_milestone` - Create project milestone

**Notification Messages:**
- `model_created` - Notify of new financial model
- `critical_risk` - Alert of critical risk
- `compliance_issue` - Alert of compliance problem
- `milestone_completed` - Notify of milestone completion

**Data Messages:**
- `research_complete` - Share research results
- `valuation_complete` - Share valuation results
- `strategic_insight` - Share meeting insight

## Scalability Considerations

### Current Design (Single DB)
- **Optimal for:** Up to 10,000 projects, 100,000 records per schema
- **Benefits:** Simple, consistent, easy to maintain
- **Limitations:** Single point of failure, vertical scaling

### Future Migration Path

If needed, the architecture can evolve:

1. **Read Replicas:** Add PostgreSQL read replicas for query scaling
2. **Schema to DB:** Migrate each schema to separate database
3. **Microservices:** Convert agents to separate services
4. **Event Store:** Add dedicated event sourcing system
5. **Cache Layer:** Add Redis for frequently accessed data

## Security & Access Control

### Database Permissions

```sql
-- Agent-specific roles
CREATE ROLE alice_agent;
GRANT ALL ON SCHEMA alice_strategy TO alice_agent;
GRANT SELECT ON shared.* TO alice_agent;
GRANT SELECT ON dorothy_finance.* TO alice_agent; -- read-only cross-schema

-- Similar for each agent...
```

### Guardrails

Elsa enforces:
- Business rule violations
- Compliance requirements
- Data validation rules
- Risk thresholds

## Monitoring & Observability

### Agent Metrics

Each agent tracks:
- Task execution count
- Success/failure rates
- Processing times
- Resource usage

### System Metrics

- Message queue length
- Database connection pool usage
- Query performance
- Agent response times

### Audit Trail

Amy maintains complete history:
- All agent activities
- Data changes
- Decision points
- Milestone tracking

## Performance Optimization

### Indexing Strategy

- Primary keys on all ID columns
- Foreign key indexes for joins
- Composite indexes for common queries
- JSONB GIN indexes for document fields

### Query Optimization

- Use prepared statements
- Batch inserts where possible
- Limit result sets
- Use pagination for large datasets

### Connection Pooling

- Max 20 connections per pool
- Connection timeout: 2 seconds
- Idle timeout: 30 seconds

## Error Handling

### Agent Level
- Try/catch in task execution
- State transitions (idle → busy → error)
- Error logging and reporting

### System Level
- Message queue retry logic
- Database transaction rollback
- Graceful degradation

## Testing Strategy

### Unit Tests
- Individual agent methods
- Database operations
- Message handlers

### Integration Tests
- Agent communication flows
- Database schema validation
- End-to-end workflows

### Performance Tests
- Load testing with multiple concurrent tasks
- Database query performance
- Message queue throughput

## Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Docker
```dockerfile
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD ["npm", "start"]
```

## Conclusion

The WAR-ROOM architecture balances:
- **Simplicity:** Single database, clear agent boundaries
- **Flexibility:** Agents can evolve independently
- **Collaboration:** Easy inter-agent communication
- **Scalability:** Clear migration path for growth
- **Maintainability:** Well-organized, documented system
