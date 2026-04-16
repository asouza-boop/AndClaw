/**
 * Glass Engine Design System: Color Tokens
 * Scalable Tailwind-derived palette variables for safe typing across custom components.
 */

export const colors = {
  glass: {
    base: "bg-surface/40", // Fallback tailwind token from global.css mapping typically
    elevated: "bg-surface/60",
    heavy: "bg-surface/80",
    border: "border-white/[0.08]", borderHover: "border-white/[0.15]",
    blur: "backdrop-blur-xl"
  },
  text: {
    primary: "text-foreground",
    secondary: "text-foreground/80",
    muted: "text-muted-foreground",
    accent: "text-primary"
  },
  states: {
    success: {
      base: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      text: "text-emerald-400"
    },
    warning: {
      base: "bg-amber-500/10",
      border: "border-amber-500/20",
      text: "text-amber-400"
    },
    error: {
      base: "bg-red-500/10",
      border: "border-red-500/20",
      text: "text-red-400"
    },
    info: {
      base: "bg-blue-500/10",
      border: "border-blue-500/20",
      text: "text-blue-400"
    }
  }
} as const;
