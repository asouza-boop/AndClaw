import React from 'react';
// MobileNav removed — sidebar handles navigation on all viewports

interface AppLayoutProps {
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}

export function AppLayout({ sidebar, children }: AppLayoutProps) {

  const layoutStyle: React.CSSProperties = {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
    backgroundColor: 'var(--color-bg-base)',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-sans)',
    lineHeight: 'var(--leading-normal)',
  };

  const mainAreaStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  };

  return (
    <div style={layoutStyle}>
      {/* Sidebar */}
      <aside
        className="hidden md:flex flex-col fixed inset-y-0 left-0 w-[224px] border-r"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-surface)' }}
      >
        {sidebar}
      </aside>

      {/* Main Content Area — no bottom padding for mobile nav */}
      <div className="md:pl-[224px]" style={mainAreaStyle}>
        <main
          className="page-content animate-fade-in"
          style={{
            flex: 1,
            width: '100%',
            maxWidth: '1200px',
            margin: '0 auto',
            paddingTop: 'var(--space-page-top)',
            paddingLeft: 'var(--space-page-x-mobile)',
            paddingRight: 'var(--space-page-x-mobile)',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
