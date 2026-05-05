import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
  shadow?: 'none' | 'sm' | 'md';
}

export function Card({ 
  padding = 'md', 
  border = true, 
  shadow = 'sm', 
  children, 
  className = '', 
  style, 
  ...props 
}: CardProps) {
  
  const paddingMap = {
    none: '0',
    sm: 'var(--space-3)',
    md: 'var(--space-5)',
    lg: 'var(--space-8)',
  };

  const shadowMap = {
    none: 'none',
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-secondary)',
    borderRadius: 'var(--radius-lg)',
    padding: paddingMap[padding],
    border: border ? '1px solid var(--color-border)' : 'none',
    boxShadow: shadowMap[shadow],
    ...style,
  };

  return (
    <div style={cardStyle} className={className} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
        padding: 'var(--space-6) var(--space-6) 0 var(--space-6)',
        ...style,
      }}
      className={className}
      {...props}
    />
  );
}

export function CardTitle({ className = '', style, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      style={{
        fontSize: 'var(--text-lg)',
        fontWeight: 'var(--font-semibold)',
        color: 'var(--color-text-primary)',
        margin: 0,
        ...style,
      }}
      className={className}
      {...props}
    />
  );
}

export function CardDescription({ className = '', style, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--color-text-secondary)',
        margin: 0,
        ...style,
      }}
      className={className}
      {...props}
    />
  );
}

export function CardContent({ className = '', style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        padding: 'var(--space-6)',
        ...style,
      }}
      className={className}
      {...props}
    />
  );
}

export function CardFooter({ className = '', style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-6) var(--space-6) var(--space-6)',
        ...style,
      }}
      className={className}
      {...props}
    />
  );
}

