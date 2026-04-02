import { useQuery } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { ListTodo, AlertTriangle, Video, Inbox, Send, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/stores/toastStore';

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: number; sub: string; color: string }) {
  return (
    <div className="p-5 rounded-xl bg-surface glow-border">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

export default function Dashboard() {
  const { data: tasks } = useQuery({ queryKey: ['tasks'], queryFn: () => apiFetch('/api/tasks').then(ensureArray) });
  const { data: captures } = useQuery({ queryKey: ['captures'], queryFn: () => apiFetch('/api/captures').then(ensureArray) });
  const { data: meetings } = useQuery({ queryKey: ['meetings'], queryFn: () => apiFetch('/api/meetings').catch(() => []).then(ensureArray) });

  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const pendingTasks = tasks?.filter((t: any) => t.status !== 'done') || [];
  const highPriority = tasks?.filter((t: any) => t.priority === 'high' && t.status !== 'done') || [];
  const unprocessed = captures?.filter((c: any) => c.status !== 'processed') || [];

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
      setChatMessages((p) => [...p, { role: 'assistant', content: res.reply || res.response || res.message || JSON.stringify(res) }]);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ListTodo} label="Tarefas" value={pendingTasks.length} sub="pendentes" color="bg-accent/15 text-accent" />
        <StatCard icon={AlertTriangle} label="Prioridades" value={highPriority.length} sub="em aberto" color="bg-destructive/15 text-destructive" />
        <StatCard icon={Video} label="Reuniões" value={meetings?.length || 0} sub="recentes" color="bg-primary/15 text-primary" />
        <StatCard icon={Inbox} label="Inbox" value={unprocessed.length} sub="não processados" color="bg-warn/15 text-warn" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's tasks */}
        <div className="rounded-xl bg-surface glow-border p-5">
          <h3 className="text-sm font-semibold mb-3">Hoje</h3>
          <div className="space-y-2">
            {pendingTasks.slice(0, 5).map((t: any) => (
              <div key={t._id || t.id} className="flex items-center gap-3 py-1.5">
                <div className="w-4 h-4 rounded-full border border-white/20" />
                <span className="text-sm flex-1 truncate">{t.title}</span>
              </div>
            ))}
            {pendingTasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa pendente</p>}
          </div>
        </div>

        {/* Priorities */}
        <div className="rounded-xl bg-surface glow-border p-5">
          <h3 className="text-sm font-semibold mb-3">Prioridades</h3>
          <div className="space-y-2">
            {highPriority.slice(0, 5).map((t: any) => (
              <div key={t._id || t.id} className="flex items-center gap-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                <span className="text-sm flex-1 truncate">{t.title}</span>
              </div>
            ))}
            {highPriority.length === 0 && <p className="text-sm text-muted-foreground">Tudo tranquilo</p>}
          </div>
        </div>

        {/* Inbox preview */}
        <div className="rounded-xl bg-surface glow-border p-5">
          <h3 className="text-sm font-semibold mb-3">Inbox</h3>
          <p className="text-sm text-muted-foreground">{unprocessed.length} não processados</p>
          <div className="space-y-2 mt-2">
            {unprocessed.slice(0, 3).map((c: any) => (
              <div key={c._id || c.id} className="text-sm truncate text-muted-foreground">{c.content}</div>
            ))}
          </div>
        </div>

        {/* Meetings */}
        <div className="rounded-xl bg-surface glow-border p-5">
          <h3 className="text-sm font-semibold mb-3">Reuniões</h3>
          <div className="space-y-2">
            {(meetings || []).slice(0, 3).map((m: any, i: number) => (
              <div key={i} className="text-sm text-muted-foreground truncate">{m.title || m.summary || 'Reunião'}</div>
            ))}
            {(!meetings || meetings.length === 0) && <p className="text-sm text-muted-foreground">Nenhuma reunião recente</p>}
          </div>
        </div>
      </div>

      {/* Quick chat */}
      <div className="rounded-xl bg-surface glow-border p-5">
        <h3 className="text-sm font-semibold mb-3">Chat com o Agente</h3>
        <div className="space-y-3 max-h-48 overflow-y-auto mb-3">
          {chatMessages.map((m, i) => (
            <div key={i} className={`text-sm ${m.role === 'user' ? 'text-foreground' : 'text-accent'}`}>
              <span className="font-medium">{m.role === 'user' ? 'Você' : 'Agente'}:</span>{' '}
              {m.content}
            </div>
          ))}
          {chatLoading && <div className="text-sm text-muted-foreground">Agente está pensando...</div>}
        </div>
        <div className="flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
            placeholder="Pergunte algo..."
            className="flex-1 px-4 py-2.5 rounded-md bg-surface-2 border border-white/[0.07] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={sendChat}
            disabled={chatLoading || !chatInput.trim()}
            className="px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
