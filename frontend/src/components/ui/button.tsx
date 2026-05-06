import React from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, children, className = '', disabled, style, ...props }, ref) => {
    const baseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      fontWeight: 'var(--font-medium)',
      fontSize: 'var(--text-sm)',
      borderRadius: 'var(--radius-md)',
      transition: 'all var(--transition-base)',
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      opacity: disabled && !loading ? 0.4 : 1,
      outline: 'none',
      border: '1px solid transparent',
      position: 'relative',
      whiteSpace: 'nowrap',
    };

    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        backgroundColor: 'var(--color-accent)',
        color: 'var(--color-text-inverse)',
        border: 'none',
      },
      secondary: {
        backgroundColor: 'transparent',
        color: 'var(--color-text-primary)',
        borderColor: 'var(--color-border-strong)',
      },
      ghost: {
        backgroundColor: 'transparent',
        color: 'var(--color-text-secondary)',
        borderColor: 'transparent',
      },
      danger: {
        backgroundColor: 'var(--color-error)',
        color: 'var(--color-text-inverse)',
        border: 'none',
      },
    };

    const hoverStyles: Record<string, React.CSSProperties> = {
      primary: { backgroundColor: 'var(--color-accent-hover)' },
      secondary: { backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border-strong)' },
      ghost: { backgroundColor: 'var(--color-bg-overlay)', color: 'var(--color-text-primary)' },
      danger: { opacity: 0.88 },
    };

    const sizeStyles: Record<string, React.CSSProperties> = {
      sm: {
        height: '28px',
        padding: '0 12px',
        fontSize: 'var(--text-sm)',
      },
      md: {
        height: '36px',
        padding: '0 16px',
        fontSize: 'var(--text-sm)',
      },
      lg: {
        height: '44px',
        padding: '0 20px',
        fontSize: 'var(--text-base)',
      },
    };

    const [isHovered, setIsHovered] = React.useState(false);

    const mergedStyle: React.CSSProperties = {
      ...baseStyle,
      ...variantStyles[variant],
      ...sizeStyles[size],
      ...(isHovered && !disabled && !loading ? hoverStyles[variant] : {}),
      ...style,
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={mergedStyle}
        className={className}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        {loading && (
          <span style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size={size === 'lg' ? 'md' : 'sm'} />
          </span>
        )}
        <span style={{ opacity: loading ? 0 : 1, display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {children}
        </span>
      </button>
    );
  }
);
Button.displayName = 'Button';
