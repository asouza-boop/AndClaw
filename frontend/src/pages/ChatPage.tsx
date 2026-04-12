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
    <div className="flex h-full overflow-hidden p-6 md:p-8 lg:p-10">
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full relative h-full">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-8 p-6 scroll-smooth scrollbar-hide">
          {messages.map((m, i) => (
            <div 
              key={i} 
              className={`flex gap-4 group animate-in fade-in slide-in-from-bottom-6 duration-700 ${m.role === 'user' ? 'justify-end' : ''}`}
            >
              {m.role === 'assistant' && (
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[11px] font-black text-white shrink-0 shadow-lg shadow-primary/20 interactive-scale transition-premium">
                  AC
                </div>
              )}
              <div
                className={`max-w-[80%] px-6 py-4 rounded-3xl relative transition-premium ${
                  m.role === 'user'
                    ? 'bg-primary/10 text-white rounded-tr-sm border border-primary/20 shadow-[0_4px_20px_-5px_rgba(168,85,247,0.15)]'
                    : 'bg-white/5 backdrop-blur-md text-white/90 rounded-tl-sm border border-white/5 shadow-xl'
                }`}
              >
                {m.role === 'assistant' ? (
                  <div className="prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/30 prose-pre:rounded-xl">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="leading-relaxed text-[15px] font-medium">{m.content}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  {m.role === 'assistant' && (m.trace || (loading && i === messages.length - 1)) && (
                    <button 
                      onClick={() => inspectTrace(m)}
                      className="text-[10px] flex items-center gap-2 text-primary hover:text-accent font-black uppercase tracking-wider transition-colors"
                    >
                      <Terminal className="w-3.5 h-3.5" /> EXPLORE TRACE
                    </button>
                  )}
                  <p className="text-[10px] font-black text-white/20 ml-auto tracking-widest">{formatTime(m.timestamp)}</p>
                </div>
              </div>
              {m.role === 'user' && (
                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[11px] font-black text-white/60 shrink-0 interactive-scale transition-premium">
                  ME
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-4 animate-in fade-in duration-500">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[11px] font-black text-white shrink-0 shadow-lg shadow-primary/20">
                AC
              </div>
              <div className="space-y-3">
                <div className="bg-white/5 backdrop-blur-md p-4 rounded-3xl rounded-tl-sm border border-white/5 shadow-xl">
                  <TypingIndicator />
                </div>
                {uiMode === 'debug' && currentTrace && (
                  <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] animate-pulse px-4">
                    {currentTrace.steps[currentTrace.steps.length - 1]?.type.split('.').pop()}...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* HUD */}
        <div className="absolute top-4 right-4 z-50">
          <ExecutionHUD />
        </div>

        {/* Floating Input Area */}
        <div className="p-6 md:p-8 pt-0">
          <div className="relative group glass-panel-v2 border-white/10 shadow-2xl p-2 flex gap-2 overflow-hidden transition-premium focus-within:border-primary/40 focus-within:shadow-primary/10">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte ao motor cognitivo..."
              rows={1}
              className="flex-1 px-5 py-4 bg-transparent text-[15px] text-white placeholder:text-white/20 focus:outline-none resize-none font-medium"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="w-14 h-14 rounded-2xl bg-primary text-white hover:bg-accent disabled:opacity-20 transition-all flex items-center justify-center shadow-lg shadow-primary/20 interactive-scale"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[9px] text-center text-white/20 mt-4 font-black uppercase tracking-[0.3em]">Powered by AndClaw AI Architecture</p>
        </div>
      </div>
    </div>
  );
}
