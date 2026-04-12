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
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h2 className="text-3xl font-black text-white tracking-tighter mb-1">Command Center</h2>
        <p className="text-white/40 text-sm">Visão geral unificada de operações e inteligência.</p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ListTodo} label="Tarefas" value={pendingTasks.length} sub="pendentes" color="bg-accent/10 text-accent border border-accent/20" />
        <StatCard icon={AlertTriangle} label="Prioridades" value={highPriority.length} sub="em aberto" color="bg-destructive/10 text-destructive border border-destructive/20" />
        <StatCard icon={Video} label="Reuniões" value={meetings?.length || 0} sub="recentes" color="bg-primary/10 text-primary border border-primary/20" />
        <StatCard icon={Inbox} label="Inbox" value={unprocessed.length} sub="capturas" color="bg-warn/10 text-warn border border-warn/20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's tasks */}
        <div className="glass-card p-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4">Agenda do Dia</h3>
          <div className="space-y-3">
            {pendingTasks.slice(0, 5).map((t: any) => (
              <div key={t._id || t.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                <div className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center text-[8px] font-bold text-white/50">
                  {t.priority === 'high' ? '!' : ''}
                </div>
                <span className="text-xs text-white/80 flex-1 truncate">{t.title}</span>
              </div>
            ))}
            {pendingTasks.length === 0 && <p className="text-sm text-white/20 italic text-center py-4">Nenhuma tarefa pendente</p>}
          </div>
        </div>

        {/* Priorities */}
        <div className="glass-card p-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4">Urgent Matters</h3>
          <div className="space-y-3">
            {highPriority.slice(0, 5).map((t: any) => (
              <div key={t._id || t.id} className="flex items-center gap-3 p-3 bg-rose-500/5 rounded-xl border border-rose-500/10 hover:bg-rose-500/10 transition-colors">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-xs text-white/80 font-medium flex-1 truncate">{t.title}</span>
              </div>
            ))}
            {highPriority.length === 0 && <p className="text-sm text-white/20 italic text-center py-4">Tudo sob controle</p>}
          </div>
        </div>

        {/* Inbox preview */}
        <div className="glass-card p-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4">Brain Dump Inbox</h3>
          <div className="space-y-3">
            {unprocessed.slice(0, 3).map((c: any) => (
              <div key={c._id || c.id} className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-white/60 truncate italic leading-relaxed">
                "{c.content}"
              </div>
            ))}
            {unprocessed.length === 0 && <p className="text-sm text-white/20 italic text-center py-4">Inbox vazio</p>}
          </div>
        </div>

        {/* Meetings */}
        <div className="glass-card p-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4">Recent Meetings</h3>
          <div className="space-y-3">
            {(meetings || []).slice(0, 3).map((m: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/5 hover:bg-primary/10 transition-colors">
                 <Video className="w-3 h-3 text-primary/60" />
                 <span className="text-xs text-white/80 truncate">{m.title || m.summary || 'Reunião'}</span>
              </div>
            ))}
            {(!meetings || meetings.length === 0) && <p className="text-sm text-white/20 italic text-center py-4">Sem reuniões recentes</p>}
          </div>
        </div>
      </div>

      {/* Quick chat */}
      <div className="glass-card p-6 bg-gradient-to-br from-white/5 to-transparent">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-4">Vocal Assistant Prompt</h3>
        <div className="space-y-4 max-h-64 overflow-y-auto mb-6 pr-4 scrollbar-hide">
          {chatMessages.length === 0 && (
             <p className="text-white/20 text-xs italic">Inicie um comando vocal ou textual para o AndClaw...</p>
          )}
          {chatMessages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                m.role === 'user' 
                  ? 'bg-primary text-white font-medium rounded-tr-none' 
                  : 'bg-white/5 text-white/90 border border-white/5 rounded-tl-none'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex items-center gap-2 text-[10px] text-accent animate-pulse">
               <div className="w-1.5 h-1.5 rounded-full bg-accent" />
               <span>Agente processando intenção...</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 p-1.5 bg-black/20 rounded-2xl border border-white/5">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
            placeholder="Digite seu comando..."
            className="flex-1 px-4 py-2 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none"
          />
          <button
            onClick={sendChat}
            disabled={chatLoading || !chatInput.trim()}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-black hover:bg-white/90 disabled:opacity-20 transition-all shadow-lg"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
