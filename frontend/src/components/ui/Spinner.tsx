import React from 'react';

interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg';
}

export function Spinner({ size = 'md', className = '', ...props }: SpinnerProps) {
  const sizeMap = {
    sm: '16px',
    md: '24px',
    lg: '32px',
  };

  const currentSize = sizeMap[size];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={currentSize}
      height={currentSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`animate-spin ${className}`}
      style={{
        transition: 'var(--transition-base)',
      }}
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
