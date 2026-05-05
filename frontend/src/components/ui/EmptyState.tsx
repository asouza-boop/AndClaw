import React from 'react';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action, className = '', style, ...props }: EmptyStateProps) {
  
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 'var(--space-12) var(--space-6)',
    fontFamily: 'var(--font-sans)',
    ...style,
  };

  const iconContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    color: 'var(--color-text-tertiary)',
    marginBottom: 'var(--space-4)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 'var(--text-lg)',
    fontWeight: 'var(--font-medium)',
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--space-2)',
  };

  const descStyle: React.CSSProperties = {
    fontSize: 'var(--text-base)',
    color: 'var(--color-text-secondary)',
    maxWidth: '400px',
    marginBottom: action ? 'var(--space-6)' : 0,
  };

  return (
    <div style={containerStyle} className={className} {...props}>
      {icon && (
        <div style={iconContainerStyle}>
          {icon}
        </div>
      )}
      <h3 style={titleStyle}>{title}</h3>
      {description && <p style={descStyle}>{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
