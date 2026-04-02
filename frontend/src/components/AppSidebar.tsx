import { NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Inbox, MessageSquare, Calendar,
  FolderOpen, Bot, Zap, Target,
  Bookmark, BookOpen, Archive, Settings,
  Radio
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';

const sections = [
  {
    label: 'PRINCIPAL',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
      { icon: Inbox, label: 'Inbox', to: '/inbox' },
      { icon: MessageSquare, label: 'Chat', to: '/chat' },
      { icon: Calendar, label: 'Agenda', to: '/agenda' },
    ],
  },
  {
    label: 'TRABALHO',
    items: [
      { icon: FolderOpen, label: 'Projetos', to: '/projetos' },
      { icon: Bot, label: 'Agentes', to: '/agents' },
      { icon: Zap, label: 'Skills', to: '/skills' },
      { icon: Target, label: 'Reuniões', to: '/reunioes' },
    ],
  },
  {
    label: 'BIBLIOTECA',
    items: [
      { icon: Bookmark, label: 'Favoritos', to: '/favoritos' },
      { icon: BookOpen, label: 'Conhecimento', to: '/conhecimento' },
      { icon: Archive, label: 'Arquivo', to: '/arquivo' },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
    <aside className="w-64 h-screen flex flex-col bg-surface border-r border-white/[0.07] shrink-0 sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-white">
          A
        </div>
        <div>
          <p className="text-sm font-semibold">AndClaw</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">cmd center</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-6 pb-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <RouterNavLink
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150 ${
                      active
                        ? 'bg-primary/15 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-surface-3'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="flex-1">{item.label}</span>
                    {item.to === '/inbox' && unreadCount > 0 && (
                      <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </RouterNavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 space-y-2">
        <RouterNavLink
          to="/settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
            location.pathname === '/settings'
              ? 'bg-primary/15 text-primary font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-3'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Configurações</span>
        </RouterNavLink>
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-success">
          <Radio className="w-3 h-3" />
          <span>Online</span>
        </div>
      </div>
    </aside>
  );
}
