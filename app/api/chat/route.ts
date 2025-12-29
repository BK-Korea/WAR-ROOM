import { NextRequest, NextResponse } from 'next/server';
import { WarRoom } from '@/orchestrator/WarRoom';
import { AgentContext } from '@/types/agent';
import { glmClient } from '@/llm/GLMClient';

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

// ============================================
// LLM-based Agent Selection (Natural Language Understanding)
// ============================================
async function selectAgents(message: string, history: any[] = []): Promise<string[]> {
  // ============================================
  // Priority 1: @mention 파싱 (영어/한글 지원 + @all + 멀티)
  // ============================================

  // Check for @all
  if (/@all/i.test(message) || /@전체/i.test(message)) {
    console.log(`[Agent Selection] ✅ @all detected - calling all agents`);
    return ALL_AGENTS;
  }

  // Extract all @mentions (supports English, Korean, comma-separated)
  const mentionPattern = /@([A-Za-z가-힣]+)/gi;
  const mentions = [...message.matchAll(mentionPattern)];

  if (mentions.length > 0) {
    console.log(`[Agent Selection] 📝 Found ${mentions.length} @mentions`);
    const agents: string[] = [];

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
  // Priority 2: LLM-based intelligent selection (NEW!)
  // ============================================
  console.log('[Agent Selection] 🤖 Using LLM-based natural language understanding...');

  try {
    // Create context from recent conversation history
    const recentContext = history.slice(-3).map((msg: any) =>
      `${msg.role === 'user' ? 'User' : 'Agent'}: ${msg.content.substring(0, 100)}`
    ).join('\n');

    const selectionPrompt = `당신은 사용자의 질문을 분석해서 적합한 AI 에이전트를 선택하는 라우터입니다.

사용 가능한 에이전트:
- Dorothy: 재무 분석가. SEC filings(10-K, 10-Q), 재무제표, 매출/수익/비용 분석, 분기/연간 실적, 현금흐름, burn rate, runway, valuation, XBRL 데이터 기반 재무 분석
- Helena: SEC 데이터 큐레이터. SEC 데이터 다운로드, XBRL 파싱, 데이터 준비/수집/전처리, 재처리(refresh), 데이터베이스 관리, filing 준비
- Alice: 전략 컨설턴트. 비즈니스 전략, 시장 분석, 경쟁 분석, M&A, 성장 전략, 포지셔닝, SWOT 분석, 비즈니스 모델
- Belle: 시장 정보 수집가. 시장 조사, 경쟁사 정보
- Anna: 규제 준수 전문가. 규제 compliance, 인증
- Wendy: 회의 관리자. 회의록, 액션 아이템
- Aurora: 운영 최적화 전문가. 운영 효율, 프로세스 개선
- Elsa: 리스크 관리자. 리스크 평가, 규정 준수
- Amy: 프로젝트 히스토리 관리자. 프로젝트 히스토리 추적

최근 대화 맥락:
${recentContext || '(없음)'}

사용자 질문:
"${message}"

이 질문을 처리할 가장 적합한 에이전트 1-2개를 선택하세요.
- 티커(JOBY, 조비, AAPL 등) + 재무 관련 단어 → Dorothy
- 티커 + 데이터/다운/준비/재처리/파싱 → Helena
- 전략/시장/경쟁/M&A → Alice
- 자연어로 의도를 파악하세요. 키워드가 정확히 없어도 맥락으로 판단하세요.

JSON만 반환하세요: {"agents": ["AgentName1"]} 또는 {"agents": ["AgentName1", "AgentName2"]}`;

    const response = await glmClient.chat({
      messages: [
        { role: 'user', content: selectionPrompt }
      ],
      temperature: 0.3, // Low temperature for consistent routing
    });

    console.log('[Agent Selection] 🤖 LLM response:', response);

    // Parse JSON response
    const jsonMatch = response.match(/\{[^}]*"agents"[^}]*\}/);
    if (!jsonMatch) {
      console.warn('[Agent Selection] ⚠️ Failed to parse LLM response, defaulting to Alice');
      return ['Alice'];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const selectedAgents = parsed.agents || [];

    // Validate agent names
    const validAgents = selectedAgents.filter((agent: string) =>
      ALL_AGENTS.includes(agent)
    );

    if (validAgents.length === 0) {
      console.warn('[Agent Selection] ⚠️ No valid agents from LLM, defaulting to Alice');
      return ['Alice'];
    }

    console.log(`[Agent Selection] 🎯 LLM selected: ${validAgents.join(', ')}`);
    return validAgents;

  } catch (error) {
    console.error('[Agent Selection] ❌ LLM selection failed:', error);
    console.log('[Agent Selection] ℹ️ Falling back to Alice');
    return ['Alice'];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { message, model, history = [] } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: '메시지를 입력해야 해' },
        { status: 400 }
      );
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log(`[WAR-ROOM] 새 질문 받음: "${message}"`);
    console.log(`[WAR-ROOM] 대화 히스토리: ${history.length}개 메시지`);
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

          const selectedAgents = await selectAgents(message, history);
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
                    history, // Pass conversation history for context
                    onProgress,  // Pass progress callback
                    warRoom,  // Pass warRoom for auto-calling Helena
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

                // Always add response (success or error)
                const dorothyResponse = {
                  agent: 'Dorothy',
                  content,
                  emoji: '💼',
                  status: result.success
                    ? (result.data.sourcesUsed ? 'SEC 데이터 기반' : '데이터 없음')
                    : '에러 발생'
                };
                responses.push(dorothyResponse);
                console.log(`[Dorothy] ${result.success ? '✅' : '❌'} Response added to array:`, {
                  success: result.success,
                  contentLength: content.length,
                  hasContent: !!content,
                  totalResponses: responses.length,
                  contentPreview: content.substring(0, 100) + '...'
                });
              } else if (agentName === 'Helena') {
                sendEvent('status', { agent: 'Helena', message: 'Helena (SEC Data Curator) 시작...' });
                console.log('\n[Helena] ▶ 시작: SEC 데이터 준비 및 큐레이션');
                console.log('[Helena] 질문:', message);

                // ============================================
                // Extract ticker/company name from message
                // SECClient's LLM will handle natural language extraction
                // Supports: ticker symbols (AAPL), Korean (애플, 버티컬 에어로스페이스), English (Apple, Vertical Aerospace)
                // ============================================
                console.log('[Helena] Extracting ticker/company from message:', message);

                // Remove @mentions to avoid passing agent names to LLM
                const cleanMessage = message.replace(/@[A-Za-z가-힣]+/g, '').trim();
                console.log('[Helena] Message after removing @mentions:', cleanMessage);

                // Pass the entire message to Helena
                // SECClient's LLM will extract the ticker intelligently
                const ticker = cleanMessage;

                if (!ticker) {
                  content = '❌ 메시지를 찾을 수 없어.\n\n예: "@Helena JOBY 데이터 준비해줘"';
                  responses.push({
                    agent: 'Helena',
                    content,
                    emoji: '📚',
                    status: '메시지 필요'
                  });
                } else {
                  // Parse forceRefresh from message
                  const forceRefresh = /forceRefresh|재처리|다시|refresh/i.test(message);

                  // Parse years parameter from message (e.g., "years=5" or "(years=5)")
                  const yearsMatch = message.match(/years?\s*[=:]\s*(\d+)/i);
                  const years = yearsMatch ? parseInt(yearsMatch[1]) : 3;

                  console.log(`[Helena] forceRefresh: ${forceRefresh}, years: ${years}`);

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
                      years,
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
                    history, // Pass conversation history for context
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
