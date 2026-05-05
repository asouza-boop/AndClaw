import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Inbox, MessageSquare, Calendar, FolderKanban } from 'lucide-react';

export function MobileNav() {
  
  const navItems = [
    { to: '/dashboard', icon: <LayoutDashboard />, label: 'Dashboard' },
    { to: '/inbox', icon: <Inbox />, label: 'Inbox' },
    { to: '/chat', icon: <MessageSquare />, label: 'Chat' },
    { to: '/agenda', icon: <Calendar />, label: 'Agenda' },
    { to: '/projetos', icon: <FolderKanban />, label: 'Projetos' },
  ];

  const navStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '64px',
    backgroundColor: 'var(--color-bg-secondary)',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 50,
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-1)',
    textDecoration: 'none',
    width: '100%',
    height: '100%',
  };

  return (
    <nav style={navStyle} className="md:hidden">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          style={({ isActive }) => ({
            ...itemStyle,
            color: isActive ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
          })}
        >
          {({ isActive }) => (
            <>
              <div style={{ width: '20px', height: '20px' }}>
                {React.cloneElement(item.icon as React.ReactElement, { 
                  size: 20, 
                  strokeWidth: isActive ? 2.5 : 2 
                })}
              </div>
              <span style={{ 
                fontSize: '10px', 
                fontWeight: isActive ? 'var(--font-medium)' : 'var(--font-normal)' 
              }}>
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
