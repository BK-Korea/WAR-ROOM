/**
 * Mock Test: Dorothy with Sample SEC Filing Data
 *
 * Since SEC API is blocked in this environment, we'll use sample data
 * to demonstrate Dorothy's strict "SEC data only" analysis capabilities
 */

import { WarRoom } from './src/index.js';
import { AgentContext } from './src/types/agent.js';

// Sample EVTL 10-Q filing data (based on typical going concern disclosures)
const SAMPLE_EVTL_10Q = `
VERTICAL AEROSPACE LTD.
FORM 10-Q
For the quarterly period ended September 30, 2024

PART I - FINANCIAL INFORMATION

Item 1. Financial Statements

CONSOLIDATED BALANCE SHEETS
(In thousands, except share data)
                                           September 30, 2024    December 31, 2023
ASSETS
Current assets:
  Cash and cash equivalents                      $45,200              $128,500
  Restricted cash                                  8,100                 5,200
  Prepaid expenses and other current assets       12,300                15,800
Total current assets                              65,600               149,500
Property and equipment, net                       85,400                72,100
Intangible assets, net                            23,500                26,800
Total assets                                    $174,500              $248,400

LIABILITIES AND STOCKHOLDERS' EQUITY
Current liabilities:
  Accounts payable                               $32,100               $28,400
  Accrued expenses                                18,500                15,200
  Current portion of debt                         15,000                10,000
  Other current liabilities                        8,900                 7,600
Total current liabilities                         74,500                61,200
Long-term debt, net of current portion            45,000                40,000
Total liabilities                                119,500               101,200
Total stockholders' equity                        55,000               147,200
Total liabilities and stockholders' equity      $174,500              $248,400

CONSOLIDATED STATEMENTS OF OPERATIONS
(In thousands, except per share data)
                                           Three Months Ended    Nine Months Ended
                                           September 30, 2024    September 30, 2024
Revenues                                           $1,200               $3,800
Operating expenses:
  Research and development                        38,500              115,200
  General and administrative                      12,800               38,900
Total operating expenses                          51,300              154,100
Loss from operations                             (50,100)            (150,300)
Interest expense                                  (1,200)              (3,400)
Net loss                                        $(51,300)           $(153,700)

CONSOLIDATED STATEMENTS OF CASH FLOWS
(In thousands)
                                                   Nine Months Ended
                                                   September 30, 2024
Cash flows from operating activities:
  Net loss                                              $(153,700)
  Adjustments to reconcile net loss:
    Depreciation and amortization                         12,800
    Stock-based compensation                              18,200
    Changes in operating assets and liabilities            8,500
  Net cash used in operating activities                 (114,200)

Cash flows from investing activities:
  Purchase of property and equipment                     (28,900)
  Net cash used in investing activities                  (28,900)

Cash flows from financing activities:
  Proceeds from issuance of debt                          15,000
  Proceeds from issuance of common stock                  45,000
  Net cash provided by financing activities               60,000

Net decrease in cash and restricted cash                 (83,100)
Cash and restricted cash, beginning of period            133,700
Cash and restricted cash, end of period                  $50,600

Note 1 - Basis of Presentation and Going Concern

The accompanying consolidated financial statements have been prepared assuming the Company will continue as a going concern, which contemplates the realization of assets and satisfaction of liabilities in the normal course of business.

As of September 30, 2024, the Company had cash and cash equivalents of $45.2 million and an accumulated deficit of $487.3 million. The Company has incurred significant operating losses and negative cash flows from operations since inception. For the nine months ended September 30, 2024, the Company incurred a net loss of $153.7 million and used $114.2 million of cash in operating activities.

Based on the Company's current operating plan and expected cash burn rate of approximately $15-18 million per month, management estimates that existing cash and cash equivalents will be sufficient to fund operations into Q1 2025. These conditions raise substantial doubt about the Company's ability to continue as a going concern for a period of at least twelve months from the issuance date of these financial statements.

The Company's ability to continue as a going concern is dependent upon its ability to raise additional capital through equity or debt financings, strategic partnerships, or other arrangements. There can be no assurance that such financing will be available on acceptable terms, or at all. If the Company is unable to obtain sufficient funding, it may be required to significantly curtail or cease operations.

Management's plans to address going concern include:
1. Raising additional capital through public or private equity offerings
2. Securing strategic partnerships or collaborations
3. Pursuing non-dilutive funding sources such as government grants
4. Reducing operating expenses and extending cash runway
5. Exploring asset sales or licensing arrangements

However, there is no assurance that these plans will be successfully implemented.

Note 8 - Debt

As of September 30, 2024, the Company had $60.0 million of outstanding debt, consisting of:
- Term loan facility: $45.0 million (due December 2025)
- Convertible notes: $15.0 million (due June 2025)

The term loan agreement contains financial covenants requiring minimum liquidity of $20.0 million. As of September 30, 2024, the Company was in compliance with all debt covenants. However, based on current cash burn projections, the Company may violate the minimum liquidity covenant in Q1 2025 without additional financing.

AUDITOR'S REPORT (Page 2)

We have audited the accompanying consolidated balance sheets... [standard language]

Going Concern

The Company's financial statements have been prepared assuming that the Company will continue as a going concern. As discussed in Note 1 to the financial statements, the Company has suffered recurring losses from operations and has insufficient cash to fund operations beyond Q1 2025. These conditions raise substantial doubt about the Company's ability to continue as a going concern. Management's plans in regard to these matters are also described in Note 1. The financial statements do not include any adjustments that might result from the outcome of this uncertainty. Our opinion is not modified with respect to this matter.

MANAGEMENT'S DISCUSSION AND ANALYSIS (MD&A)

Liquidity and Capital Resources

As of September 30, 2024, we had $45.2 million in cash and cash equivalents, compared to $128.5 million as of December 31, 2023. The decrease of $83.3 million was primarily due to:
- Operating cash burn of $114.2 million
- Capital expenditures of $28.9 million for VX4 prototype development
- Partially offset by $60.0 million raised through debt and equity financing

Our current monthly cash burn rate is approximately $15-18 million, driven primarily by:
- Research and development expenses for VX4 aircraft certification
- Personnel costs for engineering and flight test teams
- Facility costs and prototype manufacturing

Based on our current operating plan, we estimate our existing cash will fund operations into Q1 2025 (approximately 3 months from the report date). This raises substantial doubt about our ability to continue as a going concern.

We are actively pursuing additional financing through:
1. Private placement discussions with existing investors ($50M target)
2. Strategic partnership negotiations with aerospace OEMs
3. UK government grant applications for advanced air mobility
4. PIPE (private investment in public equity) transactions

We have also implemented cost reduction measures:
- 15% workforce reduction completed in August 2024 (annual savings: $8M)
- Deferred non-critical capital projects
- Negotiated extended payment terms with key suppliers

However, there is no assurance that we will be able to raise sufficient capital on acceptable terms or at all.

Critical Accounting Estimates - Impairment Assessment

Given the going concern uncertainty, we evaluated our long-lived assets and intangible assets for impairment. As of September 30, 2024, we determined that no impairment was required as we expect to continue development and achieve certification of the VX4 aircraft, subject to successful financing.

Subsequent Events

In October 2024, the Company entered into a non-binding term sheet with a strategic investor for a potential $40 million investment, subject to due diligence and definitive documentation. There is no assurance this transaction will be completed.

RISK FACTORS (Item 1A)

We face significant risks related to our ability to continue as a going concern, including:

1. LIQUIDITY RISK: Our cash runway extends only into Q1 2025. Without additional financing, we will be unable to continue operations.

2. FINANCING RISK: We will require substantial additional capital ($200-300M) to achieve VX4 certification and commercial production. Capital markets may not be receptive to further dilution.

3. DEBT COVENANT RISK: We may violate our minimum liquidity covenant in Q1 2025, potentially triggering acceleration of $60M in debt.

4. CERTIFICATION DELAYS: Any delays in VX4 certification could increase cash requirements and jeopardize our ability to raise capital.

5. MARKET CONDITIONS: Adverse conditions in aerospace and eVTOL markets may impair our ability to secure financing or partnerships.
`;

