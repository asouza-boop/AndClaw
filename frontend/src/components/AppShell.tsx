import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { Topbar } from './Topbar';
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
    <div className="flex min-h-screen w-full bg-background relative overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-accent/5 rounded-full blur-[120px]" />
      </div>
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
