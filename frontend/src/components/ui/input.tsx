import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', disabled, style, ...props }, ref) => {
    const hasError = Boolean(error);
    
    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
      width: '100%',
    };

    const labelStyle: React.CSSProperties = {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-medium)',
      color: 'var(--color-text-secondary)',
    };

    const inputStyle: React.CSSProperties = {
      height: '40px',
      padding: '0 var(--space-3)',
      backgroundColor: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
      border: `1px solid ${hasError ? 'var(--color-error)' : 'var(--color-border)'}`,
      borderRadius: 'var(--radius-md)',
      fontSize: 'var(--text-base)',
      fontFamily: 'var(--font-sans)',
      transition: 'border-color var(--transition-fast)',
      outline: 'none',
      opacity: disabled ? 0.4 : 1,
      cursor: disabled ? 'not-allowed' : 'text',
      ...style,
    };

    const errorStyle: React.CSSProperties = {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-error)',
      marginTop: 'calc(var(--space-1) * -1)',
    };

    const [isFocused, setIsFocused] = React.useState(false);

    return (
      <div style={containerStyle} className={className}>
        {label && <label style={labelStyle}>{label}</label>}
        <input
          ref={ref}
          disabled={disabled}
          style={{
            ...inputStyle,
            borderColor: hasError 
              ? 'var(--color-error)' 
              : isFocused 
                ? 'var(--color-accent)' 
                : 'var(--color-border)',
          }}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />
        {/* Placeholder styling is typically done via CSS, so we'll add a class for it or global style. 
            We'll use standard CSS class injection if needed, but modern browsers respect opacity. */}
        <style>{`
          input::placeholder {
            color: var(--color-text-tertiary);
            opacity: 1;
          }
        `}</style>
        {error && <span style={errorStyle}>{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
