import { useQuery } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { ListTodo, AlertTriangle, Video, Inbox, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/stores/toastStore';
import { DashboardSkeleton } from '@/components/PageSkeletons';
import { DailyBriefing } from '@/components/dashboard/DailyBriefing';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/card';

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: number; sub: string; color: string }) {
  return (
    <Card shadow="sm" className="p-6 flex flex-col justify-between h-32 group">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors uppercase tracking-wider">{label}</span>
      </div>
      <div>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-text-tertiary uppercase font-bold tracking-widest">{sub}</p>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { data: tasks, isLoading: loadingTasks } = useQuery({ queryKey: ['tasks'], queryFn: () => apiFetch('/api/tasks').then(ensureArray) });
  const { data: captures, isLoading: loadingCaptures } = useQuery({ queryKey: ['captures'], queryFn: () => apiFetch('/api/captures').then(ensureArray) });
  const { data: meetings, isLoading: loadingMeetings } = useQuery({ queryKey: ['meetings'], queryFn: () => apiFetch('/api/meetings').catch(() => []).then(ensureArray) });

  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string; suggestions?: any[] }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const pendingTasks = tasks?.filter((t: any) => t.status !== 'done') || [];
  const highPriority = tasks?.filter((t: any) => t.priority === 'high' && t.status !== 'done') || [];
  const unprocessed = captures?.filter((c: any) => c.status !== 'processed') || [];

  const handleSuggestion = async (s: any) => {
    try {
      if (s.action === 'create_task') {
        await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(s.data) });
        toast(`Task criada: ${s.data.title}`, 'success');
      } else if (s.action === 'store_memory') {
        await apiFetch('/api/memory', { method: 'POST', body: JSON.stringify({ type: 'note', content: s.data.content }) });
        toast('Salvo na memória!', 'success');
      }
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatMessages((p) => [...p, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const res = await apiFetch<any>('/api/agent', {
        method: 'POST',
        body: JSON.stringify({ message: msg, options: { includeSuggestions: true } }),
      });
      setChatMessages((p) => [...p, { 
        role: 'assistant', 
        content: res.reply || res.message || JSON.stringify(res),
        suggestions: res.suggestions || []
      }]);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setChatLoading(false);
    }
  };

  if (loadingTasks || loadingCaptures || loadingMeetings) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-700 max-w-[1400px] mx-auto">
      <PageHeader 
        title="AndClaw" 
        subtitle={new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} 
        titleClassName="font-mono text-sm"
      />

      <div className="px-0 sm:px-4">
        <DailyBriefing />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-0 sm:px-4">
        <StatCard icon={ListTodo} label="Tasks" value={pendingTasks.length} sub="pending execution" color="bg-primary/10 text-primary border border-primary/20" />
        <StatCard icon={AlertTriangle} label="Critical" value={highPriority.length} sub="waiting action" color="bg-error/10 text-error border border-error/20" />
        <StatCard icon={Video} label="Meetings" value={meetings?.length || 0} sub="recorded intelligence" color="bg-accent/10 text-accent border border-accent/20" />
        <StatCard icon={Inbox} label="Captures" value={unprocessed.length} sub="unprocessed fragments" color="bg-surface/10 text-text-secondary border border-border" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-0 sm:px-4">
        {/* Today's tasks */}
        <Card shadow="sm" className="p-6 sm:p-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-6 font-mono">Operations Pipeline</h3>
          <div className="space-y-4">
            {pendingTasks.slice(0, 5).map((t: any) => (
              <div key={t._id || t.id} className="flex items-center gap-4 p-4 bg-bg-secondary rounded-2xl border border-border hover:bg-surface transition-colors group">
                <div className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-[9px] font-black text-text-tertiary group-hover:border-primary/40 group-hover:text-primary transition-colors">
                  {t.priority === 'high' ? '!' : '#'}
                </div>
                <span className="text-sm text-text-primary flex-1 truncate font-medium">{t.title}</span>
              </div>
            ))}
            {pendingTasks.length === 0 && <p className="text-sm text-text-tertiary italic text-center py-4">No pending operations.</p>}
          </div>
        </Card>

        {/* Quick chat */}
        <Card shadow="sm" className="p-6 sm:p-8 flex flex-col w-full">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-6 font-mono">Cognitive Prompt</h3>
          <div className="flex-1 space-y-4 max-h-[280px] overflow-y-auto mb-6 pr-4 scrollbar-hide">
            {chatMessages.length === 0 && (
               <p className="text-text-tertiary text-xs italic p-4 border border-dashed border-border rounded-2xl">Initialize cognitive link or vocal command...</p>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed transition-colors shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-accent text-text-inverse font-medium rounded-tr-sm' 
                    : 'bg-bg-tertiary text-text-primary border border-border rounded-tl-sm'
                }`}>
                  {m.content}
                </div>
                {m.suggestions && m.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 mb-1 animate-in slide-in-from-left-2 duration-300">
                    {m.suggestions.map((s, si) => (
                      <button 
                        key={si}
                        onClick={() => handleSuggestion(s)}
                        className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] text-primary font-bold uppercase tracking-wider hover:bg-primary hover:text-white transition-colors"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-center gap-3 text-[10px] text-primary uppercase font-bold tracking-widest animate-pulse px-2">
                 <div className="w-2 h-2 rounded-full bg-primary shadow-sm" />
                 <span>Analyzing Intent...</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 p-2 bg-bg-secondary rounded-2xl border border-border focus-within:border-primary/40 transition-colors">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
              placeholder="Send command..."
              className="flex-1 px-4 py-3 bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
            <button
              onClick={sendChat}
              disabled={chatLoading || !chatInput.trim()}
              className="w-12 h-12 flex items-center justify-center rounded-xl bg-primary text-text-inverse hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
