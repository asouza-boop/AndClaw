import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export function Badge({ variant = 'default', children, className = '', style, ...props }: BadgeProps) {
  
  const colorMap = {
    default: 'var(--color-text-secondary)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
    info: 'var(--color-info)',
  };

  const bgMap = {
    default: 'rgba(107, 107, 107, 0.12)', // approximating secondary at 12%
    success: 'rgba(22, 163, 74, 0.12)',
    warning: 'rgba(217, 119, 6, 0.12)',
    error: 'rgba(220, 38, 38, 0.12)',
    info: 'rgba(37, 99, 235, 0.12)',
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '24px',
    padding: '0 var(--space-2)',
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--font-medium)',
    fontFamily: 'var(--font-sans)',
    borderRadius: 'var(--radius-sm)',
    color: colorMap[variant],
    backgroundColor: bgMap[variant],
    ...style,
  };

  return (
    <span style={badgeStyle} className={className} {...props}>
      {children}
    </span>
  );
}
