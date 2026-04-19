import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { Send, Terminal, Eye, EyeOff, Bot, User2, Sparkles, CornerDownLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAgentStore } from '@/stores/agentStore';
import { ExecutionHUD } from '@/components/agent/ExecutionHUD';
import { IntelligenceSidebar } from '@/components/agent/IntelligenceSidebar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Stack } from '@/components/ui/Layout';
import { Caption, Label } from '@/components/ui/Typography';

interface Message {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  trace?: any;
  suggestions?: any[];
  memorable?: boolean;
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

  const handleSuggestion = async (s: any) => {
    try {
      if (s.action === 'create_task') {
        await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(s.data) });
        toast(`Task criada: ${s.data.title}`, 'success');
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } else if (s.action === 'store_memory') {
        await apiFetch('/api/memory', { method: 'POST', body: JSON.stringify({ type: 'note', content: s.data.content }) });
        toast('Salvo na memória!', 'success');
        queryClient.invalidateQueries({ queryKey: ['memory'] });
      }
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

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
          options: { requestId, includeSuggestions: true },
        }),
      });

      const assistantMsg: Message = {
        role: 'assistant',
        content: res.reply || res.message || JSON.stringify(res),
        suggestions: res.suggestions || [],
        memorable: res.memorable || false,
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
  const safeMessages = Array.isArray(messages) ? messages : [];
  const currentStepLabel = currentTrace?.steps?.[currentTrace.steps.length - 1]?.type?.split('.')?.pop();

  return (
    <Stack className="h-full min-h-0 gap-4 p-4 md:p-6 lg:p-8 animate-in fade-in duration-700">
      {/* Header Bar */}
      <div className="flex items-start justify-between gap-4 glass-panel px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm shadow-primary/10">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Chat com o agente</p>
            <Caption as="p">Respostas rápidas, histórico persistente e leitura clara.</Caption>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="glass" size="sm" onClick={toggleDebug} className="rounded-xl">
            {uiMode === 'debug' ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {uiMode === 'debug' ? 'Debug ligado' : 'Debug'}
          </Button>
          <div className="hidden items-center gap-2 sm:flex">
            <Caption className="flex items-center gap-1.5">
              <CornerDownLeft className="h-3.5 w-3.5" />
              Enter para enviar
            </Caption>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-surface/30 shadow-[0_24px_70px_-32px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-5 scroll-smooth sm:px-6">
          <div className="space-y-5 pb-6">
            {isEmpty && (
              <EmptyState
                className="mx-auto max-w-xl py-16"
                icon={Bot}
                title="Comece a conversa"
                description="Envie uma pergunta, pedido de ação ou contexto. O histórico aparece aqui com separação clara entre você e o agente."
              />
            )}

            {safeMessages.map((m, i) => (
              <div
                key={`${m.timestamp || 'msg'}-${i}`}
                className={`group flex items-end gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
                style={{ animationDelay: `${Math.min(i * 30, 150)}ms` }}
              >
                {m.role === 'assistant' && (
                  <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary sm:flex">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[min(46rem,78%)] rounded-[22px] border px-4 py-3 shadow-sm transition-all duration-300 ${
                    m.role === 'user'
                      ? 'rounded-br-md border-primary/15 bg-gradient-to-br from-primary/15 to-white/[0.03] text-foreground hover:border-primary/25 hover:shadow-md hover:shadow-primary/5'
                      : 'rounded-bl-md border-white/[0.08] bg-surface/70 text-foreground hover:border-white/[0.12] hover:bg-surface/80'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full transition-all duration-500 ${
                          m.role === 'user' ? 'bg-primary/15 text-primary' : (m.memorable ? 'bg-accent/20 text-accent shadow-[0_0_12px_rgba(168,85,247,0.4)] animate-pulse' : 'bg-white/[0.05] text-muted-foreground')
                        }`}
                      >
                        {m.role === 'user' ? <User2 className="h-3 w-3" /> : (m.memorable ? <Brain className="h-3 w-3" /> : <Bot className="h-3 w-3" />)}
                      </span>
                      <Label className={m.role === 'user' ? 'text-primary' : (m.memorable ? 'text-accent font-black animate-in fade-in' : 'text-muted-foreground')}>
                        {m.role === 'user' ? 'Você' : (m.memorable ? 'Aprendizado Ativo' : 'Agente')}
                      </Label>
                    </div>
                    <Caption>{formatTime(m.timestamp)}</Caption>
                  </div>

                  {m.role === 'assistant' ? (
                    <div className="prose prose-sm prose-invert max-w-none prose-p:my-2 prose-headings:mb-2 prose-headings:mt-4 prose-strong:text-foreground prose-a:text-primary">
                      <ReactMarkdown>{m.content || ''}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/95">{m.content || ''}</p>
                  )}

                  {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 animate-in slide-in-from-left-2 duration-300">
                      {m.suggestions.map((s, si) => (
                        <button 
                          key={si}
                          onClick={() => handleSuggestion(s)}
                          className="flex h-8 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 text-[9px] font-black uppercase tracking-wider text-primary-foreground hover:bg-primary hover:text-white transition-all active:scale-95"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {m.role === 'assistant' && (m.trace || (loading && i === safeMessages.length - 1)) && (
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => inspectTrace(m)}
                      className="mt-3 h-auto px-0 py-0 text-[10px] font-semibold uppercase tracking-wider text-primary hover:text-accent"
                    >
                      <Terminal className="h-3.5 w-3.5" />
                      Explore trace
                    </Button>
                  )}
                </div>

                {m.role === 'user' && (
                  <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] sm:flex">
                    <Label className="text-muted-foreground">U</Label>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-end gap-3 animate-in fade-in duration-300">
                <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary sm:flex">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-[22px] border border-white/[0.08] bg-surface/70 px-2 py-1.5">
                  <TypingIndicator />
                </div>
                {uiMode === 'debug' && currentTrace && currentStepLabel && (
                  <Caption className="px-2 text-primary animate-pulse">
                    {currentStepLabel}...
                  </Caption>
                )}
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="sticky bottom-0 border-t border-white/[0.08] glass-panel rounded-none px-4 py-4 sm:px-6">
          <div className="flex items-end gap-3 rounded-[24px] border border-white/[0.08] bg-surface/55 p-3 shadow-[0_20px_50px_-36px_rgba(0,0,0,0.75)] transition-all duration-300 focus-within:border-primary/20 focus-within:shadow-[0_20px_50px_-36px_rgba(168,85,247,0.2)]">
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

      {/* Intelligence Sidebar */}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="hidden xl:block" />
        <div className="xl:block">
          <IntelligenceSidebar />
        </div>
      </div>
    </Stack>
  );
}
