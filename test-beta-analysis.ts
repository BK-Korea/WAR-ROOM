/**
 * Beta Technologies 재무 분석 테스트
 *
 * Dorothy: 2024년 재무 주요사항 분석
 * Alice: Dorothy의 분석을 바탕으로 전략적 제안
 */

import { WarRoom } from './src/index.js';
import { AgentContext } from './src/types/agent.js';

// Beta Technologies 2024 재무 데이터 (샘플)
const BETA_TECHNOLOGIES_2024_FILING = `
BETA TECHNOLOGIES, INC.
FORM 10-K (Annual Report)
For the fiscal year ended December 31, 2024

═══════════════════════════════════════════════════════════════════

COMPANY OVERVIEW

Beta Technologies is a leading electric vertical takeoff and landing (eVTOL)
aircraft manufacturer based in Burlington, Vermont. The Company develops the
ALIA aircraft for both cargo and passenger applications.

═══════════════════════════════════════════════════════════════════

CONSOLIDATED STATEMENTS OF OPERATIONS
(In thousands, except per share data)

                                    FY 2024         FY 2023      Change      %
────────────────────────────────────────────────────────────────────────────
REVENUES
Product sales                       $18,500         $12,200      $6,300    51.6%
Service revenue                      $4,200          $2,800      $1,400    50.0%
Government contracts                $32,100         $28,500      $3,600    12.6%
────────────────────────────────────────────────────────────────────────────
Total revenues                      $54,800         $43,500     $11,300    26.0%
────────────────────────────────────────────────────────────────────────────

OPERATING EXPENSES
Research and development           $142,300        $135,800      $6,500     4.8%
Selling, general & admin             $38,200         $35,600      $2,600     7.3%
────────────────────────────────────────────────────────────────────────────
Total operating expenses           $180,500        $171,400      $9,100     5.3%
────────────────────────────────────────────────────────────────────────────

Loss from operations              ($125,700)      ($127,900)      $2,200    -1.7%
────────────────────────────────────────────────────────────────────────────
Interest income                       $3,400          $2,100      $1,300    61.9%
Other income (expense), net             $800            $500        $300    60.0%
────────────────────────────────────────────────────────────────────────────
Net loss                          ($121,500)      ($125,300)      $3,800    -3.0%
════════════════════════════════════════════════════════════════════════════

CONSOLIDATED BALANCE SHEETS
As of December 31, 2024 and 2023
(In thousands)

ASSETS                              FY 2024         FY 2023      Change
────────────────────────────────────────────────────────────────────────────
Cash and cash equivalents          $285,400        $198,600     $86,800
Short-term investments               $52,000         $35,000     $17,000
Accounts receivable                  $12,300          $8,500      $3,800
Inventory                            $28,600         $18,200     $10,400
Prepaid expenses                      $6,200          $4,800      $1,400
────────────────────────────────────────────────────────────────────────────
Total current assets               $384,500        $265,100    $119,400
────────────────────────────────────────────────────────────────────────────

Property, plant & equipment (net)  $145,200        $112,800     $32,400
Intangible assets                    $18,500         $15,200      $3,300
Other long-term assets                $9,800          $7,400      $2,400
────────────────────────────────────────────────────────────────────────────
Total assets                       $558,000        $400,500    $157,500
════════════════════════════════════════════════════════════════════════════

LIABILITIES & EQUITY

Current liabilities                 $42,300         $35,800      $6,500
Long-term debt                       $15,000         $10,000      $5,000
Other long-term liabilities           $8,200          $6,500      $1,700
────────────────────────────────────────────────────────────────────────────
Total liabilities                   $65,500         $52,300     $13,200
────────────────────────────────────────────────────────────────────────────

Stockholders' equity               $492,500        $348,200    $144,300
────────────────────────────────────────────────────────────────────────────
Total liabilities & equity         $558,000        $400,500    $157,500
════════════════════════════════════════════════════════════════════════════

CONSOLIDATED STATEMENTS OF CASH FLOWS
For the years ended December 31, 2024 and 2023
(In thousands)

                                    FY 2024         FY 2023
────────────────────────────────────────────────────────────────────────────
OPERATING ACTIVITIES
Net loss                          ($121,500)      ($125,300)
Adjustments:
  Depreciation & amortization        $18,400         $14,200
  Stock-based compensation           $12,800          $9,600
  Changes in working capital        ($8,200)        ($6,100)
────────────────────────────────────────────────────────────────────────────
Net cash used in operating         ($98,500)      ($107,600)
────────────────────────────────────────────────────────────────────────────

INVESTING ACTIVITIES
Capital expenditures               ($62,800)        ($48,500)
Purchase of investments            ($17,000)        ($15,000)
────────────────────────────────────────────────────────────────────────────
Net cash used in investing         ($79,800)        ($63,500)
────────────────────────────────────────────────────────────────────────────

FINANCING ACTIVITIES
Proceeds from equity offerings     $265,000        $180,000
Proceeds from debt                    $5,000         $10,000
────────────────────────────────────────────────────────────────────────────
Net cash from financing            $270,000        $190,000
────────────────────────────────────────────────────────────────────────────

Net change in cash                  $91,700         $18,900
Cash at beginning of year          $198,600        $179,700
────────────────────────────────────────────────────────────────────────────
Cash at end of year                $290,300        $198,600
════════════════════════════════════════════════════════════════════════════

MANAGEMENT'S DISCUSSION AND ANALYSIS (MD&A)

REVENUE ANALYSIS (Page 28)

FY 2024 revenues increased 26.0% to $54.8 million from $43.5 million in FY 2023.

Key drivers:

1. Government Contracts ($32.1M, up 12.6% YoY)
   - U.S. Air Force AFWERX contract: $18.5M (Page 29, Line 12)
   - U.S. Army cargo delivery pilot: $8.2M (Page 29, Line 18)
   - NASA Advanced Air Mobility research: $5.4M (Page 29, Line 24)
   - Milestone: First successful cargo delivery demonstration in Q3 2024

2. Product Sales ($18.5M, up 51.6% YoY)
   - Pre-delivery payments from launch customers: $12.8M (Page 30, Table 1)
   - Component sales to partners: $5.7M (Page 30, Table 1)
   - Strong demand driven by FAA certification progress

3. Service Revenue ($4.2M, up 50.0% YoY)
   - Maintenance and training services: $2.8M (Page 30, Line 8)
   - Engineering consulting: $1.4M (Page 30, Line 12)

OPERATING EXPENSES ANALYSIS (Page 32)

R&D Expenses: $142.3M (FY 2024)

Breakdown by category (Page 33, Table 2):

Priority 1: FAA Certification Activities ($58.2M, 40.9% of R&D)
- Type certification testing and documentation
- Increased focus on final certification push
- Expected certification: H2 2025

Priority 2: ALIA Aircraft Development ($42.5M, 29.9% of R&D)
- Prototype manufacturing and refinement
- 6 flight-test aircraft currently operational
- 1,000+ test flights completed in 2024

Priority 3: Production System Development ($24.8M, 17.4% of R&D)
- Manufacturing facility expansion in Vermont
- Automated assembly line development
- Target: 30 aircraft/year capacity by 2026

Priority 4: Engineering Personnel ($16.8M, 11.8% of R&D)
- 180 engineers (up from 155 in 2023)
- Key hires in systems integration and certification

SG&A Expenses: $38.2M (FY 2024, up 7.3% YoY)

Controlled growth despite scaling operations:
- Sales and marketing: $14.2M (Page 34, Line 6)
- General and administrative: $18.5M (Page 34, Line 10)
- Facilities and infrastructure: $5.5M (Page 34, Line 14)

LIQUIDITY AND CAPITAL RESOURCES (Page 38)

Cash Position:
- Cash and equivalents: $285.4M (Page 38, Line 4)
- Short-term investments: $52.0M (Page 38, Line 8)
- Total liquidity: $337.4M (Page 38, Line 12)

Strong liquidity supported by:
- $265M equity raise in Q2 2024 led by Fidelity and Amazon Climate Pledge Fund
- Current burn rate: ~$8-9M per month
- Estimated runway: 36+ months to certification and initial production

Strategic Partnerships (Page 42):

1. UPS - 150 aircraft conditional order (announced 2021)
2. United Therapeutics - Medical delivery partnership
3. Air New Zealand - 23 aircraft order (announced 2024)
4. U.S. Air Force - Agility Prime program participant

Certification Timeline (Page 45):

- Type Certification application submitted: Q4 2023
- Expected FAA Type Certificate: H2 2025
- Production Certificate expected: 2026
- First customer deliveries: Late 2025 / Early 2026

Risk Factors (Page 52):

1. Certification delays - dependent on FAA processes
2. Technology risks - unproven technology at scale
3. Competition - multiple eVTOL companies pursuing certification
4. Manufacturing scale-up - first-of-its-kind production challenges

Key Performance Indicators (Page 58):

- Flight test hours: 850 hours in 2024 (up from 520 in 2023)
- Customer deposits: $48.2M (representing ~350 aircraft)
- Government contract backlog: $67.5M
- Employee count: 485 (up from 380 in 2023)

════════════════════════════════════════════════════════════════════════════
END OF FILING
════════════════════════════════════════════════════════════════════════════
`;

