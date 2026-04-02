import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState } from 'react';
import { Bookmark, ExternalLink, RefreshCw, Plus } from 'lucide-react';

export default function FavoritesPage() {
  const qc = useQueryClient();
  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => apiFetch('/api/favorites').then(ensureArray),
  });
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');

  const saveFavorite = useMutation({
    mutationFn: () =>
      apiFetch('/api/favorites', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          url: url.trim(),
          tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        }),
      }),
    onSuccess: () => {
      setTitle('');
      setUrl('');
      setTags('');
      qc.invalidateQueries({ queryKey: ['favorites'] });
      toast('Favorito salvo.', 'success');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const syncRaindrop = useMutation({
    mutationFn: () => apiFetch('/api/raindrop/sync', { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['favorites'] });
      toast('Sincronização do Raindrop concluída.', 'success');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Favoritos</h1>
          <p className="text-sm text-muted-foreground mt-1">Links úteis e itens sincronizados do Raindrop.</p>
        </div>
        <button
          onClick={() => syncRaindrop.mutate()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${syncRaindrop.isPending ? 'animate-spin' : ''}`} />
          Sincronizar Raindrop
        </button>
      </div>

      <div className="rounded-xl bg-card border border-border p-5 space-y-3">
        <h2 className="text-sm font-semibold">Novo favorito</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="px-4 py-2.5 rounded-lg bg-surface-2 border border-border text-sm" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="px-4 py-2.5 rounded-lg bg-surface-2 border border-border text-sm" />
        </div>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags, separadas, por, vírgula" className="px-4 py-2.5 rounded-lg bg-surface-2 border border-border text-sm w-full" />
        <div className="flex justify-end">
          <button
            onClick={() => saveFavorite.mutate()}
            disabled={saveFavorite.isPending || !title.trim() || !url.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Salvar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {favorites.map((item: any) => (
          <div key={item.id} className="rounded-xl bg-card border border-border p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{item.source === 'raindrop' ? 'Raindrop' : 'Manual'}</p>
              </div>
              <a href={item.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-sm text-muted-foreground break-all">{item.url}</p>
            <div className="flex flex-wrap gap-2">
              {(item.tags || []).map((tag: any, index: number) => (
                <span key={index} className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {tag.name || tag}
                </span>
              ))}
            </div>
          </div>
        ))}
        {favorites.length === 0 && (
          <div className="rounded-xl bg-card border border-border p-10 text-center text-muted-foreground lg:col-span-2">
            <Bookmark className="w-8 h-8 mx-auto mb-3 opacity-40" />
            Nenhum favorito cadastrado.
          </div>
        )}
      </div>
    </div>
  );
}
