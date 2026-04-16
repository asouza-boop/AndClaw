import { cn } from './utils';

/**
 * Standardizes composition of interactive surface classes.
 */
export function glassOverlay(blurred = true) {
  return cn(
    'bg-white/5 border border-white/10 shadow-lg',
    blurred && 'backdrop-blur-xl'
  );
}

/**
 * Standardizes composition of panels like sidebars and main content areas.
 */
export function glassPanel() {
  return cn(
    'bg-black/40 backdrop-blur-2xl border border-white/5 shadow-2xl rounded-2xl'
  );
}

// Re-export cn for standardized usage
export { cn };
