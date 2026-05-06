import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { TrendingUp, Clock, CheckCircle2, Zap, BarChart3, ArrowLeft, Activity, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AppSidebar } from '@/components/AppSidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/EmptyState';

export default function EvolutionDashboard() {
  const { data: scores, isLoading } = useQuery({
    queryKey: ['learning-performance'],
    queryFn: () => apiFetch<any>('/api/learning/performance').then(res => ensureArray(res.items)),
    refetchInterval: 10000 // Refresh every 10s
  });

  return (
    <AppLayout sidebar={<AppSidebar />}>
      <PageHeader 
        title="Evolução do Motor" 
        subtitle="Otimização passiva de habilidades baseada em performance real"
        actions={
          <Badge variant="success" style={{ fontSize: '10px', gap: 'var(--space-2)' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
            Otimizador Ativo (Safe Mode)
          </Badge>
        }
      />

      <div style={{ marginTop: 'var(--space-8)' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 'var(--space-4)' }}>
            <Loader2 size={32} className="animate-spin text-primary" />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Computando métricas...</span>
          </div>
        ) : !scores || scores.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <EmptyState
              icon={<TrendingUp size={48} />}
              title="Ainda não há dados de performance"
              description="Execute o agente para começar a treinar o motor de otimização e gerar heurísticas."
            />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
            {scores.map((skill: any) => (
              <Card key={skill.skillId} padding="lg" border shadow="sm" className="group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-black)', margin: 0 }}>{skill.skillId}</h3>
                    <Badge variant="ghost" style={{ fontSize: '9px', marginTop: 'var(--space-1)' }}>Habilidade Ativa</Badge>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-black)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>{skill.score}</span>
                    <span style={{ fontSize: '8px', fontWeight: 'var(--font-bold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>Skill Score</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '9px', color: 'var(--color-text-tertiary)' }}>
                      <CheckCircle2 size={10} className="text-success" /> <span style={{ textTransform: 'uppercase' }}>Sucesso</span>
                    </div>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', fontFamily: 'var(--font-mono)' }}>{(skill.successRate * 100).toFixed(1)}%</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '9px', color: 'var(--color-text-tertiary)' }}>
                      <Clock size={10} className="text-warning" /> <span style={{ textTransform: 'uppercase' }}>Latência</span>
                    </div>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', fontFamily: 'var(--font-mono)' }}>{Math.round(skill.avgLatencyMs)}ms</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '9px', color: 'var(--color-text-tertiary)' }}>
                      <Zap size={10} className="text-primary" /> <span style={{ textTransform: 'uppercase' }}>Uso</span>
                    </div>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', fontFamily: 'var(--font-mono)' }}>{skill.usageCount} exec</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '9px', color: 'var(--color-text-tertiary)' }}>
                      <BarChart3 size={10} className="text-info" /> <span style={{ textTransform: 'uppercase' }}>Status</span>
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: 'var(--font-black)', color: 'var(--color-success)', textTransform: 'uppercase' }}>Otimizado</span>
                  </div>
                </div>

                <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                     <div 
                      style={{ height: '100%', backgroundColor: 'var(--color-primary)', width: `${skill.score}%`, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} 
                     />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
                    <span style={{ fontSize: '8px', color: 'var(--color-text-tertiary)' }}>Última computação</span>
                    <span style={{ fontSize: '8px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>{new Date(skill.lastComputed).toLocaleTimeString()}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