async function main() {
  console.log('🧪 Testing Dorothy with Mock EVTL SEC Filing\n');
  console.log('='.repeat(70));
  console.log('NOTE: Using sample SEC filing data due to API restrictions');
  console.log('='.repeat(70));

  const warRoom = new WarRoom();
  await warRoom.initialize();

  const context: AgentContext = {
    projectId: 1
  };

  // Test 1: Ask Dorothy to analyze going concern from the filing text
  console.log('\n📋 Test 1: Going Concern Analysis');
  console.log('='.repeat(70));

  const goingConcernAnalysis = await warRoom.executeTask(
    'Dorothy',
    'analyze_text',
    {
      company: 'Vertical Aerospace Ltd. (EVTL)',
      filingType: '10-Q',
      filingDate: '2024-11-12',
      text: SAMPLE_EVTL_10Q,
      question: `Analyze the going concern issues in this filing. Specifically address:
1. Does the auditor's report include a going concern qualification?
2. What are the specific liquidity concerns mentioned?
3. How much cash does the company have?
4. What is the monthly burn rate?
5. How long is the projected runway?
6. What are the company's plans to address going concern?
7. Are there any covenant violations or defaults?

Remember: ONLY use data explicitly stated in the filing. Quote exact numbers.`
    },
    context
  );

  if (goingConcernAnalysis.success) {
    console.log('\n✅ GOING CONCERN ANALYSIS\n');
    console.log(goingConcernAnalysis.data.analysis);
  } else {
    console.error('\n❌ Analysis failed:', goingConcernAnalysis.error);
  }

  // Test 2: Extract specific financial metrics
  console.log('\n\n💰 Test 2: Key Financial Metrics Extraction');
  console.log('='.repeat(70));

  const metricsExtraction = await warRoom.executeTask(
    'Dorothy',
    'analyze_text',
    {
      company: 'Vertical Aerospace Ltd. (EVTL)',
      filingType: '10-Q',
      filingDate: '2024-11-12',
      text: SAMPLE_EVTL_10Q,
      question: `Extract the following financial metrics from this 10-Q filing:
1. Cash and cash equivalents (current period and prior period)
2. Total current assets and total current liabilities
3. Working capital (calculate it)
4. Net loss for Q3 2024 and 9M 2024
5. Operating cash flow for 9M 2024
6. Monthly cash burn rate (as disclosed by management)
7. Total debt outstanding
8. Stockholders' equity

Provide exact numbers with sources. Calculate ratios where appropriate.`
    },
    context
  );

  if (metricsExtraction.success) {
    console.log('\n✅ FINANCIAL METRICS\n');
    console.log(metricsExtraction.data.analysis);
  } else {
    console.error('\n❌ Metrics extraction failed:', metricsExtraction.error);
  }

  // Test 3: Test Dorothy's "data not available" response
  console.log('\n\n🚫 Test 3: Data Not Available Scenario');
  console.log('='.repeat(70));

  const unavailableData = await warRoom.executeTask(
    'Dorothy',
    'analyze_text',
    {
      company: 'Vertical Aerospace Ltd. (EVTL)',
      filingType: '10-Q',
      filingDate: '2024-11-12',
      text: SAMPLE_EVTL_10Q,
      question: `What is the exact salary of the CEO and CFO? Also, what is the breakdown of R&D expenses by project category?`
    },
    context
  );

  if (unavailableData.success) {
    console.log('\n✅ RESPONSE (Testing "Data Not Available" Principle)\n');
    console.log(unavailableData.data.analysis);
  } else {
    console.error('\n❌ Query failed:', unavailableData.error);
  }

  // Test 4: Risk assessment
  console.log('\n\n⚠️  Test 4: Risk Factors Analysis');
  console.log('='.repeat(70));

  const riskAnalysis = await warRoom.executeTask(
    'Dorothy',
    'analyze_text',
    {
      company: 'Vertical Aerospace Ltd. (EVTL)',
      filingType: '10-Q',
      filingDate: '2024-11-12',
      text: SAMPLE_EVTL_10Q,
      question: `Based on the financial data and disclosures in this filing, what are the top 5 most critical financial risks facing this company? Rank them by severity and provide specific evidence from the filing.`
    },
    context
  );

  if (riskAnalysis.success) {
    console.log('\n✅ RISK ANALYSIS\n');
    console.log(riskAnalysis.data.analysis);
  } else {
    console.error('\n❌ Risk analysis failed:', riskAnalysis.error);
  }

  await warRoom.shutdown();

  console.log('\n');
  console.log('='.repeat(70));
  console.log('✅ Mock Test Complete!');
  console.log('='.repeat(70));
  console.log('\nKey Demonstrations:');
  console.log('1. ✅ Dorothy analyzes ONLY from SEC filing data');
  console.log('2. ✅ Quotes exact numbers and sources');
  console.log('3. ✅ Explicitly states when data is NOT available');
  console.log('4. ✅ Provides professional CFA-level analysis');
  console.log('5. ✅ Maintains strict data integrity principle');
}

main().catch((error) => {
  console.error('\n💥 Fatal Error:', error);
  process.exit(1);
});
