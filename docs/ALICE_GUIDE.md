## Alice - McKinsey-Level Strategic Consultant Guide

Alice is WAR-ROOM's senior strategic consultant, powered by GLM-4 and designed to provide world-class strategic advice at the level of top consulting firms like McKinsey, BCG, and Bain.

### Core Capabilities

1. **Free-form Consulting (`consult`)**
   - Natural conversation about strategic challenges
   - Maintains conversation history
   - Applies strategic frameworks automatically
   - Provides actionable recommendations

2. **Strategic Analysis (`analyze_strategy`)**
   - Deep analysis using established frameworks
   - Porter's Five Forces, SWOT, BCG Matrix, etc.
   - Considers market, competitive, and financial factors
   - Generates comprehensive strategic reports

3. **Decision Making (`make_decision`)**
   - Structured decision framework
   - Evaluates multiple options against criteria
   - Quantifies expected impact
   - Provides implementation guidance
   - Assesses risks and mitigations

4. **Goal Setting (`set_goals`)**
   - OKR (Objectives and Key Results) framework
   - SMART goal definition
   - Success metrics and tracking
   - Dependencies and risk factors

5. **Situation Assessment (`assess_situation`)**
   - Holistic view across all dimensions
   - Financial, market, risk, operational analysis
   - Executive summary format
   - Prioritized recommendations

### Strategic Frameworks

Alice is trained in and actively uses:

**Competitive Strategy:**
- Porter's Five Forces
- Competitive Positioning Maps
- Value Chain Analysis
- Core Competency Framework

**Growth Strategy:**
- Ansoff Matrix
- BCG Growth-Share Matrix
- Three Horizons of Growth
- Blue Ocean Strategy

**Organizational:**
- McKinsey 7S Framework
- Organizational Design Principles
- Change Management Models

**Analysis:**
- SWOT Analysis
- PESTLE Analysis
- MECE Principle
- Issue Trees

### Usage Examples

#### 1. Strategic Consultation

```typescript
const result = await warRoom.executeTask('Alice', 'consult', {
  query: `We're a Series A fintech startup with $10M ARR.
          Competition is intensifying. Should we focus on:
          1. Product differentiation
          2. Geographic expansion
          3. Market segment deepening`,
  useHistory: true
}, context);

console.log(result.data.response);
```

**Alice will provide:**
- Framework-based analysis (e.g., Ansoff Matrix)
- Evaluation of each option
- Recommended path with rationale
- Key metrics to track
- Implementation considerations

#### 2. M&A Decision

```typescript
const decision = await warRoom.executeTask('Alice', 'make_decision', {
  question: 'Should we acquire Company X for $50M?',
  decisionType: 'acquisition',
  options: [
    'Acquire at $50M',
    'Negotiate down to $40M',
    'Pass and build capability internally',
    'Strategic partnership instead'
  ],
  criteria: [
    'Strategic fit',
    'Financial ROI',
    'Integration risk',
    'Market impact',
    'Talent acquisition'
  ]
}, context);
```

**Alice will provide:**
- Evaluation matrix
- Synergy analysis
- Financial modeling requirements (triggers Dorothy)
- Risk assessment (triggers Elsa)
- Implementation roadmap

#### 3. Market Entry Analysis

```typescript
const analysis = await warRoom.executeTask('Alice', 'analyze_strategy', {
  topic: 'Enter Japanese Market',
  analysisType: 'market_entry',
  includeData: true
}, context);
```

**Alice will apply:**
- Market attractiveness analysis
- Competitive landscape review
- Entry mode evaluation (partnership, acquisition, greenfield)
- Regulatory considerations (triggers Anna)
- Go-to-market strategy

#### 4. Set Annual OKRs

```typescript
const okr = await warRoom.executeTask('Alice', 'set_goals', {
  objective: 'Become market leader in enterprise segment',
  timeframe: '1 year',
  currentState: '15% enterprise market share',
  desiredState: '40% enterprise market share'
}, context);
```

**Alice will define:**
- Clear, inspiring objective
- 3-5 measurable key results
- Initiatives to drive each KR
- Success metrics
- Dependencies and risks

### Communication Style

Alice communicates like a senior McKinsey partner:

**Structure:**
- Leads with the answer (Pyramid Principle)
- MECE organization
- Executive summaries
- Clear recommendations

**Analysis:**
- Hypothesis-driven
- Data-grounded
- Framework-based
- Quantified when possible

**Tone:**
- Professional but approachable
- Confident yet intellectually honest
- Action-oriented
- Strategic focus

