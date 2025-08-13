/**
 * Design System Tokens
 * 
 * This file contains all the design tokens for the modern design system.
 * These tokens should be used throughout the application for consistency.
 */

// =============================================================================
// SPACING SYSTEM
// =============================================================================

export const spacing = {
  none: '0',
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '0.75rem',    // 12px
  lg: '1rem',       // 16px
  xl: '1.5rem',     // 24px
  '2xl': '2rem',    // 32px
  '3xl': '3rem',    // 48px
  '4xl': '4rem',    // 64px
  '5xl': '6rem',    // 96px
  '6xl': '8rem',    // 128px
} as const;

// =============================================================================
// TYPOGRAPHY SCALE
// =============================================================================

export const typography = {
  fonts: {
    // Primary font stack (now Figtree)
    sans: ['Figtree', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
    openSans: ['Open Sans', 'Figtree', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
    display: ['Figtree', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
  },
  
  sizes: {
    h1: { size: '30px', lineHeight: '38px', weight: '400' },
    h2: { size: '24px', lineHeight: '32px', weight: '400' },
    h3: { size: '20px', lineHeight: '28px', weight: '400' },
    title: { size: '18px', lineHeight: '26px', weight: '400' },
    subtitle: { size: '16px', lineHeight: '24px', weight: '400' },
    body: { size: '14px', lineHeight: '22px', weight: '400' },
    caption: { size: '12px', lineHeight: '18px', weight: '400' },
    
    // Semibold variants
    'h1-semibold': { size: '30px', lineHeight: '38px', weight: '500' },
    'h2-semibold': { size: '24px', lineHeight: '32px', weight: '500' },
    'h3-semibold': { size: '20px', lineHeight: '28px', weight: '500' },
  },
  
  weights: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

// =============================================================================
// BORDER RADIUS SYSTEM
// =============================================================================

export const borderRadius = {
  none: '0',
  sm: 'calc(var(--radius) - 4px)',  // 4px
  md: 'calc(var(--radius) - 2px)',  // 6px
  lg: 'var(--radius)',               // 8px (base)
  xl: 'calc(var(--radius) + 4px)',  // 12px
  '2xl': 'calc(var(--radius) + 8px)', // 16px
  '3xl': 'calc(var(--radius) + 12px)', // 20px
  full: '9999px',
} as const;

// =============================================================================
// COMPONENT SIZES
// =============================================================================

export const componentSizes = {
  button: {
    sm: { height: '36px', padding: '12px', fontSize: 'caption' },
    md: { height: '40px', padding: '16px', fontSize: 'body' },
    lg: { height: '44px', padding: '32px', fontSize: 'subtitle' },
    xl: { height: '56px', padding: '40px', fontSize: 'title' },
  },
  
  input: {
    sm: { height: '36px', padding: '12px', fontSize: 'caption' },
    md: { height: '40px', padding: '12px', fontSize: 'body' },
    lg: { height: '44px', padding: '16px', fontSize: 'subtitle' },
  },
  
  card: {
    sm: { padding: '12px' },
    md: { padding: '16px' },
    lg: { padding: '24px' },
    xl: { padding: '32px' },
  },
} as const;

// =============================================================================
// SHADOWS
// =============================================================================

export const shadows = {
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  colored: '0 8px 25px -8px var(--primary-500)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
} as const;

// =============================================================================
// ANIMATION TOKENS
// =============================================================================

export const animations = {
  duration: {
    fast: '150ms',
    normal: '250ms',
    slow: '350ms',
    slower: '500ms',
  },
  
  easing: {
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  
  transitions: {
    all: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    transform: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: 'opacity 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    colors: 'color 250ms cubic-bezier(0.4, 0, 0.2, 1), background-color 250ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// =============================================================================
// BREAKPOINTS
// =============================================================================

export const breakpoints = {
  xs: '350px',
  sm: '640px',
  md: '768px',
  'md-tablets': '769px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// =============================================================================
// Z-INDEX SCALE
// =============================================================================

export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;

// =============================================================================
// COLOR SEMANTIC MAPPING
// =============================================================================

export const semanticColors = {
  // Primary brand colors
  primary: {
    50: 'hsl(var(--primary-50))',
    100: 'hsl(var(--primary-100))',
    200: 'hsl(var(--primary-200))',
    300: 'hsl(var(--primary-300))',
    400: 'hsl(var(--primary-400))',
    500: 'hsl(var(--primary-500))',
  },
  
  // Status colors
  success: {
    50: 'hsl(var(--success-50))',
    100: 'hsl(var(--success-100))',
    200: 'hsl(var(--success-200))',
    300: 'hsl(var(--success-300))',
    400: 'hsl(var(--success-400))',
    500: 'hsl(var(--success-500))',
    600: 'hsl(var(--success-600))',
    700: 'hsl(var(--success-700))',
  },
  
  warning: {
    50: 'hsl(var(--warning-50))',
    100: 'hsl(var(--warning-100))',
    200: 'hsl(var(--warning-200))',
    300: 'hsl(var(--warning-300))',
    400: 'hsl(var(--warning-400))',
    500: 'hsl(var(--warning-500))',
    600: 'hsl(var(--warning-600))',
    700: 'hsl(var(--warning-700))',
  },
  
  danger: {
    50: 'hsl(var(--danger-50))',
    100: 'hsl(var(--danger-100))',
    200: 'hsl(var(--danger-200))',
    300: 'hsl(var(--danger-300))',
    400: 'hsl(var(--danger-400))',
    500: 'hsl(var(--danger-500))',
    600: 'hsl(var(--danger-600))',
    700: 'hsl(var(--danger-700))',
  },
  
  info: {
    50: 'hsl(var(--info-50))',
    100: 'hsl(var(--info-100))',
    200: 'hsl(var(--info-200))',
    300: 'hsl(var(--info-300))',
    400: 'hsl(var(--info-400))',
    500: 'hsl(var(--info-500))',
    600: 'hsl(var(--info-600))',
    700: 'hsl(var(--info-700))',
  },
  
  // Neutral colors
  neutral: {
    50: 'hsl(var(--neutral-50))',
    100: 'hsl(var(--neutral-100))',
    200: 'hsl(var(--neutral-200))',
    300: 'hsl(var(--neutral-300))',
    400: 'hsl(var(--neutral-400))',
    500: 'hsl(var(--neutral-500))',
    600: 'hsl(var(--neutral-600))',
    700: 'hsl(var(--neutral-700))',
    800: 'hsl(var(--neutral-800))',
    900: 'hsl(var(--neutral-900))',
  },
} as const;

// =============================================================================
// GLASSMORPHISM TOKENS
// =============================================================================

export const glassmorphism = {
  background: 'rgba(255, 255, 255, 0.85)',
  backgroundDark: 'rgba(0, 0, 0, 0.85)',
  border: 'rgba(255, 255, 255, 0.2)',
  borderDark: 'rgba(255, 255, 255, 0.1)',
  blur: {
    sm: 'blur(8px)',
    md: 'blur(12px)',
    lg: 'blur(20px)',
    xl: 'blur(32px)',
  },
} as const;

// =============================================================================
// COMPONENT VARIANTS
// =============================================================================

export const componentVariants = {
  button: {
    variants: ['primary', 'secondary', 'destructive', 'outline', 'ghost', 'link'],
    sizes: ['sm', 'md', 'lg', 'xl'],
  },
  
  card: {
    variants: ['default', 'elevated', 'glass', 'outlined', 'subtle'],
    sizes: ['sm', 'md', 'lg', 'xl'],
  },
  
  input: {
    variants: ['default', 'filled', 'outlined', 'ghost'],
    sizes: ['sm', 'md', 'lg'],
    states: ['default', 'error', 'success', 'warning'],
  },
} as const;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get CSS variable value for a color
 */
export const getCSSVar = (variable: string): string => `var(--${variable})`;

/**
 * Get HSL color value
 */
export const getHSLColor = (variable: string): string => `hsl(var(--${variable}))`;

/**
 * Generate rgba color with opacity
 */
export const withOpacity = (color: string, opacity: number): string => {
  return `${color.replace('hsl(', 'hsla(').replace(')', `, ${opacity})`)}`;
};

/**
 * Get responsive value based on breakpoint
 */
export const responsive = {
  sm: (value: string) => `@media (min-width: ${breakpoints.sm}) { ${value} }`,
  md: (value: string) => `@media (min-width: ${breakpoints.md}) { ${value} }`,
  lg: (value: string) => `@media (min-width: ${breakpoints.lg}) { ${value} }`,
  xl: (value: string) => `@media (min-width: ${breakpoints.xl}) { ${value} }`,
  '2xl': (value: string) => `@media (min-width: ${breakpoints['2xl']}) { ${value} }`,
};

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type SpacingKey = keyof typeof spacing;
export type TypographySize = keyof typeof typography.sizes;
export type BorderRadiusKey = keyof typeof borderRadius;
export type ShadowKey = keyof typeof shadows;
export type BreakpointKey = keyof typeof breakpoints;
export type ZIndexKey = keyof typeof zIndex;
export type AnimationDuration = keyof typeof animations.duration;
export type AnimationEasing = keyof typeof animations.easing; 