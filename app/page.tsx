'use client';

import { useState, useEffect, useRef } from 'react';

// Types
interface Message {
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  emoji?: string;
  timestamp: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

interface ChatStorage {
  conversations: Conversation[];
  currentConversationId: string | null;
  selectedModel: string;
}

const MODELS = [
  { value: 'glm-4-plus', label: 'GLM-4 Plus (최고 성능)' },
  { value: 'glm-4-flash', label: 'GLM-4 Flash (빠른 응답)' },
  { value: 'glm-4-air', label: 'GLM-4 Air (경량)' },
  { value: 'glm-4', label: 'GLM-4 (기본)' },
];

// Simple ID generator
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export default function ChatPage() {
  const [storage, setStorage] = useState<ChatStorage>({
    conversations: [],
    currentConversationId: null,
    selectedModel: 'glm-4-plus',
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // localStorage 불러오기
  useEffect(() => {
    const saved = localStorage.getItem('warroom_chat');
    if (saved) {
      try {
        setStorage(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load chat history:', e);
      }
    }
  }, []);

  // storage 변경될 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('warroom_chat', JSON.stringify(storage));
  }, [storage]);

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [storage.currentConversationId, storage.conversations]);

  const currentConversation = storage.conversations.find(
    (c) => c.id === storage.currentConversationId
  );

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    let conversationId = storage.currentConversationId;

    // 새 대화 시작
    if (!conversationId) {
      conversationId = generateId();
      const newConversation: Conversation = {
        id: conversationId,
        title: input.substring(0, 30) + (input.length > 30 ? '...' : ''),
        messages: [userMessage],
        createdAt: Date.now(),
      };

      setStorage((prev) => ({
        ...prev,
        conversations: [newConversation, ...prev.conversations],
        currentConversationId: conversationId,
      }));
    } else {
      // 기존 대화에 추가
      setStorage((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, messages: [...c.messages, userMessage] }
            : c
        ),
      }));
    }

    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          model: storage.selectedModel,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // 여러 에이전트 응답 처리
      const assistantMessages: Message[] = data.responses.map((r: any) => ({
        role: 'assistant' as const,
        content: r.content,
        agent: r.agent,
        emoji: r.emoji,
        timestamp: Date.now(),
      }));

      setStorage((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, messages: [...c.messages, ...assistantMessages] }
            : c
        ),
      }));
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `❌ 에러 발생: ${error instanceof Error ? error.message : '알 수 없는 에러'}`,
        timestamp: Date.now(),
      };

      setStorage((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, messages: [...c.messages, errorMessage] }
            : c
        ),
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setStorage((prev) => ({ ...prev, currentConversationId: null }));
  };

  const selectConversation = (id: string) => {
    setStorage((prev) => ({ ...prev, currentConversationId: id }));
  };

  const deleteConversation = (id: string) => {
    setStorage((prev) => ({
      ...prev,
      conversations: prev.conversations.filter((c) => c.id !== id),
      currentConversationId:
        prev.currentConversationId === id ? null : prev.currentConversationId,
    }));
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-black/30 backdrop-blur-xl border-r border-white/10 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
            WAR-ROOM
          </h1>
          <button
            onClick={startNewChat}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl font-medium transition-all shadow-lg shadow-purple-500/50"
          >
            + 새 대화
          </button>
        </div>

        {/* Model Selector */}
        <div className="p-4 border-b border-white/10">
          <label className="text-xs text-gray-400 mb-2 block">AI 모델</label>
          <select
            value={storage.selectedModel}
            onChange={(e) =>
              setStorage((prev) => ({ ...prev, selectedModel: e.target.value }))
            }
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {MODELS.map((model) => (
              <option key={model.value} value={model.value} className="bg-slate-900">
                {model.label}
              </option>
            ))}
          </select>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {storage.conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                conv.id === storage.currentConversationId
                  ? 'bg-white/10 border border-purple-500/50'
                  : 'bg-white/5 hover:bg-white/10 border border-transparent'
              }`}
              onClick={() => selectConversation(conv.id)}
            >
              <div className="text-sm font-medium truncate">{conv.title}</div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(conv.createdAt).toLocaleDateString('ko-KR')}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-opacity"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-16 bg-black/20 backdrop-blur-xl border-b border-white/10 flex items-center px-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-gray-300">
              AI Agents: 자동 선택 모드
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {currentConversation && currentConversation.messages.length > 0 ? (
            currentConversation.messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl p-4 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-purple-600 to-pink-600 shadow-lg shadow-purple-500/30'
                      : 'bg-white/10 backdrop-blur-xl border border-white/20'
                  }`}
                >
                  {msg.role === 'assistant' && msg.agent && (
                    <div className="text-xs font-semibold mb-2 opacity-70">
                      {msg.emoji} {msg.agent}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  <div className="text-xs opacity-50 mt-2">
                    {new Date(msg.timestamp).toLocaleTimeString('ko-KR')}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <div className="text-6xl mb-4">🤖</div>
                <p className="text-xl mb-2">새 대화를 시작해보세요</p>
                <p className="text-sm opacity-70">
                  질문하면 AI가 자동으로 적합한 에이전트를 선택합니다
                </p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-6 bg-black/20 backdrop-blur-xl border-t border-white/10">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="메시지를 입력하세요..."
              disabled={isLoading}
              className="flex-1 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 backdrop-blur-xl"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-2xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/50"
            >
              {isLoading ? '⏳' : '전송'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
