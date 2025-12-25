/**
 * Test Dorothy: Vertical Aerospace Going Concern Analysis
 */

import { WarRoom } from './src/index.js';
import { AgentContext } from './src/types/agent.js';

async function main() {
  console.log('🧪 Testing Dorothy with Vertical Aerospace\n');
  console.log('='.repeat(70));

  const warRoom = new WarRoom();
  await warRoom.initialize();

  const context: AgentContext = {
    projectId: 1
  };

  // Step 1: Download SEC filings for Vertical Aerospace
  console.log('\n📥 Step 1: Downloading SEC Filings for Vertical Aerospace (EVTL)');
  console.log('='.repeat(70));

  const download = await warRoom.executeTask(
    'Dorothy',
    'fetch_sec_data',
    {
      ticker: 'EVTL',
      filingType: '10-K',  // Annual report
      limit: 2
    },
    context
  );

  if (!download.success) {
    console.error('❌ Failed to download filings:', download.error);

    // Try with 10-Q if 10-K not available
    console.log('\n📥 Trying 10-Q filings instead...');
    const downloadQ = await warRoom.executeTask(
      'Dorothy',
      'fetch_sec_data',
      {
        ticker: 'EVTL',
        filingType: '10-Q',
        limit: 3
      },
      context
    );

    if (!downloadQ.success) {
      console.error('❌ Failed to download 10-Q filings:', downloadQ.error);
      await warRoom.shutdown();
      return;
    }

    console.log('✅ Downloaded 10-Q filings:');
    console.log(`   Company: ${downloadQ.data.company.name}`);
    console.log(`   CIK: ${downloadQ.data.company.cik}`);
    console.log(`   Filings: ${downloadQ.data.filingsTotal}`);
    downloadQ.data.filings.forEach((f: any) => {
      console.log(`   - ${f.filingType} filed ${f.filingDate} (${f.status})`);
    });

  } else {
    console.log('✅ Downloaded filings:');
    console.log(`   Company: ${download.data.company.name}`);
    console.log(`   CIK: ${download.data.company.cik}`);
    console.log(`   Filings downloaded: ${download.data.filingsDownloaded}/${download.data.filingsTotal}`);
    download.data.filings.forEach((f: any) => {
      console.log(`   - ${f.filingType} filed ${f.filingDate} (${f.status})`);
    });
  }

  // Step 2: Analyze Going Concern Issues
  console.log('\n');
  console.log('='.repeat(70));
  console.log('🔍 Step 2: Analyzing Going Concern Issues');
  console.log('='.repeat(70));

  const goingConcern = await warRoom.executeTask(
    'Dorothy',
    'answer_question',
    {
      ticker: 'EVTL',
      question: `What are the going concern issues disclosed in the most recent filing?

      Please specifically identify:
      1. Does the auditor's report include a going concern qualification?
      2. What are the specific liquidity concerns mentioned?
      3. How much cash does the company have?
      4. What is the monthly burn rate?
      5. How long is the projected runway?
      6. What are the company's plans to address going concern?
      7. Are there any covenant violations or defaults?

      Provide exact quotes from the filing.`
    },
    context
  );

  if (goingConcern.success) {
    console.log('\n📊 GOING CONCERN ANALYSIS');
    console.log('─'.repeat(70));
    console.log(goingConcern.data.answer);
    console.log('\n');
    console.log('📚 Sources:');
    goingConcern.data.sourcesUsed.forEach((s: any) => {
      console.log(`   ✓ ${s.type} filed ${s.date}`);
      console.log(`     Accession: ${s.accessionNumber}`);
    });
  } else {
    console.error('\n❌ Going concern analysis failed:', goingConcern.error);
  }

  // Step 3: Extract Key Financial Metrics
  console.log('\n');
  console.log('='.repeat(70));
  console.log('💰 Step 3: Key Financial Metrics');
  console.log('='.repeat(70));

  const metrics = await warRoom.executeTask(
    'Dorothy',
    'extract_financials',
    {
      ticker: 'EVTL',
      dataPoints: [
        'Total Cash and Cash Equivalents',
        'Total Current Assets',
        'Total Current Liabilities',
        'Working Capital',
        'Total Debt',
        'Total Stockholders Equity',
        'Net Loss for the period',
        'Operating Cash Flow',
        'Monthly cash burn (if disclosed)'
      ],
      filingType: '10-Q'  // Use quarterly for most recent data
    },
    context
  );

  if (metrics.success) {
    console.log('\n📈 FINANCIAL METRICS');
    console.log('─'.repeat(70));
    console.log(metrics.data.extraction);
  } else {
    console.error('\n❌ Metrics extraction failed:', metrics.error);
  }

  // Step 4: Financial Health Assessment
  console.log('\n');
  console.log('='.repeat(70));
  console.log('🏥 Step 4: Overall Financial Health Assessment');
  console.log('='.repeat(70));

  const health = await warRoom.executeTask(
    'Dorothy',
    'assess_health',
    {
      ticker: 'EVTL'
    },
    context
  );

  if (health.success) {
    console.log('\n🎯 FINANCIAL HEALTH ASSESSMENT');
    console.log('─'.repeat(70));
    console.log(health.data.assessment);
    console.log('\n');
    console.log('📑 Filings Analyzed:');
    health.data.filings.forEach((f: any) => {
      console.log(`   ✓ ${f.type} filed ${f.date}`);
    });
  } else {
    console.error('\n❌ Health assessment failed:', health.error);
  }

  // Step 5: Risk Factors Analysis
  console.log('\n');
  console.log('='.repeat(70));
  console.log('⚠️  Step 5: Material Risk Factors');
  console.log('='.repeat(70));

  const risks = await warRoom.executeTask(
    'Dorothy',
    'analyze_filing',
    {
      ticker: 'EVTL',
      question: `Analyze the Risk Factors section. What are the top 5 most critical risks facing this company?
      Focus on risks related to:
      - Liquidity and going concern
      - Funding and capital requirements
      - Product development and certification
      - Market and competition
      - Regulatory and operational`
    },
    context
  );

  if (risks.success) {
    console.log('\n🚨 MATERIAL RISK FACTORS');
    console.log('─'.repeat(70));
    console.log(risks.data.analysis);
  } else {
    console.error('\n❌ Risk analysis failed:', risks.error);
  }

  await warRoom.shutdown();

  console.log('\n');
  console.log('='.repeat(70));
  console.log('✅ Analysis Complete!');
  console.log('='.repeat(70));
}

main().catch((error) => {
  console.error('\n💥 Fatal Error:', error);
  process.exit(1);
});
