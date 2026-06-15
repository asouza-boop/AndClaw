import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState, useMemo } from 'react';
import {
  Trash2, Archive, Loader2, Sparkles,
  Calendar, FolderKanban, MessageSquare, Link as LinkIcon,
  ChevronRight, Target, BrainCircuit, Rocket, CheckSquare,
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
  task:    { label: 'Tarefa',     icon: CheckSquare,   variant: 'success' },
  meeting: { label: 'Reunião',   icon: Calendar,      variant: 'info'    },
  project: { label: 'Projeto',   icon: FolderKanban,  variant: 'warning' },
  link:    { label: 'Link',      icon: LinkIcon,       variant: 'default' },
  note:    { label: 'Nota',      icon: MessageSquare,  variant: 'default' },
  idea:    { label: 'Ideia',     icon: Sparkles,       variant: 'default' },
  tool:    { label: 'Ferramenta', icon: MessageSquare, variant: 'default' },
};

function getTypeConfig(type: string | undefined | null) {
  return typeConfig[type || 'note'] ?? typeConfig['note'];
}

function timeAgo(date: string) {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

/* ─── CaptureTriageCard ─── */
function CaptureTriageCard({ capture, onEvolve, onArchive, onDelete, isLoading }: {
  capture: any;
  onEvolve: (id: string, type: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}) {
  const [showEvolve, setShowEvolve] = useState(false);
  const id = String(capture.id || capture._id);
  const statusColor: Record<string, string> = {
    new:        'var(--color-text-muted)',
    processing: 'var(--color-warning)',
    in_progress:'var(--color-warning)',
  };

  return (
    <Card style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
            {capture.content || capture.title}
          </div>
          {capture.summary && (
            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem' }}>
              🤖 {capture.summary}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>{timeAgo(capture.created_at || capture.createdAt)}</span>
            <span style={{ fontSize: '0.7rem', color: statusColor[capture.status] || 'var(--color-text-muted)' }}>
              {capture.status === 'processing' ? '⏳ analisando...' : capture.type || 'nota'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
          <Button variant="ghost" size="sm" title="Arquivar" onClick={() => onArchive(id)} disabled={isLoading}>
            <Archive size={14} />
          </Button>
          <Button variant="ghost" size="sm" title="Deletar" onClick={() => onDelete(id)}
            disabled={isLoading} style={{ color: 'var(--color-error)' }}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* EVOLVE ACTIONS */}
      {!showEvolve ? (
        <Button variant="outline" size="sm" onClick={() => setShowEvolve(true)}
          style={{ alignSelf: 'flex-start', fontSize: '0.75rem' }}>
          <Target size={12} style={{ marginRight: 4 }} /> Evoluir para...
        </Button>
      ) : (
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {[
            { label: '✅ Tarefa',  type: 'task'    },
            { label: '📅 Reunião', type: 'meeting' },
            { label: '💡 Ideia',   type: 'idea'    },
            { label: '🔗 Link',    type: 'link'    },
            { label: '📝 Nota',    type: 'note'    },
          ].map(opt => (
            <Button key={opt.type} variant="outline" size="sm"
              onClick={() => { onEvolve(id, opt.type); setShowEvolve(false); }}
              disabled={isLoading}
              style={{ fontSize: '0.75rem' }}>
              {opt.label}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setShowEvolve(false)}
            style={{ fontSize: '0.75rem', opacity: 0.5 }}>
            cancelar
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ─── ContextCard ─── */
function ContextCard({ item }: { item: UnifiedItem }) {
  const routeMap: Record<string, string> = {
    task:    '/projetos',
    meeting: '/reunioes',
    project: '/projetos',
  };
  const Icon = getTypeConfig(item.type).icon;

  return (
    <Card style={{ padding: '0.75rem', display: 'flex',
      alignItems: 'center', gap: '0.75rem', opacity: 0.8 }}>
      <Icon size={16} style={{ flexShrink: 0, opacity: 0.5 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </div>
        <div style={{ fontSize: '0.7rem', opacity: 0.4 }}>
          {getTypeConfig(item.type).label} · {timeAgo(item.createdAt)}
        </div>
      </div>
      <Button variant="ghost" size="sm"
        onClick={() => window.location.href = routeMap[item.type] || '/inbox'}
        title="Abrir">
        <ChevronRight size={14} />
      </Button>
    </Card>
  );
}

/* ─── InboxPage ─── */
export default function InboxPage() {
  const qc = useQueryClient();
  const [captureText, setCaptureText] = useState('');

  /* Queries */
  const { data: captures = [] } = useQuery({ queryKey: ['captures'], queryFn: () => apiFetch('/api/captures').then(ensureArray) });
  const { data: tasks = [] }    = useQuery({ queryKey: ['tasks'],    queryFn: () => apiFetch('/api/tasks').then(ensureArray) });
  const { data: meetings = [] } = useQuery({ queryKey: ['meetings'], queryFn: () => apiFetch('/api/meetings').then(ensureArray) });

  /* Section A — Sinais para Triagem */
  const triageItems = useMemo(() =>
    captures
      .filter((c: any) =>
        c != null &&
        c.status !== 'processed' &&
        c.status !== 'archived'
      )
      .sort((a: any, b: any) =>
        new Date(b.created_at || b.createdAt).getTime() -
        new Date(a.created_at || a.createdAt).getTime()
      ),
  [captures]);

  /* Section B — Contexto Recente */
  const contextItems = useMemo(() => {
    const items: UnifiedItem[] = [];

    tasks
      .filter((t: any) => !['done', 'cancelled'].includes(t.status))
      .slice(0, 5)
      .forEach((t: any) => items.push({
        id: String(t.id), type: 'task', title: t.title,
        status: t.status, createdAt: t.created_at || t.createdAt, raw: t
      }));

    meetings
      .filter((m: any) => {
        const d = new Date(m.meeting_date || m.created_at);
        const diff = Date.now() - d.getTime();
        return diff < 7 * 24 * 60 * 60 * 1000;
      })
      .slice(0, 3)
      .forEach((m: any) => items.push({
        id: String(m.id), type: 'meeting', title: m.title,
        status: m.status || 'scheduled', createdAt: m.meeting_date || m.created_at, raw: m
      }));

    return items.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [tasks, meetings]);

  /* Mutations */
  const deleteCapture = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/captures/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['captures'] }); toast('Signal deletado', 'success'); },
    onError: (err: any) => { toast(`Erro: ${err.message || 'tente novamente'}`, 'error'); },
  });

  const archiveCapture = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/captures/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'processed' }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['captures'] }); toast('Signal arquivado', 'success'); },
    onError: (err: any) => { toast(`Erro: ${err.message || 'tente novamente'}`, 'error'); },
  });

  const processAI = useMutation({
    mutationFn: async () => {
      const pendingIds = captures
        .filter((c: any) => c.status !== 'processed' && c.content?.trim())
        .map((c: any) => c.id || c._id);
      if (pendingIds.length === 0) {
        toast('Nenhum sinal pendente para processar', 'info');
        return;
      }
      return apiFetch('/api/captures/bulk', {
        method: 'POST',
        body: JSON.stringify({ action: 'extract', ids: pendingIds })
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['captures'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['meetings'] });
      toast('Processamento de IA concluído', 'success');
    },
    onError: (err: any) => {
      toast(`Erro no processamento: ${err.message || 'tente novamente'}`, 'error');
    },
  });

  const evolveCapture = useMutation({
    mutationFn: async ({ id, targetType }: { id: string; targetType: string }) => {
      const VALID_TYPES = ['task', 'meeting', 'idea', 'link', 'note', 'project'];
      const safeType = VALID_TYPES.includes(targetType) ? targetType : 'note';
      return apiFetch(`/api/captures/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ type: safeType, status: 'processed' })
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['captures'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast('Sinal evoluído com sucesso', 'success');
    },
    onError: (err: any) => {
      toast(`Erro ao evoluir: ${err.message || 'tente novamente'}`, 'error');
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
    onError: (_err, _content, context) => {
      qc.setQueryData(['captures'], context?.previous);
      toast('Falha ao salvar sinal', 'error');
    },
    onSuccess: () => {
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await qc.invalidateQueries({ queryKey: ['captures'] });
        const current = qc.getQueryData<any[]>(['captures']) || [];
        const stillProcessing = current.some((c: any) => c.status === 'processing');
        if (!stillProcessing || attempts >= 5) clearInterval(poll);
      }, 2000);
    }
  });

  return (
    <div className="inbox-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem' }}>

      {/* HEADER */}
      <PageHeader
        title="Inbox"
        subtitle={`${triageItems.length} sinal${triageItems.length !== 1 ? 'is' : ''} para triagem`}
        actions={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="outline" size="sm"
              onClick={() => {
                if (!captureText.trim()) return;
                smartCapture.mutate(captureText.trim());
                setCaptureText('');
              }}
              disabled={!captureText.trim() || smartCapture.isPending}
            >
              <Rocket size={14} style={{ marginRight: 4 }} />
              Captura Rápida
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => processAI.mutate()}
              disabled={processAI.isPending || triageItems.length === 0}
            >
              {processAI.isPending
                ? <><Loader2 size={14} className="spin" style={{ marginRight: 4 }} />Analisando...</>
                : <><BrainCircuit size={14} style={{ marginRight: 4 }} />Analisar com IA</>
              }
            </Button>
          </div>
        }
      />

      {/* QUICK CAPTURE INPUT */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Input
          placeholder="Capturar pensamento, link, ideia..."
          value={captureText}
          onChange={e => setCaptureText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && captureText.trim()) {
              smartCapture.mutate(captureText.trim());
              setCaptureText('');
            }
          }}
          style={{ flex: 1 }}
        />
      </div>

      {/* TRIAGE SECTION */}
      <section>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', opacity: 0.5, marginBottom: '0.75rem' }}>
          Sinais para Triagem
        </h3>
        {triageItems.length === 0 ? (
          <EmptyState
            icon={<Target size={32} />}
            title="Inbox zerado"
            description="Nenhum sinal pendente. Use a captura rápida para adicionar."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {triageItems.map((capture: any) => (
              <CaptureTriageCard
                key={capture.id}
                capture={capture}
                onEvolve={(id, type) => evolveCapture.mutate({ id, targetType: type })}
                onArchive={(id) => archiveCapture.mutate(id)}
                onDelete={(id) => deleteCapture.mutate(id)}
                isLoading={evolveCapture.isPending || archiveCapture.isPending}
              />
            ))}
          </div>
        )}
      </section>

      {/* CONTEXT SECTION */}
      {contextItems.length > 0 && (
        <section>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.05em', opacity: 0.5, marginBottom: '0.75rem' }}>
            Contexto Recente
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {contextItems.map(item => (
              <ContextCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
