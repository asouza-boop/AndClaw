import { NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Inbox, MessageSquare, Calendar,
  FolderOpen, Bot, Zap, Target,
  Bookmark, BookOpen, Archive, Settings,
  Radio, LogOut
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';

const CustomLogo = () => (
  <svg viewBox="0 0 100 100" width="28" height="28" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 4px rgba(232, 72, 75, 0.3))' }}>
    <path d="M 35 25 Q 20 10 25 5" stroke="#E8484B" strokeWidth="4" fill="transparent" strokeLinecap="round"/>
    <path d="M 65 25 Q 80 10 75 5" stroke="#E8484B" strokeWidth="4" fill="transparent" strokeLinecap="round"/>
    <ellipse cx="10" cy="50" rx="12" ry="10" fill="#E8484B" transform="rotate(-20 10 50)" />
    <ellipse cx="90" cy="50" rx="12" ry="10" fill="#E8484B" transform="rotate(20 90 50)" />
    <circle cx="50" cy="50" r="42" fill="#E8484B" />
    <path d="M 35 85 L 35 98 L 45 98 L 45 85" fill="#E8484B" />
    <path d="M 55 85 L 55 98 L 65 98 L 65 85" fill="#E8484B" />
    <circle cx="35" cy="40" r="8" fill="#0B131E" />
    <circle cx="65" cy="40" r="8" fill="#0B131E" />
    <circle cx="35" cy="40" r="3" fill="#00E5FF" filter="drop-shadow(0px 0px 4px #00E5FF)" />
    <circle cx="65" cy="40" r="3" fill="#00E5FF" filter="drop-shadow(0px 0px 4px #00E5FF)" />
  </svg>
);

const sections = [
  {
    label: 'PRINCIPAL',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
      { icon: Inbox,           label: 'Inbox',     to: '/inbox' },
      { icon: MessageSquare,   label: 'Chat',      to: '/chat' },
      { icon: Calendar,        label: 'Agenda',    to: '/agenda' },
    ],
  },
  {
    label: 'TRABALHO',
    items: [
      { icon: FolderOpen, label: 'Projetos',    to: '/projetos' },
      { icon: Bot,        label: 'Agentes',     to: '/agents' },
      { icon: Zap,        label: 'Skills',      to: '/skills' },
      { icon: Target,     label: 'Reuniões',    to: '/reunioes' },
      { icon: Radio,      label: 'Inteligência',to: '/aprendizado' },
    ],
  },
  {
    label: 'BIBLIOTECA',
    items: [
      { icon: Bookmark, label: 'Favoritos',   to: '/favoritos' },
      { icon: BookOpen, label: 'Conhecimento',to: '/conhecimento' },
      { icon: Archive,  label: 'Arquivo',     to: '/arquivo' },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const sidebarStyle: React.CSSProperties = {
    width: '224px',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    position: 'sticky',
    top: 0,
    backgroundColor: 'transparent',
    borderRight: 'none',
    fontFamily: 'var(--font-sans)',
  };

  const navItemBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    height: '32px',
    padding: '0 12px 0 20px',
    borderRadius: '8px',
    fontSize: 'var(--text-sm)',
    textDecoration: 'none',
    transition: 'color var(--t-fast), background var(--t-fast)',
    cursor: 'pointer',
    border: 'none',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const sectionLabelStyle: React.CSSProperties = {
    padding: '16px 20px 8px',
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  };

  function getItemStyle(isActive: boolean): React.CSSProperties {
    if (isActive) {
      return {
        ...navItemBase,
        backgroundColor: 'var(--color-accent-sub)',
        color: 'var(--color-accent)',
        fontWeight: 500,
        border: '1px solid var(--color-accent-dim)',
      };
    }
    return {
      ...navItemBase,
      backgroundColor: 'transparent',
      color: 'var(--color-text-secondary)',
    };
  }

  function handleMouseEnter(e: React.MouseEvent<HTMLElement>, isActive: boolean) {
    if (!isActive) {
      (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-overlay)';
    }
  }

  function handleMouseLeave(e: React.MouseEvent<HTMLElement>, isActive: boolean) {
    if (!isActive) {
      (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)';
      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
    }
  }

  return (
    <aside style={sidebarStyle}>
      {/* Logo area — 56px height */}
      <div 
        className="group"
        style={{
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: '10px',
          flexShrink: 0,
          cursor: 'default'
        }}
      >
        <CustomLogo />
        <span 
          className="group-hover:text-cyan-400 transition-colors duration-300"
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '0.02em'
          }}
        >
          AndClaw AI
        </span>
      </div>

      {/* Nav sections */}
      <nav style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        paddingBottom: '8px',
      }}>
        {sections.map((section) => (
          <div key={section.label}>
            <p style={sectionLabelStyle}>{section.label}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 8px' }}>
              {section.items.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <RouterNavLink
                    key={item.to}
                    to={item.to}
                    style={getItemStyle(isActive)}
                    onMouseEnter={(e) => handleMouseEnter(e, isActive)}
                    onMouseLeave={(e) => handleMouseLeave(e, isActive)}
                  >
                    <item.icon size={15} strokeWidth={isActive ? 2.5 : 2} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.to === '/inbox' && unreadCount > 0 && (
                      <span style={{
                        fontSize: '10px',
                        padding: '0 5px',
                        height: '18px',
                        borderRadius: '99px',
                        backgroundColor: 'var(--color-accent)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        marginLeft: 'auto',
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

      {/* Footer — pinned settings + logout */}
      <div style={{
        borderTop: '1px solid var(--color-border)',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        {/* Configurações */}
        <RouterNavLink
          to="/settings"
          style={getItemStyle(location.pathname === '/settings')}
          onMouseEnter={(e) => handleMouseEnter(e, location.pathname === '/settings')}
          onMouseLeave={(e) => handleMouseLeave(e, location.pathname === '/settings')}
        >
          <Settings size={15} strokeWidth={location.pathname === '/settings' ? 2.5 : 2} />
          <span>Configurações</span>
        </RouterNavLink>

        {/* Encerrar Sessão */}
        <button
          onClick={logout}
          style={{
            ...navItemBase,
            color: 'var(--color-error)',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <LogOut size={15} strokeWidth={2} />
          <span>Encerrar Sessão</span>
        </button>
      </div>
    </aside>
  );
}
