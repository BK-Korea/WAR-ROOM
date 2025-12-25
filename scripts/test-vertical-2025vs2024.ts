/**
 * Vertical Aerospace 분석: 2025 vs 2024 운영 비용 비교
 * Dorothy: 세분화된 운영 비용 분석
 * Alice: 전략적 상태 진단
 */

import { WarRoom } from './src/index.js';
import { AgentContext } from './src/types/agent.js';

// 2025년 Q3 10-Q 데이터 (예상)
const EVTL_2025_Q3 = `
VERTICAL AEROSPACE LTD.
FORM 10-Q
For the quarterly period ended September 30, 2025

CONSOLIDATED STATEMENTS OF OPERATIONS
(In thousands)
                                           Three Months Ended    Nine Months Ended
                                           September 30, 2025    September 30, 2025
Revenues                                           $2,800               $8,500
Operating expenses:
  Research and development                        42,100              128,400
  General and administrative                      14,200               42,800
Total operating expenses                          56,300              171,200
Loss from operations                             (53,500)            (162,700)
Interest expense                                  (1,800)              (5,200)
Net loss                                        $(55,300)           $(167,900)

R&D 비용 세부 내역 (Nine Months 2025):
  Flight Testing & Certification                  $52,800 (41.1%)
  Prototype Manufacturing & Tooling               $28,600 (22.3%)
  Engineering Personnel                           $24,200 (18.8%)
  Regulatory & Compliance                         $12,400 (9.7%)
  Software & Simulation                            $6,800 (5.3%)
  Testing Equipment & Facilities                   $3,600 (2.8%)
  Total R&D                                      $128,400 (100%)

G&A 비용 세부 내역 (Nine Months 2025):
  Professional Fees (법률, 회계, 컨설팅)           $16,200 (37.9%)
  Administrative Personnel                         $12,800 (29.9%)
  Facilities & Rent                                 $7,200 (16.8%)
  IT & Software Subscriptions                       $3,600 (8.4%)
  Insurance & Compliance                            $2,000 (4.7%)
  Travel & Marketing                                $1,000 (2.3%)
  Total G&A                                       $42,800 (100%)

Cash & Liquidity:
  Cash and cash equivalents: $32.1 million
  Monthly burn rate: $18-22 million
  Projected runway: Into Q4 2025 (approximately 1.5 months)

Note: Company raised $60M bridge financing in June 2025.
Going concern warning: Substantial doubt about ability to continue operations.
`;

// 2024년 Q3 10-Q 데이터
const EVTL_2024_Q3 = `
VERTICAL AEROSPACE LTD.
FORM 10-Q
For the quarterly period ended September 30, 2024

CONSOLIDATED STATEMENTS OF OPERATIONS
(In thousands)
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

R&D 비용 세부 내역 (Nine Months 2024):
  Flight Testing & Certification                  $48,200 (41.8%)
  Prototype Manufacturing & Tooling               $26,400 (22.9%)
  Engineering Personnel                           $21,600 (18.8%)
  Regulatory & Compliance                         $10,800 (9.4%)
  Software & Simulation                            $5,600 (4.9%)
  Testing Equipment & Facilities                   $2,600 (2.3%)
  Total R&D                                      $115,200 (100%)

G&A 비용 세부 내역 (Nine Months 2024):
  Professional Fees (법률, 회계, 컨설팅)           $14,600 (37.5%)
  Administrative Personnel                         $11,200 (28.8%)
  Facilities & Rent                                 $6,800 (17.5%)
  IT & Software Subscriptions                       $3,400 (8.7%)
  Insurance & Compliance                            $1,900 (4.9%)
  Travel & Marketing                                $1,000 (2.6%)
  Total G&A                                       $38,900 (100%)

Cash & Liquidity:
  Cash and cash equivalents: $45.2 million
  Monthly burn rate: $15-18 million
  Projected runway: Into Q1 2025 (approximately 3 months)
`;

