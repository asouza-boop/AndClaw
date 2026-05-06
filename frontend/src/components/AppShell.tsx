import { useLocation, Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { IntelligenceSidebar } from './agent/IntelligenceSidebar';
import { Topbar } from './Topbar';
import { BackendRetryBanner } from './BackendRetryBanner';
import { BackendRetryIndicator } from './BackendRetryIndicator';
import { CommandPalette } from './CommandPalette';
import { DebugPanel } from './DebugPanel';
import { useEffect } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/inbox': 'Inbox',
  '/chat': 'Chat',
  '/agenda': 'Agenda',
  '/projetos': 'Projetos',
  '/agents': 'Agentes',
  '/skills': 'Skills',
  '/reunioes': 'Reuniões',
  '/favoritos': 'Favoritos',
  '/conhecimento': 'Conhecimento',
  '/arquivo': 'Arquivo',
  '/evolucao': 'Evolução',
  '/aprendizado': 'Inteligência',
  '/settings': 'Configurações',
};

export function AppShell() {
  const location = useLocation();
  const title = titles[location.pathname] || 'AndClaw';
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return (
    <div
      className="flex h-screen w-full relative overflow-hidden select-none"
      style={{ backgroundColor: 'var(--color-bg-base)' }}
    >
      {/* Sidebar — fixed left, 224px */}
      <div
        className="hidden md:flex flex-col flex-shrink-0"
        style={{
          width: '224px',
          borderRight: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-surface)',
        }}
      >
        <AppSidebar />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <BackendRetryBanner />
        <div
          className="flex-1 flex flex-col overflow-hidden"
          style={{ backgroundColor: 'var(--color-bg-base)' }}
        >
          <Topbar title={title} />
          <main className="flex-1 overflow-y-auto scrollbar-hide animate-fade-in">
            <div className="page-content max-w-[1600px] mx-auto w-full min-h-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Intelligence sidebar — only on very wide viewports */}
      <div
        className="hidden 2xl:flex flex-col flex-shrink-0"
        style={{
          width: '360px',
          borderLeft: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-surface)',
        }}
      >
        <IntelligenceSidebar />
      </div>

      <BackendRetryIndicator />
      <CommandPalette />
      <DebugPanel />
    </div>
  );
}
