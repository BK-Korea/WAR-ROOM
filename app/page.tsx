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
  { value: 'glm-4-plus', label: 'GLM-4 Plus' },
  { value: 'glm-4-flash', label: 'GLM-4 Flash' },
  { value: 'glm-4-air', label: 'GLM-4 Air' },
  { value: 'glm-4', label: 'GLM-4' },
];

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export default function ChatPage() {
  const [storage, setStorage] = useState<ChatStorage>({
    conversations: [],
    currentConversationId: null,
    selectedModel: 'glm-4-plus',
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('작업 준비 중...');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    localStorage.setItem('warroom_chat', JSON.stringify(storage));
  }, [storage]);

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
    setLoadingStatus('에이전트 시작 중...');

    try {
      // Use fetch with streaming (SSE)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          model: storage.selectedModel,
        }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResponses: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const jsonData = JSON.parse(line.substring(6));

            switch (jsonData.type) {
              case 'status':
                // Update loading status in real-time!
                setLoadingStatus(jsonData.data.message);
                break;
              case 'responses':
                finalResponses = jsonData.data.responses;
                console.log('[Frontend] 📥 Received responses:', {
                  count: finalResponses.length,
                  agents: finalResponses.map((r: any) => r.agent)
                });
                break;
              case 'error':
                throw new Error(jsonData.data.message);
              case 'done':
                // Stream completed
                console.log('[Frontend] ✅ Stream completed, finalResponses:', finalResponses.length);
                break;
            }
          } catch (parseError) {
            console.error('Error parsing SSE data:', parseError);
          }
        }
      }

      // Add assistant messages after stream completes
      const assistantMessages: Message[] = finalResponses.map((r: any) => ({
        role: 'assistant' as const,
        content: r.content,
        agent: r.agent,
        emoji: r.emoji,
        timestamp: Date.now(),
      }));

      console.log('[Frontend] 💬 Assistant messages created:', assistantMessages.map(m => ({
        agent: m.agent,
        contentLength: m.content?.length || 0,
        hasContent: !!m.content
      })));

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
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    <div className="flex h-screen bg-[#0a0a0a] text-white">
      {/* Sidebar - Collapsible */}
      <div
        className={`${
          sidebarOpen ? 'w-80' : 'w-0'
        } transition-all duration-300 ease-in-out bg-black/40 backdrop-blur-sm border-r border-white/5 flex flex-col overflow-hidden`}
      >
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-semibold tracking-tight">WAR-ROOM</h1>
              <div className="flex items-center gap-2">
                <select
                  value={storage.selectedModel}
                  onChange={(e) =>
                    setStorage((prev) => ({ ...prev, selectedModel: e.target.value }))
                  }
                  className="px-2 py-1 text-xs bg-white/5 border border-white/10 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500/50 hover:bg-white/10 transition-colors"
                >
                  {MODELS.map((model) => (
                    <option key={model.value} value={model.value} className="bg-black">
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={startNewChat}
              className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 group"
            >
              <span className="text-lg group-hover:rotate-90 transition-transform">+</span>
              New Chat
            </button>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {storage.conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                  conv.id === storage.currentConversationId
                    ? 'bg-white/10 border border-blue-500/30'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
                onClick={() => selectConversation(conv.id)}
              >
                <div className="text-sm font-medium truncate pr-6">{conv.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(conv.createdAt).toLocaleDateString()}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded transition-all text-xs"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 left-4 z-10 p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-20">
          <div className="max-w-4xl mx-auto space-y-6">
            {!currentConversation || currentConversation.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-20">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                  <svg
                    className="w-8 h-8 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-200">Welcome to WAR-ROOM</h2>
                <p className="text-gray-500 max-w-md">
                  Your AI-powered strategic analysis platform. Ask Dorothy and Alice anything.
                </p>
              </div>
            ) : (
              currentConversation.messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  } animate-fade-in`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mr-3 mt-1">
                      <span className="text-lg">{msg.emoji || '🤖'}</span>
                    </div>
                  )}
                  <div
                    className={`max-w-3xl rounded-2xl px-6 py-4 ${
                      msg.role === 'user'
                        ? 'bg-blue-600/10 border border-blue-500/20'
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    {msg.agent && (
                      <div className="text-xs font-semibold text-blue-400 mb-2">
                        {msg.agent}
                      </div>
                    )}
                    <div className="text-[15px] leading-relaxed whitespace-pre-wrap text-gray-100">
                      {msg.content}
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center ml-3 mt-1">
                      <span className="text-lg">👤</span>
                    </div>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start animate-fade-in">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mr-3 mt-1">
                  <span className="text-lg">🤖</span>
                </div>
                <div className="max-w-3xl rounded-2xl px-6 py-4 bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse delay-75"></div>
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse delay-150"></div>
                    </div>
                    <span className="text-sm text-gray-300">{loadingStatus}</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-white/5 bg-black/20 backdrop-blur-sm p-4">
          <div className="max-w-4xl mx-auto">
            <div className="relative flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask Dorothy or Alice anything..."
                  className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent resize-none text-[15px] leading-relaxed placeholder:text-gray-500 transition-all hover:bg-white/10"
                  rows={1}
                  style={{
                    minHeight: '56px',
                    maxHeight: '200px',
                  }}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 w-14 h-14 bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 disabled:cursor-not-allowed rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-blue-500/20 disabled:shadow-none"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-3 text-center">
              Dorothy: Financial Analysis • Alice: Strategy Consulting
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .delay-75 {
          animation-delay: 75ms;
        }
        .delay-150 {
          animation-delay: 150ms;
        }
      `}</style>
    </div>
  );
}
