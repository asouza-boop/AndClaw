import React from 'react';

interface PageHeaderProps extends React.HTMLAttributes<HTMLHeaderElement> {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions, className = '', style, ...props }: PageHeaderProps) {

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: '20px',
    borderBottom: '1px solid var(--color-border)',
    fontFamily: 'var(--font-sans)',
    ...style,
  };

  const titleGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 'var(--text-2xl)',
    fontWeight: 'var(--font-semibold)',
    color: 'var(--color-text-primary)',
    lineHeight: '1.2',
    margin: 0,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-text-secondary)',
    lineHeight: 'var(--leading-normal)',
    marginTop: '4px',
    margin: 0,
  };

  return (
    <header style={headerStyle} className={className} {...props}>
      <div style={titleGroupStyle}>
        <h1 style={titleStyle}>{title}</h1>
        {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {actions}
        </div>
      )}
    </header>
  );
}
