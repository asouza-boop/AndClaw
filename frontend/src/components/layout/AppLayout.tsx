import React from 'react';
import { MobileNav } from './MobileNav';

interface AppLayoutProps {
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}

export function AppLayout({ sidebar, children }: AppLayoutProps) {
  
  const layoutStyle: React.CSSProperties = {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
    backgroundColor: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-sans)',
  };

  const mainAreaStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0, // prevents flex blowout
  };

  const contentWrapperStyle: React.CSSProperties = {
    flex: 1,
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    // Mobile padding by default, overridden by media query class below
  };

  return (
    <div style={layoutStyle}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-[240px] border-r" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
        {sidebar}
      </aside>

      {/* Main Content Area */}
      <div className="md:pl-[240px] pb-[64px] md:pb-0" style={mainAreaStyle}>
        <main className="p-[var(--space-4)] md:p-[var(--space-6)]" style={contentWrapperStyle}>
          {children}
        </main>
      </div>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
}
