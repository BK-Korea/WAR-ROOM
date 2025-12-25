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

export async function POST(req: NextRequest) {
  try {
    const { agent, message } = await req.json();

    if (!agent || !message) {
      return NextResponse.json(
        { error: '에이전트와 메시지를 모두 입력해야 해' },
        { status: 400 }
      );
    }

    if (agent !== 'Dorothy' && agent !== 'Alice') {
      return NextResponse.json(
        { error: '유효하지 않은 에이전트야. Dorothy 또는 Alice만 가능해' },
        { status: 400 }
      );
    }

    const warRoom = await getWarRoom();
    const context: AgentContext = {
      projectId: 1, // Default project
    };

    let response: string;

    if (agent === 'Dorothy') {
      // Dorothy: analyze_text task
      const result = await warRoom.executeTask(
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

      if (!result.success) {
        throw new Error(result.error || 'Dorothy 분석 실패');
      }

      response = result.data.analysis || '분석 결과가 없어';
    } else {
      // Alice: consult task
      const result = await warRoom.executeTask(
        'Alice',
        'consult',
        {
          query: message,
          useHistory: false,
        },
        context
      );

      if (!result.success) {
        throw new Error(result.error || 'Alice 컨설팅 실패');
      }

      response = result.data.response || '응답이 없어';
    }

    return NextResponse.json({ response });
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
