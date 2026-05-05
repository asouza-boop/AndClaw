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

  const sidebarStyle: React.CSSProperties = {
    width: '240px',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    position: 'sticky',
    top: 0,
    backgroundColor: 'var(--color-bg-secondary)',
    borderRight: '1px solid var(--color-border)',
    fontFamily: 'var(--font-sans)',
  };

  const navItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    height: '36px',
    padding: '0 var(--space-4)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--font-medium)',
    textDecoration: 'none',
    transition: 'all var(--transition-base)',
  };

  const sectionLabelStyle: React.CSSProperties = {
    padding: '0 var(--space-4)',
    marginBottom: 'var(--space-2)',
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--font-medium)',
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  };

  return (
    <aside style={sidebarStyle}>
      {/* Logo */}
      <div style={{ padding: 'var(--space-8) var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{ 
          width: '32px', 
          height: '32px', 
          borderRadius: 'var(--radius-md)', 
          backgroundColor: 'var(--color-accent)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--color-text-inverse)',
          fontWeight: 'bold',
          fontSize: '14px'
        }}>
          AC
        </div>
        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
          AndClaw
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0 var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {sections.map((section) => (
          <div key={section.label}>
            <p style={sectionLabelStyle}>{section.label}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {section.items.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <RouterNavLink
                    key={item.to}
                    to={item.to}
                    style={{
                      ...navItemStyle,
                      backgroundColor: active ? 'var(--color-accent-subtle)' : 'transparent',
                      color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <item.icon size={16} strokeWidth={active ? 2.5 : 2} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.to === '/inbox' && unreadCount > 0 && (
                      <span style={{ 
                        fontSize: '10px', 
                        padding: '0 6px', 
                        height: '18px', 
                        borderRadius: '10px', 
                        backgroundColor: active ? 'var(--color-accent)' : 'var(--color-border-strong)',
                        color: active ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        {unreadCount}
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
      <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <RouterNavLink
          to="/settings"
          style={{
            ...navItemStyle,
            backgroundColor: location.pathname === '/settings' ? 'var(--color-accent-subtle)' : 'transparent',
            color: location.pathname === '/settings' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
          }}
          onMouseEnter={(e) => {
            if (location.pathname !== '/settings') {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
            }
          }}
          onMouseLeave={(e) => {
            if (location.pathname !== '/settings') {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <Settings size={16} />
          <span>Configurações</span>
        </RouterNavLink>
        
        <button 
          onClick={logout}
          style={{
            ...navItemStyle,
            color: 'var(--color-error)',
            backgroundColor: 'transparent',
            border: 'none',
            textAlign: 'left',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Radio size={16} />
          <span>Encerrar Sessão</span>
        </button>
      </div>
    </aside>
  );
}
