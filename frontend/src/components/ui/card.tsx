import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
  shadow?: 'none' | 'sm' | 'md';
  elevated?: boolean;
  variant?: 'default' | 'elevated' | 'accent';
  animate?: boolean;
}

export function Card({
  padding = 'md',
  border = true,
  shadow = 'none',
  elevated = false,
  variant = 'default',
  animate = true,
  children,
  className = '',
  style,
  ...props
}: CardProps) {

  const paddingMap = {
    none: '0',
    sm:   '14px',
    md:   '20px',
    lg:   '28px',
  };

  const shadowMap = {
    none: 'none',
    sm:   'var(--shadow-sm)',
    md:   'var(--shadow-md)',
  };

  // Variant-specific styles
  const variantStyles: React.CSSProperties = (() => {
    if (variant === 'elevated' || elevated) {
      return {
        backgroundColor: 'var(--color-bg-elevated)',
        boxShadow: 'var(--shadow-sm)',
      };
    }
    if (variant === 'accent') {
      return {
        backgroundColor: 'var(--color-bg-surface)',
        borderTop: '2px solid var(--color-accent)',
        borderLeft: '1px solid var(--color-accent-dim)',
        borderRight: '1px solid var(--color-accent-dim)',
        borderBottom: '1px solid var(--color-accent-dim)',
      };
    }
    return {
      backgroundColor: 'var(--color-bg-surface)',
    };
  })();

  const cardStyle: React.CSSProperties = {
    ...variantStyles,
    borderRadius: 'var(--radius-md)',
    padding: paddingMap[padding],
    border: (variant !== 'accent' && border) ? '1px solid var(--color-border)' : undefined,
    boxShadow: shadowMap[shadow] !== 'none' ? shadowMap[shadow] : variantStyles.boxShadow,
    transition: 'border-color var(--t-fast), background var(--t-fast)',
    ...style,
  };

  return (
    <div
      style={cardStyle}
      className={`${animate ? 'animate-card-in' : ''} card-hover ${className}`}
      {...props}
    >
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
        gap: '4px',
        padding: '20px 20px 0 20px',
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
        lineHeight: 'var(--leading-normal)',
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
        padding: '20px',
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
        padding: '0 20px 20px 20px',
        ...style,
      }}
      className={className}
      {...props}
    />
  );
}
