import { useQuery } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { BookOpen, Network } from 'lucide-react';

export default function KnowledgePage() {
  const { data: memories = [] } = useQuery({
    queryKey: ['memory'],
    queryFn: () => apiFetch('/api/memory').then(ensureArray),
  });
  const { data: links = [] } = useQuery({
    queryKey: ['links'],
    queryFn: () => apiFetch('/api/links').then(ensureArray),
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Conhecimento</h1>
        <p className="text-sm text-muted-foreground mt-1">Memória consolidada, decisões e links entre páginas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl bg-card border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Memória recente</h2>
          </div>
          <div className="space-y-3">
            {memories.map((item: any) => (
              <div key={item.id} className="rounded-lg bg-surface-2 border border-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{item.type}</p>
                <p className="text-sm whitespace-pre-wrap">{item.content}</p>
              </div>
            ))}
            {memories.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma memória registrada.</p>}
          </div>
        </div>

        <div className="rounded-xl bg-card border border-border p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Network className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold">Links entre páginas</h2>
          </div>
          <div className="space-y-3">
            {links.map((link: any) => (
              <div key={link.id} className="rounded-lg bg-surface-2 border border-border p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{link.label || 'Ligação sem rótulo'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {link.from_type}:{link.from_id} → {link.to_type}:{link.to_id}
                  </p>
                </div>
              </div>
            ))}
            {links.length === 0 && <p className="text-sm text-muted-foreground">Nenhum link cadastrado.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
