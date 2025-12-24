/**
 * Example: Using Alice for McKinsey-level Strategic Consulting
 *
 * This example demonstrates how to interact with Alice,
 * the WAR-ROOM's senior strategic consultant.
 */

import { WarRoom } from '../src/index.js';
import { AgentContext } from '../src/types/agent.js';

async function main() {
  console.log('🎯 Alice Strategic Consulting Demo\n');
  console.log('=' .repeat(60));

  const warRoom = new WarRoom();
  await warRoom.initialize();

  const context: AgentContext = {
    projectId: 1
  };

  console.log('\n' + '='.repeat(60));
  console.log('Example 1: Free-form Strategic Consultation');
  console.log('='.repeat(60) + '\n');

  const consultation1 = await warRoom.executeTask(
    'Alice',
    'consult',
    {
      query: `I'm the CEO of a B2B SaaS company. We currently have $5M ARR growing at 100% YoY,
              but we're burning $2M/year. We have 18 months of runway.

              Should we:
              1. Raise Series A now to fuel growth
              2. Focus on profitability first, then raise
              3. Try to reach profitability and bootstrap

              What's your recommendation?`,
      useHistory: true
    },
    context
  );

  console.log('Alice\'s Response:');
  console.log(consultation1.data.response);

  // Follow-up question
  console.log('\n' + '-'.repeat(60));
  console.log('Follow-up Question:');
  console.log('-'.repeat(60) + '\n');

  const consultation2 = await warRoom.executeTask(
    'Alice',
    'consult',
    {
      query: 'What specific metrics should I track to make this decision?',
      useHistory: true // Uses conversation history
    },
    context
  );

  console.log('Alice\'s Response:');
  console.log(consultation2.data.response);

  console.log('\n' + '='.repeat(60));
  console.log('Example 2: Structured Decision-Making');
  console.log('='.repeat(60) + '\n');

  const decision = await warRoom.executeTask(
    'Alice',
    'make_decision',
    {
      question: 'Should we acquire competitor X for $10M?',
      decisionType: 'acquisition',
      options: [
        'Acquire for $10M in cash',
        'Acquire for $8M cash + $2M earnout',
        'Pass on acquisition and invest in organic growth',
        'Explore strategic partnership instead'
      ],
      criteria: [
        'Strategic fit and synergies',
        'Financial impact and ROI',
        'Integration complexity',
        'Market positioning',
        'Risk factors'
      ],
      includeRiskAssessment: true
    },
    context
  );

  console.log('Decision Analysis:');
  console.log(decision.data.recommendation);
  console.log(`\nConfidence Score: ${(decision.data.confidenceScore * 100).toFixed(0)}%`);

  console.log('\n' + '='.repeat(60));
  console.log('Example 3: Strategic Analysis with Frameworks');
  console.log('='.repeat(60) + '\n');

  const analysis = await warRoom.executeTask(
    'Alice',
    'analyze_strategy',
    {
      topic: 'International Expansion to European Market',
      analysisType: 'market_entry',
      includeData: true
    },
    context
  );

  console.log('Strategic Analysis:');
  console.log(analysis.data.analysis);

  console.log('\n' + '='.repeat(60));
  console.log('Example 4: Setting Strategic Goals (OKRs)');
  console.log('='.repeat(60) + '\n');

  const goals = await warRoom.executeTask(
    'Alice',
    'set_goals',
    {
      objective: 'Achieve Product-Market Fit in Enterprise Segment',
      timeframe: '6 months',
      currentState: 'Primarily serving SMB customers, 5% enterprise customers',
      desiredState: 'Enterprise customers represent 40% of ARR with strong retention'
    },
    context
  );

  console.log('OKR Framework:');
  console.log(goals.data.okrFramework);

  console.log('\n' + '='.repeat(60));
  console.log('Example 5: Comprehensive Situation Assessment');
  console.log('='.repeat(60) + '\n');

  const assessment = await warRoom.executeTask(
    'Alice',
    'assess_situation',
    {},
    context
  );

  console.log('Strategic Assessment:');
  console.log(assessment.data.strategicAnalysis);
  console.log('\nRaw Data:');
  console.log(JSON.stringify(assessment.data.rawData, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('Conversation State');
  console.log('='.repeat(60) + '\n');

  const alice = await warRoom.getAgent('Alice');
  if (alice) {
    const state = (alice as any).getConversationState();
    console.log(`Total messages in conversation: ${state.messageCount}`);
  }

  await warRoom.shutdown();
}

// Run the example
main().catch(console.error);
