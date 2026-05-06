import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useState } from 'react';
import { Bookmark, ExternalLink, RefreshCw, Plus, Link as LinkIcon, Tag } from 'lucide-react';
import { FavoritesSkeleton } from '@/components/PageSkeletons';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/EmptyState';

export default function FavoritesPage() {
  const qc = useQueryClient();
  const { data: favorites = [], isLoading } = useQuery({
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

  if (isLoading) {
    return <FavoritesSkeleton />;
  }

  return (
    <AppLayout sidebar={<AppSidebar />}>
      <PageHeader 
        title="Favoritos" 
        subtitle="Links úteis e itens sincronizados do Raindrop"
        actions={
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => syncRaindrop.mutate()}
            disabled={syncRaindrop.isPending}
          >
            <RefreshCw size={14} className={`mr-2 ${syncRaindrop.isPending ? 'animate-spin' : ''}`} />
            Sincronizar Raindrop
          </Button>
        }
      />

      <div style={{ marginTop: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
        {/* New Favorite Form */}
        <Card padding="lg" border shadow="sm">
          <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Plus size={14} /> Novo favorito
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />
              <Input label="URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            </div>
            <Input label="Tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags, separadas, por, vírgula" />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="primary"
                onClick={() => saveFavorite.mutate()}
                disabled={saveFavorite.isPending || !title.trim() || !url.trim()}
              >
                Salvar Favorito
              </Button>
            </div>
          </div>
        </Card>

        {/* Favorites List */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 'var(--space-6)' }}>
          {favorites.map((item: any) => (
            <Card key={item.id} padding="lg" border shadow="sm" className="group">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', margin: 0 }}>{item.title}</h3>
                  <Badge variant="ghost" style={{ fontSize: '9px', marginTop: 'var(--space-1)' }}>
                    {item.source === 'raindrop' ? 'Raindrop' : 'Manual'}
                  </Badge>
                </div>
                <a href={item.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-text-tertiary)' }} className="hover:text-primary transition-colors">
                  <ExternalLink size={14} />
                </a>
              </div>
              
              <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-4)', wordBreak: 'break-all' }}>
                {item.url}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {(item.tags || []).map((tag: any, index: number) => (
                  <Badge key={index} variant="secondary" style={{ fontSize: '9px', fontFamily: 'var(--font-mono)' }}>
                    <Tag size={8} className="mr-1" />
                    {tag.name || tag}
                  </Badge>
                ))}
              </div>
            </Card>
          ))}
          
          {favorites.length === 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <EmptyState 
                icon={<Bookmark size={40} />}
                title="Sem favoritos"
                description="Adicione links manuais ou sincronize sua conta do Raindrop para começar."
              />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

