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

// ============================================
// Agent Name Mapping (English ↔ Korean)
// ============================================
const AGENT_NAME_MAP: Record<string, string> = {
  // English names
  'alice': 'Alice',
  'dorothy': 'Dorothy',
  'belle': 'Belle',
  'anna': 'Anna',
  'wendy': 'Wendy',
  'aurora': 'Aurora',
  'elsa': 'Elsa',
  'amy': 'Amy',
  'helena': 'Helena',

  // Korean names
  '앨리스': 'Alice',
  '도로시': 'Dorothy',
  '벨': 'Belle',
  '안나': 'Anna',
  '웬디': 'Wendy',
  '오로라': 'Aurora',
  '엘사': 'Elsa',
  '에이미': 'Amy',
  '헬레나': 'Helena',

  // Aliases
  '엘리스': 'Alice', // 앨리스 오타 대응
  '헬렌': 'Helena',
};

const ALL_AGENTS = ['Alice', 'Dorothy', 'Belle', 'Anna', 'Wendy', 'Aurora', 'Elsa', 'Amy', 'Helena'];

// 질문을 분석해서 적합한 에이전트 선택
function selectAgents(message: string): string[] {
  const lowerMessage = message.toLowerCase();
  const agents: string[] = [];

  // ============================================
  // Priority 1: @mention 파싱 (영어/한글 지원 + @all + 멀티)
  // ============================================

  // Check for @all
  if (/@all/i.test(message) || /@전체/i.test(message)) {
    console.log(`[Agent Selection] ✅ @all detected - calling all agents`);
    return ALL_AGENTS;
  }

  // Extract all @mentions (supports English, Korean, comma-separated)
  // Pattern: @이름1,@이름2 or @이름1, @이름2 or @이름1 @이름2
  const mentionPattern = /@([A-Za-z가-힣]+)/gi;
  const mentions = [...message.matchAll(mentionPattern)];

  if (mentions.length > 0) {
    console.log(`[Agent Selection] 📝 Found ${mentions.length} @mentions`);

    for (const match of mentions) {
      const mentionedName = match[1];
      const lowerMention = mentionedName.toLowerCase();

      // Try to map to agent name (English or Korean)
      const agentName = AGENT_NAME_MAP[lowerMention] || AGENT_NAME_MAP[mentionedName];

      if (agentName) {
        if (!agents.includes(agentName)) {
          agents.push(agentName);
          console.log(`[Agent Selection] ✅ Matched: @${mentionedName} → ${agentName}`);
        }
      } else {
        console.warn(`[Agent Selection] ⚠️ Unknown agent mentioned: @${mentionedName}`);
      }
    }

    if (agents.length > 0) {
      console.log(`[Agent Selection] 🎯 Selected agents via @mention: ${agents.join(', ')}`);
      return agents;
    }
  }

  // ============================================
  // Priority 2: 키워드 매칭 (fallback)
  // ============================================

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
    '리스크', '기회', '위협', '강점', '약점', 'swot', '포트폴리오'
  ];

  // Helena (SEC Data Curator) - 데이터 준비, 수집, 전처리 관련
  const helenaKeywords = [
    '데이터 준비', '데이터 수집', 'prepare data', '전처리', 'preprocessing',
    'filing 다운로드', 'download filing', 'xbrl', '데이터베이스', 'database'
  ];

  // Dorothy 관련성 체크
  if (dorothyKeywords.some(keyword => lowerMessage.includes(keyword))) {
    agents.push('Dorothy');
  }

  // Helena 관련성 체크
  if (helenaKeywords.some(keyword => lowerMessage.includes(keyword))) {
    agents.push('Helena');
  }

  // Alice 관련성 체크
  if (aliceKeywords.some(keyword => lowerMessage.includes(keyword))) {
    agents.push('Alice');
  }

  // 키워드 매칭 안 되면 Alice 기본 (전략 컨설턴트)
  if (agents.length === 0) {
    console.log('[Agent Selection] ℹ️ No keywords matched - defaulting to Alice');
    agents.push('Alice');
  }

  console.log(`[Agent Selection] 📊 Keyword matching result: ${agents.join(', ')}`);
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
              } else if (agentName === 'Helena') {
                sendEvent('status', { agent: 'Helena', message: 'Helena (SEC Data Curator) 시작...' });
                console.log('\n[Helena] ▶ 시작: SEC 데이터 준비 및 큐레이션');
                console.log('[Helena] 질문:', message);

                // Extract ticker from message (simple pattern matching)
                const tickerMatch = message.match(/([A-Z]{2,5})(?:\s|$)/);
                const ticker = tickerMatch ? tickerMatch[1] : null;

                if (!ticker) {
                  content = '❌ Ticker symbol을 찾을 수 없어. 예: "@Helena JOBY 데이터 준비해줘"';
                  responses.push({
                    agent: 'Helena',
                    content,
                    emoji: '📚',
                    status: '티커 필요'
                  });
                } else {
                  // Parse forceRefresh from message
                  const forceRefresh = /forceRefresh|재처리|다시|refresh/i.test(message);

                  console.log(`[Helena] forceRefresh: ${forceRefresh}`);

                  // Create progress callback
                  const onProgress = (status: string) => {
                    console.log(`[Helena Progress] ${status}`);
                    sendEvent('status', { agent: 'Helena', message: status });
                  };

                  result = await warRoom.executeTask(
                    'Helena',
                    'prepare_company_data',
                    {
                      ticker,
                      years: 3,
                      filingTypes: ['10-K', '10-Q', '20-F'],
                      forceRefresh,
                      onProgress,
                    },
                    context
                  );

                  console.log('[Helena] ✓ 완료:', result.success ? '성공' : '실패');

                  if (result.success) {
                    const data = result.data;
                    // Use data.message if available (smart response), otherwise fallback
                    content = data.message ||
                      `✅ ${data.company || ticker} 데이터 준비 완료!\n\n` +
                      `📊 처리된 Filing: ${data.filingsProcessed || 0}개\n` +
                      `💎 추출된 Metrics: ${data.metricsExtracted || 0}개\n` +
                      `📝 추출된 Sections: ${data.sectionsExtracted || 0}개`;

                    responses.push({
                      agent: 'Helena',
                      content,
                      emoji: '📚',
                      status: 'データ準비 완료'
                    });
                  } else {
                    content = result.error || '알 수 없는 오류가 발생했어';
                    responses.push({
                      agent: 'Helena',
                      content,
                      emoji: '📚',
                      status: '재처리 필요'
                    });
                  }
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
              } else {
                // ============================================
                // Other agents (Belle, Anna, Wendy, Aurora, Elsa, Amy)
                // ============================================
                const agentConfig: Record<string, { emoji: string; description: string; task: string }> = {
                  'Belle': { emoji: '🔍', description: '시장 정보 수집가', task: 'gather_intelligence' },
                  'Anna': { emoji: '⚖️', description: '규제 준수 전문가', task: 'check_compliance' },
                  'Wendy': { emoji: '📋', description: '회의 관리자', task: 'manage_meeting' },
                  'Aurora': { emoji: '⚙️', description: '운영 최적화 전문가', task: 'optimize_operations' },
                  'Elsa': { emoji: '🛡️', description: '리스크 관리자', task: 'assess_risk' },
                  'Amy': { emoji: '📖', description: '프로젝트 히스토리 관리자', task: 'track_history' }
                };

                const config = agentConfig[agentName];
                if (config) {
                  sendEvent('status', { agent: agentName, message: `${agentName} (${config.description}) 시작...` });
                  console.log(`\n[${agentName}] ▶ 시작: ${config.description}`);
                  console.log(`[${agentName}] 질문:`, message);

                  result = await warRoom.executeTask(
                    agentName,
                    config.task,
                    { query: message },
                    context
                  );

                  console.log(`[${agentName}] ✓ 완료:`, result.success ? '성공' : '실패');

                  content = result.success
                    ? (result.data?.response || result.data?.answer || '응답이 없어')
                    : `❌ ${result.error}`;

                  if (result.success || result.error) {
                    responses.push({
                      agent: agentName,
                      content,
                      emoji: config.emoji,
                      status: result.success ? '완료' : '오류'
                    });
                  }
                } else {
                  console.warn(`[${agentName}] ⚠️ Agent not configured for API route`);
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