async function main() {
  console.log('🧪 Beta Technologies 재무 및 전략 분석');
  console.log('='.repeat(70));
  console.log('Dorothy → Alice 협업 테스트\n');

  const warRoom = new WarRoom();
  await warRoom.initialize();

  const context: AgentContext = {
    projectId: 1
  };

  // Step 1: Dorothy가 재무 분석
  console.log('📊 Step 1: Dorothy의 재무 분석\n');
  console.log('='.repeat(70));

  const dorothyAnalysis = await warRoom.executeTask(
    'Dorothy',
    'analyze_text',
    {
      company: 'Beta Technologies, Inc.',
      filingType: '10-K',
      filingDate: '2024-12-31',
      text: BETA_TECHNOLOGIES_2024_FILING,
      question: `Beta Technologies의 2024년 재무 주요사항을 분석해주세요:

1. 매출 성장 분석 (전년 대비)
2. 주요 매출원 (정부 계약, 제품 판매, 서비스)
3. R&D 지출 현황과 우선순위
4. 현금 포지션과 자금 조달 현황
5. FAA 인증 진행 상황
6. 전체 재무 건전성 평가

**모든 숫자는 출처(문서, 페이지)를 명시하세요.**`
    },
    context
  );

  if (!dorothyAnalysis.success) {
    console.error('❌ Dorothy 분석 실패:', dorothyAnalysis.error);
    await warRoom.shutdown();
    process.exit(1);
  }

  console.log('✅ Dorothy의 재무 분석 완료\n');
  console.log(dorothyAnalysis.data.analysis);
  console.log('\n' + '='.repeat(70));

  // Step 2: Alice가 전략 분석
  console.log('\n🎯 Step 2: Alice의 전략 분석\n');
  console.log('='.repeat(70));

  const aliceAnalysis = await warRoom.executeTask(
    'Alice',
    'strategic_analysis',
    {
      context: `Beta Technologies (eVTOL 항공기 제조사)의 재무 분석 결과:

${dorothyAnalysis.data.analysis}`,
      question: `Dorothy의 재무 분석을 바탕으로 Beta Technologies의 전략적 상황을 평가하고 제안해주세요:

1. 현재 전략적 포지션 평가 (강점/약점)
2. 주요 전략적 리스크와 기회
3. 경쟁 우위 요소 분석
4. FAA 인증까지의 전략적 우선순위
5. 자금 조달 전략 평가
6. 향후 12-24개월 전략 로드맵 제안

McKinsey 스타일의 구조화된 분석으로 답변해주세요.`
    },
    context
  );

  if (!aliceAnalysis.success) {
    console.error('❌ Alice 분석 실패:', aliceAnalysis.error);
    await warRoom.shutdown();
    process.exit(1);
  }

  console.log('✅ Alice의 전략 분석 완료\n');
  console.log(aliceAnalysis.data.analysis);

  await warRoom.shutdown();

  console.log('\n');
  console.log('='.repeat(70));
  console.log('✅ 분석 완료!');
  console.log('='.repeat(70));
  console.log('\n협업 흐름:');
  console.log('1. Dorothy: SEC filing 데이터 기반 재무 분석 (출처 명시)');
  console.log('2. Alice: Dorothy의 분석을 받아 전략적 제안 수행');
  console.log('3. 결과: 재무 + 전략 통합 인사이트');
}

main().catch((error) => {
  console.error('\n💥 Error:', error);
  process.exit(1);
});
