import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';
import React from 'react';

const ThrowError = () => {
  throw new Error('Test Error');
};

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Child Content</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('renders fallback UI when child throws', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Algo deu errado')).toBeDefined();
    consoleSpy.mockRestore();
  });

  it('"Tentar novamente" button resets error state and re-renders children', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Algo deu errado')).toBeDefined();
    
    // Rerender with safe content
    rerender(
      <ErrorBoundary>
        <div data-testid="safe-child">Safe Content</div>
      </ErrorBoundary>
    );
    
    fireEvent.click(screen.getByText('Tentar novamente'));
    expect(screen.getByTestId('safe-child')).toBeDefined();
    
    consoleSpy.mockRestore();
  });

  it('renders custom fallback prop when provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom Fallback</div>}>
        <ThrowError />
      </ErrorBoundary>
    );
    
    expect(screen.getByTestId('custom-fallback')).toBeDefined();
    consoleSpy.mockRestore();
  });
});
