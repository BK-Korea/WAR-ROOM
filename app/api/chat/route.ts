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
    '분기', '연간', '실적', 'ebitda', 'valuation', '가치평가', '배당', 'burn rate',
    '소진율', '런웨이', 'runway', 'liquidity', '유동성'
  ];

  // Alice (전략 컨설턴트) - 전략, 시장, 경쟁, M&A, 비즈니스 모델 관련
  const aliceKeywords = [
    '전략', '시장', '경쟁', 'm&a', '인수', '합병', '확장', '성장', '진출',
    '포지셔닝', '차별화', '경쟁우위', '시장점유율', '사업모델', '비즈니스모델',
    'business model', 'business', 'model', '비즈니스', '모델',
    'strategy', 'market', 'competition', 'expansion', 'growth', 'positioning',
    '리스크', '기회', '위협', '강점', '약점', 'swot', '포트폴리오',
    '분석', 'analysis', '현황', 'status', 'overview', '개요'
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

    console.log('\n═══════════════════════════════════════════════════');
    console.log(`[WAR-ROOM] 새 질문 받음: "${message}"`);
    console.log('═══════════════════════════════════════════════════\n');

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Helper function to send SSE message
        const sendEvent = (type: string, data: any) => {
          const message = `data: ${JSON.stringify({ type, data })}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        try {
          const warRoom = await getWarRoom();
          const context: AgentContext = {
            projectId: 1,
          };

          const selectedAgents = selectAgents(message);
          console.log(`[Auto-Select] 선택된 에이전트: ${selectedAgents.join(', ')}`);

          sendEvent('agents', { agents: selectedAgents });

          const responses: Array<{ agent: string; content: string; emoji: string; status?: string }> = [];

          for (const agentName of selectedAgents) {
            try {
              let result;
              let content: string;

              if (agentName === 'Dorothy') {
                sendEvent('status', { agent: 'Dorothy', message: 'Dorothy (재무 분석가) 시작...' });
                console.log('\n[Dorothy] ▶ 시작: SEC 데이터 기반 재무 분석');
                console.log('[Dorothy] 질문:', message);

                // Create progress callback
                const onProgress = (status: string) => {
                  console.log(`[Dorothy Progress] ${status}`);
                  sendEvent('status', { agent: 'Dorothy', message: status });
                };

                result = await warRoom.executeTask(
                  'Dorothy',
                  'answer_question',
                  {
                    question: message,
                    onProgress,  // Pass progress callback
                  },
                  context
                );

                console.log('[Dorothy] ✓ 완료:', result.success ? '성공' : '실패');
                if (!result.success) {
                  console.log('[Dorothy] ✗ 에러:', result.error);
                } else {
                  console.log('[Dorothy] ✓ 사용된 filing:', result.data.sourcesUsed?.map((s: any) => `${s.type} (${s.date})`).join(', ') || 'N/A');
                }

                content = result.success ? (result.data.answer || '분석 결과가 없어') : `❌ ${result.error}`;

                if (result.success) {
                  const dorothyResponse = {
                    agent: 'Dorothy',
                    content,
                    emoji: '💼',
                    status: result.data.sourcesUsed ? 'SEC 데이터 기반' : '데이터 없음'
                  };
                  responses.push(dorothyResponse);
                  console.log('[Dorothy] ✅ Response added to array:', {
                    contentLength: content.length,
                    hasContent: !!content,
                    totalResponses: responses.length,
                    contentPreview: content.substring(0, 100) + '...'
                  });
                }
              } else if (agentName === 'Alice') {
                sendEvent('status', { agent: 'Alice', message: 'Alice (전략 컨설턴트) 시작...' });
                console.log('\n[Alice] ▶ 시작: 전략 컨설팅');
                console.log('[Alice] 질문:', message);

                result = await warRoom.executeTask(
                  'Alice',
                  'consult',
                  {
                    query: message,
                    useHistory: false,
                  },
                  context
                );

                console.log('[Alice] ✓ 완료:', result.success ? '성공' : '실패');

                content = result.success ? (result.data.response || '응답이 없어') : `❌ ${result.error}`;

                if (result.success) {
                  responses.push({
                    agent: 'Alice',
                    content,
                    emoji: '💡',
                    status: '전략 분석 완료'
                  });
                }
              }
            } catch (agentError) {
              console.error(`[${agentName}] Error:`, agentError);
              sendEvent('error', { agent: agentName, message: `${agentName} 실행 중 오류 발생` });
            }
          }

          // Send final responses
          console.log('\n[SSE] 📤 Sending final responses:', {
            count: responses.length,
            agents: responses.map(r => r.agent)
          });

          if (responses.length === 0) {
            sendEvent('error', { message: '모든 에이전트가 응답에 실패했어' });
          } else {
            sendEvent('responses', { responses });
            console.log('[SSE] ✅ Responses sent via SSE');
          }

          sendEvent('done', {});
          controller.close();

        } catch (error) {
          console.error('Stream error:', error);
          sendEvent('error', { message: error instanceof Error ? error.message : 'Unknown error' });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
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
