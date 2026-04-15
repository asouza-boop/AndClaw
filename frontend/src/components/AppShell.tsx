import { useLocation, Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { IntelligenceSidebar } from './agent/IntelligenceSidebar';
import { Topbar } from './Topbar';
import { BackendRetryBanner } from './BackendRetryBanner';
import { BackendRetryIndicator } from './BackendRetryIndicator';
import { CommandPalette } from './CommandPalette';
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
    <div className="flex h-screen w-full mesh-gradient relative overflow-hidden font-outfit select-none">
      <AppSidebar />
      
      <div className="flex-1 flex flex-col min-w-0 relative z-10 p-4 md:p-6 lg:p-8 xl:p-10 transition-all duration-700">
        <BackendRetryBanner />
        <div className="flex-1 flex flex-col glass-panel-v2 border-white/5 overflow-hidden shadow-2xl relative">
          <Topbar title={title} />
          <main className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="max-w-[1600px] mx-auto w-full min-h-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <div className="hidden 2xl:block w-[380px] shrink-0 relative z-10 p-6 lg:p-8 xl:p-10 pl-0">
        <div className="h-full glass-panel-v2 border-white/5 shadow-2xl overflow-hidden">
          <IntelligenceSidebar />
        </div>
      </div>

      <BackendRetryIndicator />
      <CommandPalette />
    </div>
  );
}
