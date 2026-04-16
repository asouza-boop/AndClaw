/**
 * Glass Engine Design System: Layout Tokens
 * Provides a highly scalable variable system for geometric properties.
 */

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  "2xl": "48px",
  "3xl": "64px"
} as const;

export const radius = {
  sm: "6px",
  md: "12px",
  lg: "16px",
  xl: "22px",
  full: "9999px"
} as const;

export const zIndex = {
  behind: -1,
  base: 0,
  glass: 10,
  dropdown: 50,
  sticky: 100,
  overlay: 200,
  modal: 300,
  toast: 400,
  popover: 500,
} as const;

export const typography = {
  fontSizes: {
    xs: "10px",
    sm: "12px",
    base: "14px",
    lg: "18px",
    xl: "24px",
    "2xl": "32px"
  },
  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    black: "900"
  }
} as const;
