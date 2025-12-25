'use client';

import { useState } from 'react';

type Agent = 'Dorothy' | 'Alice';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  agent?: Agent;
  timestamp: Date;
}

export default function ChatPage() {
  const [selectedAgent, setSelectedAgent] = useState<Agent>('Dorothy');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: selectedAgent,
          message: input,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        agent: selectedAgent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `❌ 에러 발생: ${error instanceof Error ? error.message : '알 수 없는 에러'}`,
        agent: selectedAgent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            WAR-ROOM 🎯
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedAgent('Dorothy')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedAgent === 'Dorothy'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              💼 Dorothy
            </button>
            <button
              onClick={() => setSelectedAgent('Alice')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedAgent === 'Alice'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              💡 Alice
            </button>
          </div>
        </div>
      </header>

      {/* Agent Info Banner */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-b border-gray-200 dark:border-gray-700 p-3">
        <div className="max-w-4xl mx-auto text-sm">
          {selectedAgent === 'Dorothy' ? (
            <p className="text-purple-800 dark:text-purple-300">
              <span className="font-bold">Dorothy:</span> 20대 날카로운 CFA 재무분석가 - SEC 데이터 전문가 📊
            </p>
          ) : (
            <p className="text-blue-800 dark:text-blue-300">
              <span className="font-bold">Alice:</span> 20대 생기발랄한 McKinsey 전략 컨설턴트 - 전략 진단 전문가 🚀
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-12">
              <p className="text-lg mb-2">👋 안녕! {selectedAgent}에게 물어봐!</p>
              <p className="text-sm">예: "Vertical Aerospace 2025년 운영비용 분석해줘"</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    msg.role === 'user'
                      ? 'bg-gray-800 text-white'
                      : msg.agent === 'Dorothy'
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-gray-900 dark:text-gray-100'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="text-xs font-bold mb-1 opacity-70">
                      {msg.agent === 'Dorothy' ? '💼 Dorothy' : '💡 Alice'}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  <div className="text-xs opacity-50 mt-2">
                    {msg.timestamp.toLocaleTimeString('ko-KR')}
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`${selectedAgent}에게 질문하기...`}
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? '⏳' : '전송'}
          </button>
        </form>
      </div>
    </div>
  );
}
