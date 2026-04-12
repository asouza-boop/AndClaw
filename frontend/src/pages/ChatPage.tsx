import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Send, Terminal, Layout, Eye, EyeOff, Activity } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAgentStore } from '@/stores/agentStore';
import { ExecutionHUD } from '@/components/agent/ExecutionHUD';
import { IntelligenceSidebar } from '@/components/agent/IntelligenceSidebar';

interface Message {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  trace?: any;
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
  const queryClient = useQueryClient();

  // Agent Store
  const { 
    uiMode, setUIMode, 
    setCurrentRequestId, currentRequestId,
    setTrace, currentTrace,
    isPaused 
  } = useAgentStore();

  // Load history
  const { data: history } = useQuery({
    queryKey: ['chat-history'],
    queryFn: () => apiFetch('/api/messages/by-conversation/pwa-user?limit=100').catch(() => []).then(ensureArray),
  });

  useEffect(() => {
    if (history && history.length > 0 && messages.length === 0) {
      setMessages(
        history.map((m: any) => ({
          id: m.id,
          role: m.role || (m.sender === 'user' ? 'user' : 'assistant'),
          content: m.content || m.message || '',
          timestamp: m.createdAt || m.created_at,
          trace: m.trace
        }))
      );
    }
  }, [history]);

  // Polling Trace when loading
  useEffect(() => {
    let interval: any;
    if (loading && currentRequestId && !isPaused) {
      interval = setInterval(async () => {
        try {
          const res = await apiFetch<any>(`/api/conversations/pwa-user/latest-trace`);
          if (res.trace) setTrace(res.trace);
        } catch (err) {
          console.error("Trace polling error", err);
        }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [loading, currentRequestId, isPaused, setTrace]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    const requestId = crypto.randomUUID();
    
    setInput('');
    setMessages((p) => [...p, { role: 'user', content: msg, timestamp: new Date().toISOString() }]);
    setLoading(true);
    setCurrentRequestId(requestId);
    setTrace(null);

    try {
      const res = await apiFetch<any>('/api/agent/run', {
        method: 'POST',
        body: JSON.stringify({ 
          message: msg, 
          conversation: 'pwa-user',
          options: { requestId }
        }),
      });
      
      const assistantMsg = { 
        role: 'assistant' as const, 
        content: res.reply || res.message || JSON.stringify(res), 
        timestamp: new Date().toISOString() 
      };
      
      setMessages((p) => [...p, assistantMsg]);
      queryClient.invalidateQueries({ queryKey: ['chat-history'] });
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
      setCurrentRequestId(null);
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

  const toggleDebug = () => {
    setUIMode(uiMode === 'normal' ? 'debug' : 'normal');
  };

  const inspectTrace = (msg: Message) => {
    if (msg.trace) {
      setTrace(msg.trace);
      if (uiMode !== 'debug') setUIMode('debug');
    }
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full relative">
        {/* Header Controls */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/5">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Glass Engine v1</span>
          </div>
          <button 
            onClick={toggleDebug}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
              uiMode === 'debug' ? 'bg-primary text-white' : 'bg-surface-3 text-muted-foreground'
            }`}
          >
            {uiMode === 'debug' ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {uiMode === 'debug' ? 'DEBUG ACTIVE' : 'NORMAL VIEW'}
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 p-4 scroll-smooth">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 group ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                  A
                </div>
              )}
              <div
                className={`max-w-[85%] px-4 py-3 rounded-xl text-sm relative ${
                  m.role === 'user'
                    ? 'bg-primary/10 text-foreground rounded-br-sm border border-primary/20'
                    : 'bg-surface-2 text-foreground rounded-bl-sm border border-white/5 shadow-sm'
                }`}
              >
                {m.role === 'assistant' ? (
                  <div className="prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/30">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="leading-relaxed">{m.content}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  {m.role === 'assistant' && (m.trace || (loading && i === messages.length - 1)) && (
                    <button 
                      onClick={() => inspectTrace(m)}
                      className="text-[9px] flex items-center gap-1 text-primary hover:underline font-bold"
                    >
                      <Terminal className="w-3 h-3" /> INSPECT INTELLIGENCE
                    </button>
                  )}
                  <p className="text-[10px] text-muted-foreground ml-auto">{formatTime(m.timestamp)}</p>
                </div>
              </div>
              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center text-[10px] font-bold shrink-0 border border-white/5">
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
              <div className="space-y-2">
                <TypingIndicator />
                {uiMode === 'debug' && currentTrace && (
                  <div className="text-[10px] text-primary font-mono animate-pulse ml-4">
                    {currentTrace.steps[currentTrace.steps.length - 1]?.type}...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* HUD */}
        <ExecutionHUD />

        {/* Input */}
        <div className="p-4 border-t border-white/[0.07] bg-background/80 backdrop-blur-sm">
          <div className="relative flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte algo ao motor de inteligência..."
              rows={1}
              className="flex-1 px-4 py-3 rounded-xl bg-surface-2 border border-white/[0.07] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="px-4 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center shadow-lg shadow-primary/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Intelligence Sidebar */}
      <IntelligenceSidebar />
    </div>
  );
}
