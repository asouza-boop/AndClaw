import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
      <div className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" style={{ animationDelay: '0.2s' }} />
      <div className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" style={{ animationDelay: '0.4s' }} />
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history
  const { data: history } = useQuery({
    queryKey: ['chat-history'],
    queryFn: () => apiFetch('/api/messages/by-conversation/pwa-user?limit=100').catch(() => []).then(ensureArray),
  });

  useEffect(() => {
    if (history && history.length > 0 && messages.length === 0) {
      setMessages(
        history.map((m: any) => ({
          role: m.role || (m.sender === 'user' ? 'user' : 'assistant'),
          content: m.content || m.message || '',
          timestamp: m.createdAt || m.created_at,
        }))
      );
    }
  }, [history]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages((p) => [...p, { role: 'user', content: msg, timestamp: new Date().toISOString() }]);
    setLoading(true);
    try {
      const res = await apiFetch<any>('/api/agent', {
        method: 'POST',
        body: JSON.stringify({ message: msg, conversation: 'pwa-user' }),
      });
      setMessages((p) => [
        ...p,
        { role: 'assistant', content: res.response || res.message || JSON.stringify(res), timestamp: new Date().toISOString() },
      ]);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const formatTime = (ts?: string) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-4xl mx-auto">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                A
              </div>
            )}
            <div
              className={`max-w-[75%] px-4 py-3 rounded-xl text-sm ${
                m.role === 'user'
                  ? 'bg-primary/15 text-foreground rounded-br-sm'
                  : 'bg-surface-2 text-foreground rounded-bl-sm'
              }`}
            >
              {m.role === 'assistant' ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p>{m.content}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1.5 text-right">{formatTime(m.timestamp)}</p>
            </div>
            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center text-[10px] font-bold shrink-0">
                U
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              A
            </div>
            <TypingIndicator />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-4 border-t border-white/[0.07]">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte algo..."
          rows={1}
          className="flex-1 px-4 py-3 rounded-xl bg-surface border border-white/[0.07] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-4 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