### Example Conversation Flow

```
User: "We're burning cash. What should we do?"

Alice: "Let me structure this problem...

SITUATION ASSESSMENT
You're facing a classic growth vs. profitability trade-off.
Let me analyze three strategic options:

OPTION ANALYSIS
1. Path to Profitability
   - Pros: Reduces risk, extends runway
   - Cons: May slow growth, lose market position
   - Timeline: 6-9 months

2. Raise Capital
   - Pros: Fuel growth, competitive positioning
   - Cons: Dilution, investor expectations
   - Timeline: 3-6 months

3. Hybrid Approach
   - Pros: Balances growth and efficiency
   - Cons: Requires precise execution
   - Timeline: 3-12 months

RECOMMENDATION
I recommend the Hybrid Approach because...
[detailed rationale]

KEY METRICS TO TRACK
- Burn multiple: <1.5x
- CAC payback: <12 months
- Net revenue retention: >110%

IMMEDIATE ACTIONS
1. [Specific action]
2. [Specific action]
3. [Specific action]

What aspect would you like to explore deeper?"
```

### Integration with Other Agents

Alice orchestrates the team:

**Dorothy (Finance):**
- Requests financial models for decisions
- Validates financial assumptions
- Analyzes unit economics

**Belle (Market):**
- Requests competitive intelligence
- Market sizing and trends
- Customer insights

**Elsa (Risk):**
- Risk assessment for decisions
- Compliance checks
- Guardrail validation

**Anna (Compliance):**
- Regulatory considerations
- Certification requirements
- Legal implications

**Wendy (Meetings):**
- Meeting insights inform decisions
- Action items tracked
- Stakeholder alignment

**Amy (Tracker):**
- Historical context
- Decision tracking
- Progress monitoring

### Advanced Features

#### Conversation Memory

Alice maintains context across interactions:

```typescript
// First question
await warRoom.executeTask('Alice', 'consult', {
  query: 'What are our strategic priorities?',
  useHistory: true
});

// Follow-up (Alice remembers the context)
await warRoom.executeTask('Alice', 'consult', {
  query: 'How should we prioritize them?',
  useHistory: true
});

// Reset if needed
const alice = await warRoom.getAgent('Alice');
alice.resetConversation();
```

#### Temperature Control

Different tasks use different temperature settings:
- Decision-making: 0.6 (more focused)
- Goal setting: 0.7 (balanced)
- Consultation: 0.7 (balanced)

#### Confidence Extraction

Alice's responses include confidence levels:
```
"With 85% confidence, I recommend..."
→ Extracted as confidenceScore: 0.85
```

### Best Practices

1. **Provide Context**
   - Include current state, goals, constraints
   - Share relevant metrics
   - Mention stakeholder concerns

2. **Use Structured Tasks for Major Decisions**
   - `make_decision` for important choices
   - `analyze_strategy` for deep analysis
   - `consult` for exploratory discussion

3. **Leverage Conversation History**
   - Build on previous discussions
   - Refine recommendations iteratively
   - Reset when changing topics

4. **Review Other Agents' Data**
   - Ensure Dorothy has financial models
   - Check Belle for market research
   - Verify Elsa's risk assessments

5. **Document Decisions**
   - All decisions saved to database
   - Amy tracks implementation
   - Full audit trail maintained

### Limitations

- **Data Dependency:** Quality of advice depends on data quality
- **No Real-time Market Data:** Relies on data from Belle
- **LLM-based:** Subject to GLM-4 capabilities and limitations
- **No Execution:** Provides recommendations, doesn't execute
- **Requires API Key:** GLM_API_KEY must be configured

### Configuration

Required environment variables:
```bash
GLM_API_KEY=your_key_here
GLM_API_BASE_URL=https://open.bigmodel.cn/api/paas/v4
```

Optional tuning:
- Adjust temperature in code for different thinking styles
- Modify prompts in `src/prompts/alice.ts`
- Customize frameworks in system prompt

### Troubleshooting

**Alice not responding:**
- Check GLM_API_KEY is set
- Verify API endpoint is accessible
- Check error logs

**Generic responses:**
- Provide more context in query
- Include relevant data
- Use structured tasks instead of consult

**Inconsistent quality:**
- Review system prompt
- Adjust temperature
- Provide better data context

### Future Enhancements

Planned improvements:
- Multi-model support (GPT-4, Claude)
- Streaming responses
- Document analysis (PDFs, reports)
- Custom framework injection
- Sector-specific expertise modes
- Interactive scenario modeling
