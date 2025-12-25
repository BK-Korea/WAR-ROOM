/**
 * Vertical Aerospace 분석: Dorothy → Alice 협업
 * Dorothy: 24-25년 운영 비용 비교 분석
 * Alice: 전략적 상태 진단
 */

import { WarRoom } from './src/index.js';
import { AgentContext } from './src/types/agent.js';

// Sample EVTL 10-Q filing data
const SAMPLE_EVTL_10Q = `
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

Note 1 - Basis of Presentation and Going Concern

As of September 30, 2024, the Company had cash and cash equivalents of $45.2 million. 
The Company has incurred significant operating losses since inception. For the nine months 
ended September 30, 2024, the Company incurred a net loss of $153.7 million and used 
$114.2 million of cash in operating activities.

Based on current operating plan and expected cash burn rate of approximately $15-18 million 
per month, management estimates that existing cash will fund operations into Q1 2025.
`;

async function main() {
  console.log('🎯 Vertical Aerospace 분석: Dorothy → Alice 협업\n');
  console.log('='.repeat(70));

  const warRoom = new WarRoom();
  await warRoom.initialize();

  const context: AgentContext = {
    projectId: 1
  };

  // Step 1: Dorothy 분석 - 운영 비용 분석
  console.log('\n💰 Step 1: Dorothy - 2024년 운영 비용 분석');
  console.log('='.repeat(70));

  const dorothyAnalysis = await warRoom.executeTask(
    'Dorothy',
    'analyze_text',
    {
      company: 'Vertical Aerospace Ltd. (EVTL)',
      filingType: '10-Q',
      filingDate: '2024-11-12',
      text: SAMPLE_EVTL_10Q,
      question: `2024년 9개월(9M 2024) 운영 비용을 분석해줘:
      
1. R&D 비용과 G&A 비용 각각 얼마야?
2. 분기당 평균 운영 비용은?
3. 월 소진율(burn rate)은 얼마야?
4. 현재 현금이 얼마 남았고, 얼마나 버틸 수 있어?
5. 핵심 리스크가 뭐야?

반말로 날카롭게 분석해줘!`
    },
    context
  );

  let dorothyResult = '';
  if (dorothyAnalysis.success) {
    console.log('\n✅ Dorothy 분석 결과:\n');
    dorothyResult = dorothyAnalysis.data.analysis || '';
    console.log(dorothyResult);
  } else {
    console.error('\n❌ Dorothy 분석 실패:', dorothyAnalysis.error);
    return;
  }

  // Step 2: Alice 전략 진단 - Dorothy 결과 기반
  console.log('\n\n🎯 Step 2: Alice - 전략적 상태 진단');
  console.log('='.repeat(70));

  const aliceAnalysis = await warRoom.executeTask(
    'Alice',
    'consult',
    {
      query: `Dorothy가 Vertical Aerospace(EVTL) 재무 분석한 결과야:

${dorothyResult}

이 정보를 바탕으로 Vertical Aerospace의 전략적 상태를 진단해줘:

1. 현재 상황 평가 (3-5 문장)
2. 핵심 전략적 과제 3가지
3. 생존 가능성 평가 (높음/중간/낮음)
4. 즉시 필요한 액션 3가지
5. 최악의 시나리오와 최선의 시나리오

McKinsey 스타일로 날카롭게, 반말로 분석해줘!`,
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
  console.log('✅ Dorothy → Alice 협업 완료!');
  console.log('='.repeat(70));
}

main().catch((error) => {
  console.error('\n💥 Fatal Error:', error);
  process.exit(1);
});
