/**
 * Example: Using Dorothy for SEC Filing Analysis
 *
 * Dorothy ONLY uses official SEC filing data.
 * If data is not in SEC filings, she explicitly says so.
 */

import { WarRoom } from '../src/index.js';
import { AgentContext } from '../src/types/agent.js';

async function main() {
  console.log('💰 Dorothy SEC Filing Analysis Demo\n');
  console.log('='.repeat(60));

  const warRoom = new WarRoom();
  await warRoom.initialize();

  const context: AgentContext = {
    projectId: 1
  };

  // Example 1: Download SEC Filings
  console.log('\n' + '='.repeat(60));
  console.log('Step 1: Download SEC Filings');
  console.log('='.repeat(60) + '\n');

  const download = await warRoom.executeTask(
    'Dorothy',
    'fetch_sec_data',
    {
      ticker: 'AAPL',  // Apple Inc.
      filingType: '10-K',  // Annual report
      limit: 2  // Download last 2 annual reports
    },
    context
  );

  if (download.success) {
    console.log(`Company: ${download.data.company.name}`);
    console.log(`CIK: ${download.data.company.cik}`);
    console.log(`Filings Downloaded: ${download.data.filingsDownloaded}`);
    console.log(`Total Filings: ${download.data.filingsTotal}`);
    console.log('\nFilings:');
    download.data.filings.forEach((f: any) => {
      console.log(`  - ${f.filingType} filed ${f.filingDate} (${f.status})`);
    });
  }

  // Example 2: Answer Financial Question
  console.log('\n' + '='.repeat(60));
  console.log('Step 2: Ask Financial Question');
  console.log('='.repeat(60) + '\n');

  const question = await warRoom.executeTask(
    'Dorothy',
    'answer_question',
    {
      ticker: 'AAPL',
      question: 'What was the total revenue for the most recent fiscal year? How does it compare to the previous year?'
    },
    context
  );

  if (question.success) {
    console.log(`Question: ${question.data.question}\n`);
    console.log('Dorothy\'s Answer:');
    console.log(question.data.answer);
    console.log('\nSources Used:');
    question.data.sourcesUsed.forEach((s: any) => {
      console.log(`  - ${s.type} filed ${s.date} (${s.accessionNumber})`);
    });
  }

  // Example 3: Calculate Financial Ratios
  console.log('\n' + '='.repeat(60));
  console.log('Step 3: Calculate Financial Ratios');
  console.log('='.repeat(60) + '\n');

  const ratios = await warRoom.executeTask(
    'Dorothy',
    'calculate_ratios',
    {
      ticker: 'AAPL',
      ratioTypes: ['profitability', 'liquidity', 'leverage'],
      filingType: '10-K'
    },
    context
  );

  if (ratios.success) {
    console.log(`Company: ${ratios.data.company}`);
    console.log(`Filing: ${ratios.data.filing.type} (${ratios.data.filing.date})\n`);
    console.log('Financial Ratios:');
    console.log(ratios.data.ratios);
  }

  // Example 4: Compare Periods
  console.log('\n' + '='.repeat(60));
  console.log('Step 4: Compare Fiscal Years');
  console.log('='.repeat(60) + '\n');

  const comparison = await warRoom.executeTask(
    'Dorothy',
    'compare_periods',
    {
      ticker: 'AAPL',
      periods: 2,
      filingType: '10-K'
    },
    context
  );

  if (comparison.success) {
    console.log(`Company: ${comparison.data.company}\n`);
    console.log('Periods Compared:');
    comparison.data.periodsCompared.forEach((p: any, i: number) => {
      console.log(`  ${i + 1}. ${p.type} filed ${p.filingDate} (Report: ${p.reportDate})`);
    });
    console.log('\nComparative Analysis:');
    console.log(comparison.data.comparison);
  }

  // Example 5: Extract Specific Data Points
  console.log('\n' + '='.repeat(60));
  console.log('Step 5: Extract Specific Financial Data');
  console.log('='.repeat(60) + '\n');

  const extraction = await warRoom.executeTask(
    'Dorothy',
    'extract_financials',
    {
      ticker: 'AAPL',
      dataPoints: [
        'Total Revenue',
        'Net Income',
        'Total Assets',
        'Total Cash and Cash Equivalents',
        'Total Debt',
        'Research and Development Expenses'
      ],
      filingType: '10-K'
    },
    context
  );

  if (extraction.success) {
    console.log(`Company: ${extraction.data.company}`);
    console.log(`Filing: ${extraction.data.filing.type} (${extraction.data.filing.date})\n`);
    console.log('Extracted Data:');
    console.log(extraction.data.extraction);
  }

  // Example 6: Financial Health Assessment
  console.log('\n' + '='.repeat(60));
  console.log('Step 6: Overall Financial Health Assessment');
  console.log('='.repeat(60) + '\n');

  const health = await warRoom.executeTask(
    'Dorothy',
    'assess_health',
    {
      ticker: 'AAPL'
    },
    context
  );

  if (health.success) {
    console.log(`Company: ${health.data.company}\n`);
    console.log('Filings Analyzed:');
    health.data.filings.forEach((f: any) => {
      console.log(`  - ${f.type} filed ${f.date}`);
    });
    console.log('\nFinancial Health Assessment:');
    console.log(health.data.assessment);
  }

  // Example 7: Detailed Filing Analysis
  console.log('\n' + '='.repeat(60));
  console.log('Step 7: Deep Dive into Specific Filing');
  console.log('='.repeat(60) + '\n');

  const analysis = await warRoom.executeTask(
    'Dorothy',
    'analyze_filing',
    {
      ticker: 'AAPL',
      filingType: '10-K',
      question: 'What are the key risk factors disclosed in this filing? Summarize the top 5 material risks.'
    },
    context
  );

  if (analysis.success) {
    console.log(`Company: ${analysis.data.company}`);
    console.log(`Filing: ${analysis.data.filing.type} (${analysis.data.filing.date})`);
    console.log(`Source: ${analysis.data.source}\n`);
    console.log('Analysis:');
    console.log(analysis.data.analysis);
  }

  // Example 8: Data Not Available Scenario
  console.log('\n' + '='.repeat(60));
  console.log('Step 8: Asking for Unavailable Data');
  console.log('='.repeat(60) + '\n');

  const unavailable = await warRoom.executeTask(
    'Dorothy',
    'answer_question',
    {
      ticker: 'AAPL',
      question: 'What is the exact salary of the head of the iPhone division?'
    },
    context
  );

  if (unavailable.success) {
    console.log(`Question: ${unavailable.data.question}\n`);
    console.log('Dorothy\'s Response:');
    console.log(unavailable.data.answer);
    console.log('\nNote: Dorothy will explicitly state when data is not available in SEC filings.');
  }

  await warRoom.shutdown();

  console.log('\n' + '='.repeat(60));
  console.log('Demo Complete!');
  console.log('='.repeat(60));
  console.log('\nKey Takeaways:');
  console.log('1. Dorothy ONLY uses SEC filing data');
  console.log('2. All answers are sourced from official filings');
  console.log('3. When data is not available, Dorothy explicitly says so');
  console.log('4. Every answer includes source citation');
  console.log('5. No assumptions or estimates without SEC data');
}

main().catch(console.error);
