import { useQuery } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { ListTodo, AlertTriangle, Video, Inbox, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/stores/toastStore';
import { DashboardSkeleton } from '@/components/PageSkeletons';

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: number; sub: string; color: string }) {
  return (
    <div className="glass-card p-6 flex flex-col justify-between h-32 group">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm font-medium text-white/50 group-hover:text-white/70 transition-colors uppercase tracking-wider text-[10px]">{label}</span>
      </div>
      <div>
        <p className="text-3xl font-black text-white tracking-tight">{value}</p>
        <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">{sub}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: tasks, isLoading: loadingTasks } = useQuery({ queryKey: ['tasks'], queryFn: () => apiFetch('/api/tasks').then(ensureArray) });
  const { data: captures, isLoading: loadingCaptures } = useQuery({ queryKey: ['captures'], queryFn: () => apiFetch('/api/captures').then(ensureArray) });
  const { data: meetings, isLoading: loadingMeetings } = useQuery({ queryKey: ['meetings'], queryFn: () => apiFetch('/api/meetings').catch(() => []).then(ensureArray) });

  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const pendingTasks = tasks?.filter((t: any) => t.status !== 'done') || [];
  const highPriority = tasks?.filter((t: any) => t.priority === 'high' && t.status !== 'done') || [];
  const unprocessed = captures?.filter((c: any) => c.status !== 'processed') || [];

  if (loadingTasks || loadingCaptures || loadingMeetings) {
    return <DashboardSkeleton />;
  }

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatMessages((p) => [...p, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const res = await apiFetch<any>('/api/agent', {
        method: 'POST',
        body: JSON.stringify({ message: msg, conversation: 'pwa-user' }),
      });
      setChatMessages((p) => [...p, { role: 'assistant', content: res.reply || res.reply || res.response || res.message || JSON.stringify(res) }]);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-700 max-w-[1400px] mx-auto">
      <header className="px-4">
        <h2 className="text-4xl font-black text-white tracking-tighter mb-2">Command Center</h2>
        <p className="text-white/30 text-[13px] font-medium tracking-wide uppercase">Unified Intelligence & Operations Pipeline</p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
        <StatCard icon={ListTodo} label="Tasks" value={pendingTasks.length} sub="pending execution" color="bg-primary/10 text-primary border border-primary/20" />
        <StatCard icon={AlertTriangle} label="Critical" value={highPriority.length} sub="waiting action" color="bg-rose-500/10 text-rose-500 border border-rose-500/20" />
        <StatCard icon={Video} label="Meetings" value={meetings?.length || 0} sub="recorded intelligence" color="bg-accent/10 text-accent border border-accent/20" />
        <StatCard icon={Inbox} label="Captures" value={unprocessed.length} sub="unprocessed fragments" color="bg-white/10 text-white/60 border border-white/20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4">
        {/* Today's tasks */}
        <div className="glass-card p-8">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-6 font-mono">Operations Pipeline</h3>
          <div className="space-y-4">
            {pendingTasks.slice(0, 5).map((t: any) => (
              <div key={t._id || t.id} className="flex items-center gap-4 p-4 bg-white/[0.03] rounded-2xl border border-white/5 hover:bg-white/5 transition-premium group">
                <div className="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center text-[9px] font-black text-white/30 group-hover:border-primary/40 group-hover:text-primary transition-premium">
                  {t.priority === 'high' ? '!' : '#'}
                </div>
                <span className="text-[13px] text-white/70 flex-1 truncate font-medium">{t.title}</span>
              </div>
            ))}
            {pendingTasks.length === 0 && <p className="text-sm text-white/20 italic text-center py-4">No pending operations.</p>}
          </div>
        </div>

        {/* Quick chat */}
        <div className="glass-card p-8 bg-gradient-to-br from-primary/5 to-transparent flex flex-col">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-6 font-mono">Cognitive Prompt</h3>
          <div className="flex-1 space-y-4 max-h-[280px] overflow-y-auto mb-6 pr-4 scrollbar-hide">
            {chatMessages.length === 0 && (
               <p className="text-white/20 text-xs italic p-4 border border-dashed border-white/5 rounded-2xl">Initialize cognitive link or vocal command...</p>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed transition-premium shadow-lg ${
                  m.role === 'user' 
                    ? 'bg-primary text-white font-bold rounded-tr-sm shadow-primary/20' 
                    : 'bg-white/5 text-white/90 border border-white/5 rounded-tl-sm shadow-black/40'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-center gap-3 text-[10px] text-primary uppercase font-black tracking-widest animate-pulse px-2">
                 <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                 <span>Analyzing Intent...</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 p-2 bg-black/40 rounded-2xl border border-white/10 focus-within:border-primary/40 transition-premium">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
              placeholder="Send command..."
              className="flex-1 px-4 py-3 bg-transparent text-[13px] text-white placeholder:text-white/20 focus:outline-none"
            />
            <button
              onClick={sendChat}
              disabled={chatLoading || !chatInput.trim()}
              className="w-12 h-12 flex items-center justify-center rounded-xl bg-white text-black hover:bg-primary hover:text-white disabled:opacity-20 transition-premium shadow-xl interactive-scale"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