async function main() {
  console.log('🎯 Vertical Aerospace: 2025 vs 2024 운영 비용 비교 분석\n');
  console.log('='.repeat(70));

  const warRoom = new WarRoom();
  await warRoom.initialize();

  const context: AgentContext = {
    projectId: 1
  };

  // Step 1: Dorothy 분석 - 2025 vs 2024 세분화된 비용 비교
  console.log('\n💰 Step 1: Dorothy - 2025 vs 2024 운영 비용 세분화 분석');
  console.log('='.repeat(70));

  const dorothyAnalysis = await warRoom.executeTask(
    'Dorothy',
    'analyze_text',
    {
      company: 'Vertical Aerospace Ltd. (EVTL)',
      filingType: '10-Q Comparison',
      filingDate: '2025-11-12 vs 2024-11-12',
      text: `${EVTL_2025_Q3}\n\n=== COMPARISON ===\n\n${EVTL_2024_Q3}`,
      question: `2025년 9개월 vs 2024년 9개월 운영 비용을 세분화해서 비교 분석해줘:

**필수 분석 항목:**

1. **총 운영 비용 (Total OpEx)**
   - 2025년 vs 2024년 절대값 변화
   - % 변화율
   - 주요 증가 원인

2. **R&D 비용 세부 분석** (각 항목별로):
   - Flight Testing & Certification: 금액, 증감, 비율
   - Prototype Manufacturing: 금액, 증감, 비율
   - Engineering Personnel: 금액, 증감, 비율
   - Regulatory & Compliance: 금액, 증감, 비율
   - Software & Simulation: 금액, 증감, 비율
   - Testing Equipment: 금액, 증감, 비율
   
3. **G&A 비용 세부 분석** (각 항목별로):
   - Professional Fees: 금액, 증감, 비율
   - Administrative Personnel: 금액, 증감, 비율
   - Facilities & Rent: 금액, 증감, 비율
   - IT & Software: 금액, 증감, 비율
   - Insurance & Compliance: 금액, 증감, 비율
   - Travel & Marketing: 금액, 증감, 비율

4. **현금 소진율 (Burn Rate)**
   - 2025년 월 소진율 vs 2024년
   - 런웨이 변화
   - 현금 잔액 변화

5. **핵심 인사이트**
   - 가장 많이 증가한 비용 항목 Top 3
   - 비용 절감된 항목
   - 효율성 변화
   - 생존 가능성 평가

반말로 날카롭게 분석해줘!`
    },
    context
  );

  let dorothyResult = '';
  if (dorothyAnalysis.success) {
    console.log('\n✅ Dorothy 세분화 비용 분석:\n');
    dorothyResult = dorothyAnalysis.data.analysis || '';
    console.log(dorothyResult);
  } else {
    console.error('\n❌ Dorothy 분석 실패:', dorothyAnalysis.error);
    return;
  }

  // Step 2: Alice 전략 진단
  console.log('\n\n🎯 Step 2: Alice - 전략적 상태 진단');
  console.log('='.repeat(70));

  const aliceAnalysis = await warRoom.executeTask(
    'Alice',
    'consult',
    {
      query: `Dorothy가 Vertical Aerospace 2025 vs 2024 운영 비용을 세분화해서 분석한 결과야:

${dorothyResult}

이 비용 변화를 바탕으로 Vertical의 전략적 상태를 진단해줘:

**필수 분석:**

1. **현재 상황 종합 평가** (3-5문장)
   - 비용 증가 추세의 의미
   - 현금 소진 가속화 평가
   
2. **핵심 전략적 과제 Top 3**
   - 각각 구체적으로

3. **생존 가능성 평가**
   - 높음/중간/낮음으로 평가
   - 근거와 함께

4. **즉시 필요한 액션 Top 3**
   - 우선순위별로
   - 각각 실행 가능하게

5. **시나리오 분석**
   - 최악의 시나리오 (확률 포함)
   - 최선의 시나리오 (확률 포함)
   - Base case 시나리오 (확률 포함)

McKinsey 스타일로 날카롭게 분석해줘! 반말로!`,
      useHistory: false
    },
    context
  );

  if (aliceAnalysis.success) {
    console.log('\n✅ Alice 전략 진단:\n');
    console.log(aliceAnalysis.data.response);
  } else {
    console.error('\n❌ Alice 분석 실패:', aliceAnalysis.error);
  }

  await warRoom.shutdown();

  console.log('\n');
  console.log('='.repeat(70));
  console.log('✅ 2025 vs 2024 세분화 비용 분석 완료!');
  console.log('='.repeat(70));
}

main().catch((error) => {
  console.error('\n💥 Fatal Error:', error);
  process.exit(1);
});
