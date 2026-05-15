import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState, useMemo } from 'react';
import { 
  Trash2, CheckSquare, Archive, Loader2, Sparkles, 
  Calendar, FolderKanban, MessageSquare, Link as LinkIcon,
  Search, ChevronRight, Clock, Target, BrainCircuit, Rocket
} from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';

/* ─── Types ─── */
interface UnifiedItem {
  id: string;
  type: 'task' | 'meeting' | 'project' | 'link' | 'note' | 'idea';
  title: string;
  status: string;
  createdAt: string;
  metadata?: any;
  raw?: any;
}

const typeConfig: Record<string, { label: string; icon: any; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  task: { label: 'Tarefa', icon: CheckSquare, variant: 'success' },
  meeting: { label: 'Reunião', icon: Calendar, variant: 'info' },
  project: { label: 'Projeto', icon: FolderKanban, variant: 'warning' },
  link: { label: 'Link', icon: LinkIcon, variant: 'default' },
  note: { label: 'Nota', icon: MessageSquare, variant: 'default' },
  idea: { label: 'Ideia', icon: Sparkles, variant: 'default' },
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function InboxPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [captureText, setCaptureText] = useState('');
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);

  /* Queries */
  const { data: captures = [] } = useQuery({ queryKey: ['captures'], queryFn: () => apiFetch('/api/captures').then(ensureArray) });
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: () => apiFetch('/api/tasks').then(ensureArray) });
  const { data: meetings = [] } = useQuery({ queryKey: ['meetings'], queryFn: () => apiFetch('/api/meetings').then(ensureArray) });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => apiFetch('/api/projects').then(ensureArray) });

  /* Aggregation */
  const unifiedItems = useMemo(() => {
    const items: UnifiedItem[] = [];

    captures.forEach((c: any) => {
      if (c.status === 'processed' && (c.type === 'task' || c.type === 'meeting' || c.type === 'project')) return;
      items.push({
        id: c.id || c._id,
        type: c.type || 'note',
        title: c.content,
        status: c.status,
        createdAt: c.createdAt || c.created_at,
        raw: { ...c, _source: 'capture' }
      });
    });

    tasks.forEach((t: any) => {
      if (t.status === 'done' && filter !== 'all') return;
      items.push({
        id: t.id || t._id,
        type: 'task',
        title: t.title,
        status: t.status,
        createdAt: t.createdAt || t.created_at,
        raw: { ...t, _source: 'task' }
      });
    });

    meetings.forEach((m: any) => {
      items.push({
        id: m.id || m._id,
        type: 'meeting',
        title: m.title,
        status: m.status,
        createdAt: m.createdAt || m.created_at || m.meeting_date,
        raw: { ...m, _source: 'meeting' }
      });
    });

    projects.forEach((p: any) => {
      items.push({
        id: p.id || p._id,
        type: 'project',
        title: p.name,
        status: p.status,
        createdAt: p.createdAt || p.created_at,
        raw: { ...p, _source: 'project' }
      });
    });

    return items
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter(item => {
        const matchesFilter = filter === 'all' || item.type === filter;
        return matchesFilter;
      });
  }, [captures, tasks, meetings, projects, filter]);

  /* Mutations */
  const deleteCapture = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/captures/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['captures'] }); toast('Signal deletado', 'success'); },
  });

  const archiveCapture = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/captures/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'processed' }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['captures'] }); toast('Signal arquivado', 'success'); },
  });

  const processAI = useMutation({
    mutationFn: () => apiFetch('/api/captures/bulk', { method: 'POST', body: JSON.stringify({ action: 'extract' }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['captures'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['meetings'] });
      toast('Processamento de IA concluído', 'success');
    },
  });

  const evolveCapture = useMutation({
    mutationFn: async ({ id, evolution }: { id: string, evolution: string }) => {
      const text = evolution.toLowerCase();
      let targetType = 'note';
      if (text.includes('tarefa') || text.includes('task')) targetType = 'task';
      else if (text.includes('projeto')) targetType = 'project';
      else if (text.includes('reunião') || text.includes('agenda')) targetType = 'meeting';
      else if (text.includes('ferramenta') || text.includes('tool')) targetType = 'tool';
      else targetType = 'note';

      return apiFetch(`/api/captures/${id}`, { 
        method: 'PATCH', 
        body: JSON.stringify({ type: targetType, status: 'processed' }) 
      });
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['captures'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast(`Sinal evoluído: ${variables.evolution}`, 'success');
    },
  });

  const smartCapture = useMutation({
    mutationFn: (text: string) => apiFetch('/api/captures/smart', { method: 'POST', body: JSON.stringify({ content: text }) }),
    onMutate: async (newContent) => {
      await qc.cancelQueries({ queryKey: ['captures'] });
      const previous = qc.getQueryData(['captures']);
      qc.setQueryData(['captures'], (old: any) => {
        const optimisticItem = { id: `opt-${Date.now()}`, content: newContent, type: 'note', status: 'processing', createdAt: new Date().toISOString() };
        return [optimisticItem, ...(old || [])];
      });
      return { previous };
    },
    onError: (err, newContent, context) => {
      qc.setQueryData(['captures'], context?.previous);
      toast('Falha ao salvar sinal', 'error');
    },
    onSuccess: (data) => {
      // O item é salvo inicialmente. O processamento assíncrono continua no backend.
      // O backend vai atualizar o item real. Para refletir sem lag, não invalidamos a query imediatamente.
      // O web socket do app atualizaria os dados. Na ausência dele, deixamos a invalidate rodar normal para puxar.
      qc.invalidateQueries({ queryKey: ['captures'] });
    }
  });

  const saveCapture = () => {
    if (!captureText.trim() || smartCapture.isPending) return;
    setIsProcessingLocal(true);
    smartCapture.mutate(captureText.trim());
    setCaptureText('');
    setTimeout(() => setIsProcessingLocal(false), 800); // Simulando pequeno feedback de UI
  };

  const getPendingSignals = () => captures.filter((c: any) => c.status !== 'processed').length;

  return (
    <div className="w-full animate-in fade-in duration-700">
      <PageHeader 
        title="Triagem Cognitiva" 
        subtitle={`${unifiedItems.length} Entradas Unificadas · ${getPendingSignals()} Sinais Pendentes`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {['all', 'task', 'meeting', 'project', 'link', 'note'].map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter(f)}
                  style={{ fontSize: '10px', textTransform: 'uppercase', borderRadius: 'var(--radius-full)' }}
                >
                  {f === 'all' ? 'Ver Tudo' : typeConfig[f]?.label || f}
                </Button>
              ))}
            </div>

            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)' }} />

            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)',
              color: '#10b981', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.05em'
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 6px #10b981' }} />
              IA ATIVA
            </div>
            {getPendingSignals() > 0 && (
              <Button 
                variant="ghost" size="sm"
                onClick={() => processAI.mutate()}
                disabled={processAI.isPending}
                style={{ fontSize: '11px', padding: '4px 10px' }}
              >
                {processAI.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              </Button>
            )}
          </div>
        }
      />

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', marginTop: 'var(--space-6)', paddingBottom: '160px' }}>


        {/* Main Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

          <div className="animate-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {unifiedItems.length === 0 ? (
              <EmptyState 
                icon={<Archive size={40} />}
                title="Inbox Vazio"
                description="Tudo limpo por aqui. Capture novos sinais ou tarefas para começar."
              />
            ) : (
              unifiedItems.map((item) => (
                <InboxItemRow 
                  key={`${item.type}-${item.id}`} 
                  item={item} 
                  onArchive={() => archiveCapture.mutate(item.id)}
                  onDelete={() => deleteCapture.mutate(item.id)}
                  onEvolve={(evolution) => evolveCapture.mutate({ id: item.id, evolution })}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Smart Capture Bottom Bar */}
      <div style={{ 
        position: 'fixed', bottom: 0, left: 'var(--sidebar-width, 240px)', right: 0, 
        padding: 'var(--space-8) var(--space-8) var(--space-8)', 
        background: 'linear-gradient(to top, var(--color-bg-primary) 80%, transparent)',
        pointerEvents: 'none', zIndex: 10 
      }}>
        <div style={{ width: '100%', position: 'relative', pointerEvents: 'auto' }}>
          {isProcessingLocal && (
            <div style={{ 
              position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px',
              backgroundColor: 'var(--color-accent)', color: '#fff', borderRadius: 'var(--radius-full)',
              fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.1em',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <BrainCircuit size={14} className="animate-pulse" /> IA ANALISANDO O SINAL...
            </div>
          )}
          <div style={{ 
            backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
            borderRadius: '2rem', padding: 'var(--space-4)', 
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset', 
            display: 'flex', flexDirection: 'column',
            transition: 'all 0.3s', opacity: isProcessingLocal ? 0.7 : 1,
            filter: isProcessingLocal ? 'blur(1px)' : 'none'
          }}>
            <textarea 
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveCapture(); } }}
              placeholder="Digite uma tarefa, nota ou ideia... a IA classificará automaticamente."
              style={{
                width: '100%', background: 'transparent', border: 'none', padding: 'var(--space-4)',
                color: 'var(--color-text-primary)', fontSize: 'var(--text-md)', outline: 'none',
                resize: 'none', minHeight: '60px', maxHeight: '200px'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 var(--space-4) var(--space-2)' }}>
              <Button 
                variant="primary" 
                onClick={saveCapture} 
                disabled={isProcessingLocal || !captureText.trim()}
                style={{ borderRadius: 'var(--radius-full)', paddingLeft: 'var(--space-6)', paddingRight: 'var(--space-6)' }}
              >
                {isProcessingLocal ? <Loader2 size={16} className="animate-spin mr-2" /> : <Sparkles size={16} className="mr-2" />}
                CAPTURAR
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Badge color map for v3 palette */
const inboxBadgeStyle: Record<string, React.CSSProperties> = {
  idea:    { backgroundColor: 'rgba(234, 179, 8, 0.15)',  color: '#facc15' },
  meeting: { backgroundColor: 'rgba(20, 184, 166, 0.15)', color: '#2dd4bf' },
  note:    { backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' },
  task:    { backgroundColor: 'rgba(34, 197, 94, 0.15)',  color: '#4ade80' },
  link:    { backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' },
  project: { backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#fb923c' },
};

function InboxItemRow({ item, onArchive, onDelete, onEvolve }: { item: UnifiedItem; onArchive: () => void; onDelete: () => void; onEvolve?: (evolution: string) => void }) {
  const config = typeConfig[item.type] || typeConfig.note;
  const Icon = config.icon;
  const badgeStyle = inboxBadgeStyle[item.type] || inboxBadgeStyle.note;

  return (
    <Card padding="md" border shadow="none" animate={false} className="group inbox-item-row" style={{ borderRadius: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {/* Icon badge */}
        <div style={{ 
          width: '36px', 
          height: '36px', 
          borderRadius: 'var(--radius-md)', 
          backgroundColor: badgeStyle.backgroundColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: badgeStyle.color,
          flexShrink: 0,
        }}>
          <Icon size={16} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {/* Badge row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{
              ...badgeStyle,
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              padding: '1px 7px',
              borderRadius: 'var(--radius-full)',
            }}>
              {config.label}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', marginLeft: '4px' }}>
              {new Date(item.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} ({timeAgo(item.createdAt)})
            </span>
          </div>

          {/* Title */}
          <p style={{ 
            fontSize: 'var(--text-sm)', 
            fontWeight: 'var(--font-normal)', 
            color: 'var(--color-text-primary)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: '2px',
          }}>
            {item.title}
          </p>

          {/* Meta & Insights */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {item.type === 'meeting' && item.raw?.meeting_date && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                  <Clock size={11} />
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {new Date(item.raw.meeting_date).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {item.type === 'task' && item.raw?.due_date && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                  <Target size={11} />
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {new Date(item.raw.due_date).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
            </div>

            {/* AI Insight and Evolution */}
            {item.raw?.metadata?.summary && (
              <div style={{ 
                backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', marginTop: 'var(--space-2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                  <div style={{ color: 'var(--color-accent)', marginTop: '2px' }}><Sparkles size={12} /></div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0, fontStyle: 'italic', fontWeight: 500 }}>
                    "{item.raw.metadata.summary}"
                  </p>
                </div>
                
                {item.raw?.metadata?.evolution && Array.isArray(item.raw.metadata.evolution) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-3)', paddingLeft: '22px' }}>
                    {item.raw.metadata.evolution.map((ev: string, idx: number) => (
                      <button 
                        key={idx}
                        onClick={() => onEvolve && onEvolve(ev)}
                        className="btn-evolution hover:bg-white/10"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em',
                          padding: '8px 16px', borderRadius: 'var(--radius-full)', 
                          backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--color-text-secondary)',
                          border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        <Rocket size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                        {ev}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Processing Indicator */}
        {item.status === 'processing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-accent)' }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Processando...</span>
          </div>
        )}

        <div
          className="inbox-actions"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', opacity: item.status === 'processing' ? 0 : 1, transition: 'opacity var(--t-fast)' }}
        >
          {item.raw?._source === 'capture' || item.type === 'note' || item.type === 'idea' || item.type === 'link' ? (
            <>
              {onEvolve && (
                <>
                  {item.type !== 'task' && (
                    <Button variant="ghost" size="sm" onClick={() => onEvolve('tarefa')} title="Converter em Tarefa" style={{ color: 'var(--color-text-tertiary)' }} className="hover:text-primary">
                      <CheckSquare size={15} />
                    </Button>
                  )}
                  {item.type !== 'project' && (
                    <Button variant="ghost" size="sm" onClick={() => onEvolve('projeto')} title="Converter em Projeto" style={{ color: 'var(--color-text-tertiary)' }} className="hover:text-warning">
                      <FolderKanban size={15} />
                    </Button>
                  )}
                  {item.type !== 'meeting' && (
                    <Button variant="ghost" size="sm" onClick={() => onEvolve('reunião')} title="Converter em Reunião" style={{ color: 'var(--color-text-tertiary)' }} className="hover:text-teal">
                      <Calendar size={15} />
                    </Button>
                  )}
                  <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--color-border)', margin: '0 4px' }} />
                </>
              )}
              <Button variant="ghost" size="sm" onClick={onArchive} title="Arquivar">
                <Archive size={15} />
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete} style={{ color: 'var(--color-error)' }} title="Deletar">
                <Trash2 size={15} />
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" title="Abrir" onClick={() => window.location.href = `/${item.type}s`}>
              <ChevronRight size={15} />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}


