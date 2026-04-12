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
      { icon: Radio, label: 'Inteligência', to: '/aprendizado' },
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
    <aside className="w-[280px] h-screen flex flex-col shrink-0 sticky top-0 bg-transparent p-6 pr-0">
      <div className="flex-1 flex flex-col glass-panel-v2 border-white/5 shadow-2xl overflow-hidden">
        {/* Logo */}
        <div className="px-6 py-8 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-black text-white shadow-xl shadow-primary/20 interactive-scale transition-premium">
            AC
          </div>
          <div>
            <p className="text-sm font-black tracking-tight text-white leading-none">AndClaw</p>
            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mt-1">Intelligence</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-4 space-y-8 pb-8 scrollbar-hide">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="px-4 mb-4 text-[10px] font-black text-white/20 tracking-[0.2em] uppercase">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = location.pathname === item.to;
                  return (
                    <RouterNavLink
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[13px] font-bold transition-premium group relative ${
                        active
                          ? 'bg-primary/10 text-primary shadow-[0_0_20px_-5px_rgba(168,85,247,0.2)]'
                          : 'text-white/50 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {active && (
                        <div className="absolute left-0 w-1 h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                      )}
                      <item.icon className={`w-4 h-4 transition-premium ${active ? 'text-primary' : 'group-hover:text-white group-hover:scale-110'}`} />
                      <span className="flex-1 tracking-tight">{item.label}</span>
                      {item.to === '/inbox' && unreadCount > 0 && (
                        <span className="min-w-[20px] h-[20px] flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-[10px] font-black shadow-lg shadow-primary/30">
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
        <div className="p-4 border-t border-white/5 bg-black/20">
          <RouterNavLink
            to="/settings"
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[13px] font-bold transition-premium ${
              location.pathname === '/settings'
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Configurações</span>
          </RouterNavLink>
          
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[13px] font-bold text-rose-400/60 hover:text-rose-400 hover:bg-rose-400/5 transition-premium mt-1"
          >
            <Radio className="w-3 h-3 animate-pulse" />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
