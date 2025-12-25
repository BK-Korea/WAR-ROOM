import { NextRequest, NextResponse } from 'next/server';
import { WarRoom } from '@/orchestrator/WarRoom';
import { AgentContext } from '@/types/agent';

// Initialize WarRoom singleton (reuse across requests)
let warRoomInstance: WarRoom | null = null;

async function getWarRoom() {
  if (!warRoomInstance) {
    warRoomInstance = new WarRoom();
    await warRoomInstance.initialize();
  }
  return warRoomInstance;
}

// 질문을 분석해서 적합한 에이전트 선택
function selectAgents(message: string): string[] {
  const lowerMessage = message.toLowerCase();
  const agents: string[] = [];

  // Dorothy (재무 분석가) - 재무, SEC, 주식, 재무제표 관련
  const dorothyKeywords = [
    '재무', '주식', 'sec', '10-k', '10-q', '재무제표', '손익계산서', '대차대조표',
    '현금흐름', '매출', '수익', '비용', '자산', '부채', '자본', '주가', 'eps',
    'revenue', 'profit', 'cash', 'financial', 'quarterly', 'annual', 'filing',
    '분기', '연간', '실적', 'ebitda', 'valuation', '가치평가', '배당'
  ];

  // Alice (전략 컨설턴트) - 전략, 시장, 경쟁, M&A 관련
  const aliceKeywords = [
    '전략', '시장', '경쟁', 'm&a', '인수', '합병', '확장', '성장', '진출',
    '포지셔닝', '차별화', '경쟁우위', '시장점유율', '사업모델', '비즈니스',
    'strategy', 'market', 'competition', 'expansion', 'growth', 'positioning',
    '리스크', '기회', '위협', '강점', '약점', 'swot', '포트폴리오'
  ];

  // Dorothy 관련성 체크
  if (dorothyKeywords.some(keyword => lowerMessage.includes(keyword))) {
    agents.push('Dorothy');
  }

  // Alice 관련성 체크
  if (aliceKeywords.some(keyword => lowerMessage.includes(keyword))) {
    agents.push('Alice');
  }

  // 키워드 매칭 안 되면 둘 다 답변 (일반적인 질문)
  if (agents.length === 0) {
    agents.push('Dorothy', 'Alice');
  }

  return agents;
}

export async function POST(req: NextRequest) {
  try {
    const { message, model } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: '메시지를 입력해야 해' },
        { status: 400 }
      );
    }

    const warRoom = await getWarRoom();
    const context: AgentContext = {
      projectId: 1, // Default project
    };

    // 질문 분석해서 적합한 에이전트 선택
    const selectedAgents = selectAgents(message);
    console.log(`[Auto-Select] Question: "${message.substring(0, 50)}..." → Agents: ${selectedAgents.join(', ')}`);

    const responses: Array<{ agent: string; content: string; emoji: string }> = [];

    // 선택된 에이전트들이 순차적으로 응답
    for (const agentName of selectedAgents) {
      try {
        let result;
        let content: string;

        if (agentName === 'Dorothy') {
          result = await warRoom.executeTask(
            'Dorothy',
            'analyze_text',
            {
              company: 'User Query',
              filingType: 'Direct Question',
              filingDate: new Date().toISOString(),
              text: message,
              question: message,
            },
            context
          );
          content = result.success ? (result.data.analysis || '분석 결과가 없어') : `❌ ${result.error}`;

          if (result.success) {
            responses.push({
              agent: 'Dorothy',
              content,
              emoji: '💼'
            });
          }
        } else if (agentName === 'Alice') {
          result = await warRoom.executeTask(
            'Alice',
            'consult',
            {
              query: message,
              useHistory: false,
            },
            context
          );
          content = result.success ? (result.data.response || '응답이 없어') : `❌ ${result.error}`;

          if (result.success) {
            responses.push({
              agent: 'Alice',
              content,
              emoji: '💡'
            });
          }
        }
      } catch (agentError) {
        console.error(`[${agentName}] Error:`, agentError);
        // 한 에이전트 실패해도 다른 에이전트는 계속 진행
      }
    }

    // 모든 에이전트가 실패했으면 에러
    if (responses.length === 0) {
      throw new Error('모든 에이전트가 응답에 실패했어');
    }

    return NextResponse.json({
      responses,
      selectedAgents
    });
  } catch (error) {
    console.error('[API Error]', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '알 수 없는 에러가 발생했어',
      },
      { status: 500 }
    );
  }
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    if (warRoomInstance) {
      await warRoomInstance.shutdown();
      warRoomInstance = null;
    }
  });
}
