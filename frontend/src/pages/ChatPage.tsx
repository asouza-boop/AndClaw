import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Send, Terminal, Layout, Eye, EyeOff, Activity, Bot, User2, Sparkles, CornerDownLeft } from 'lucide-react';
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
      <div className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" />
      <div className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" style={{ animationDelay: '0.2s' }} />
      <div className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" style={{ animationDelay: '0.4s' }} />
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const {
    uiMode,
    setUIMode,
    setCurrentRequestId,
    currentRequestId,
    setTrace,
    currentTrace,
    isPaused,
  } = useAgentStore();

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
          trace: m.trace,
        })),
      );
    }
  }, [history]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (loading && currentRequestId && !isPaused) {
      interval = setInterval(async () => {
        try {
          const res = await apiFetch<any>('/api/conversations/pwa-user/latest-trace');
          if (res.trace) setTrace(res.trace);
        } catch (err) {
          console.error('Trace polling error', err);
        }
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading, currentRequestId, isPaused, setTrace]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = '0px';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
  }, [input]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    const requestId = crypto.randomUUID();

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg, timestamp: new Date().toISOString() }]);
    setLoading(true);
    setCurrentRequestId(requestId);
    setTrace(null);

    try {
      const res = await apiFetch<any>('/api/agent/run', {
        method: 'POST',
        body: JSON.stringify({
          message: msg,
          conversation: 'pwa-user',
          options: { requestId },
        }),
      });

      const assistantMsg: Message = {
        role: 'assistant',
        content: res.reply || res.message || JSON.stringify(res),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      queryClient.invalidateQueries({ queryKey: ['chat-history'] });
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
      setCurrentRequestId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

  const isEmpty = messages.length === 0 && !loading;
  const currentStepLabel = currentTrace?.steps?.[currentTrace.steps.length - 1]?.type?.split('.')?.pop();

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm shadow-primary/10">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Chat com o agente</p>
            <p className="text-xs text-muted-foreground">Respostas rápidas, histórico persistente e leitura clara.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleDebug}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          >
            {uiMode === 'debug' ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {uiMode === 'debug' ? 'Debug ligado' : 'Debug'}
          </button>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <CornerDownLeft className="h-3.5 w-3.5" />
            Enter para enviar
          </div>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-surface/30 shadow-[0_24px_70px_-32px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-5 scroll-smooth sm:px-6">
          <div className="space-y-4 pb-6">
            {isEmpty && (
              <div className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-[24px] border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center animate-in fade-in duration-300">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <h2 className="text-base font-semibold text-foreground">Comece a conversa</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Envie uma pergunta, pedido de ação ou contexto. O histórico aparece aqui com separação clara entre você e o agente.
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={`${m.timestamp || 'msg'}-${i}`}
                className={`flex items-end gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary sm:flex">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[min(46rem,78%)] rounded-[22px] border px-4 py-3 shadow-sm ${
                    m.role === 'user'
                      ? 'rounded-br-md border-primary/15 bg-gradient-to-br from-primary/15 to-white/[0.03] text-foreground'
                      : 'rounded-bl-md border-white/[0.08] bg-surface/70 text-foreground'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full ${
                          m.role === 'user' ? 'bg-primary/15 text-primary' : 'bg-white/[0.05] text-muted-foreground'
                        }`}
                      >
                        {m.role === 'user' ? <User2 className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                      </span>
                      <span className={m.role === 'user' ? 'text-primary' : 'text-muted-foreground'}>
                        {m.role === 'user' ? 'Você' : 'Agente'}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{formatTime(m.timestamp)}</span>
                  </div>

                  {m.role === 'assistant' ? (
                    <div className="prose prose-sm prose-invert max-w-none prose-p:my-2 prose-headings:mb-2 prose-headings:mt-4 prose-strong:text-foreground prose-a:text-primary">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/95">{m.content}</p>
                  )}

                  {m.role === 'assistant' && (m.trace || (loading && i === messages.length - 1)) && (
                    <button
                      onClick={() => inspectTrace(m)}
                      className="mt-3 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-primary transition-colors hover:text-accent"
                    >
                      <Terminal className="h-3.5 w-3.5" />
                      Explore trace
                    </button>
                  )}
                </div>

                {m.role === 'user' && (
                  <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-[10px] font-semibold text-muted-foreground sm:flex">
                    U
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-end gap-3 animate-in fade-in duration-200">
                <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary sm:flex">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-[22px] border border-white/[0.08] bg-surface/70 px-2 py-1.5">
                  <TypingIndicator />
                </div>
                {uiMode === 'debug' && currentTrace && currentStepLabel && (
                  <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary animate-pulse">
                    {currentStepLabel}...
                  </div>
                )}
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-white/[0.08] bg-background/75 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-end gap-3 rounded-[24px] border border-white/[0.08] bg-surface/55 p-3 shadow-[0_20px_50px_-36px_rgba(0,0,0,0.75)]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte algo ao agente..."
              rows={1}
              className="max-h-44 min-h-[3rem] flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-200 hover:scale-[1.02] hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Enviar mensagem"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="absolute right-4 top-4 z-50">
          <ExecutionHUD />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="hidden xl:block" />
        <div className="xl:block">
          <IntelligenceSidebar />
        </div>
      </div>
    </div>
  );
}
