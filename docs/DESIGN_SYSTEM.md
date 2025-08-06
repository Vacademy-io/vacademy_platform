# Modern Design System Documentation

This document outlines the comprehensive design system for our platform, providing guidelines for consistent, modern, and accessible UI development.

## 🎨 Overview

Our design system is built on the principles of:
- **Consistency**: Unified visual language across all components
- **Accessibility**: WCAG 2.1 AA compliant design patterns
- **Modularity**: Reusable components and design tokens
- **Responsiveness**: Mobile-first, responsive design
- **Performance**: Optimized for fast loading and smooth interactions

## 📐 Design Tokens

All design decisions are based on systematic design tokens found in `src/constants/design-tokens.ts`.

### Typography

We use **Inter font** for optimal readability and modern appearance. Open Sans is available as an alternative.

#### Font Scale
```typescript
// Usage in components
className="text-h1"           // 30px, 38px line-height, 400 weight
className="text-h2"           // 24px, 32px line-height, 400 weight
className="text-h3"           // 20px, 28px line-height, 400 weight
className="text-title"        // 18px, 26px line-height, 400 weight
className="text-subtitle"     // 16px, 24px line-height, 400 weight
className="text-body"         // 14px, 22px line-height, 400 weight
className="text-caption"      // 12px, 18px line-height, 400 weight

// Semibold variants
className="text-h1-semibold"  // 30px, 38px line-height, 500 weight
className="text-h2-semibold"  // 24px, 32px line-height, 500 weight
className="text-h3-semibold"  // 20px, 28px line-height, 500 weight
```

#### Font Weights
```typescript
font-light     // 300
font-normal    // 400
font-medium    // 500
font-semibold  // 600
font-bold      // 700
```

### Color System

Our color system uses HSL values with CSS variables for theme flexibility.

#### Primary Colors
```css
--primary-50   /* Lightest tint */
--primary-100
--primary-200
--primary-300
--primary-400
--primary-500  /* Base color */
```

#### Semantic Colors
- **Success**: Green shades for positive actions
- **Warning**: Orange/yellow shades for caution
- **Danger**: Red shades for errors and destructive actions
- **Info**: Blue shades for informational content
- **Neutral**: Gray shades for text and backgrounds

#### Usage Examples
```jsx
// Using semantic colors
<div className="bg-success-50 text-success-700 border-success-200">
  Success message
</div>

<div className="bg-danger-50 text-danger-700 border-danger-200">
  Error message
</div>
```

### Border Radius

Consistent corner radius system based on a base unit of 8px:

```css
rounded-sm     /* 4px */
rounded-md     /* 6px */
rounded-lg     /* 8px - base */
rounded-xl     /* 12px */
rounded-2xl    /* 16px */
rounded-3xl    /* 20px */
rounded-full   /* 9999px */
```

### Spacing

Consistent spacing scale using rem units:

```css
space-xs       /* 4px */
space-sm       /* 8px */
space-md       /* 12px */
space-lg       /* 16px */
space-xl       /* 24px */
space-2xl      /* 32px */
space-3xl      /* 48px */
space-4xl      /* 64px */
space-5xl      /* 96px */
space-6xl      /* 128px */
```

## 🧩 Components

### ModernButton

Enhanced button component with multiple variants and states.

```jsx
import { ModernButton } from '@/components/design-system/modern-button';
import { Play, ChevronRight } from 'phosphor-react';

// Basic usage
<ModernButton variant="primary" size="md">
  Click me
</ModernButton>

// With icons
<ModernButton 
  variant="secondary" 
  size="lg"
  leftIcon={<Play weight="duotone" />}
>
  Play Video
</ModernButton>

// Loading state
<ModernButton 
  variant="primary" 
  size="md"
  isLoading={true}
>
  Submit
</ModernButton>

// Custom styling
<ModernButton 
  variant="outline"
  size="sm"
  rounded="full"
  className="shadow-colored"
>
  Custom Button
</ModernButton>
```

#### Variants
- `primary`: Main brand color, used for primary actions
- `secondary`: Neutral background, used for secondary actions
- `destructive`: Red variant for dangerous actions
- `outline`: Transparent background with border
- `ghost`: Transparent background, minimal styling
- `link`: Text-only appearance with underline

#### Sizes
- `sm`: 36px height, compact spacing
- `md`: 40px height, standard spacing
- `lg`: 44px height, generous spacing
- `xl`: 56px height, maximum spacing

### ModernCard

Flexible card component with multiple variants and built-in components.

```jsx
import { 
  ModernCard, 
  ModernCardHeader, 
  ModernCardTitle, 
  ModernCardContent,
  ModernCardFooter 
} from '@/components/design-system/modern-card';

// Basic card
<ModernCard variant="elevated" hoverable>
  <ModernCardHeader>
    <ModernCardTitle size="lg">Card Title</ModernCardTitle>
  </ModernCardHeader>
  <ModernCardContent>
    Card content goes here
  </ModernCardContent>
  <ModernCardFooter>
    <ModernButton size="sm">Action</ModernButton>
  </ModernCardFooter>
</ModernCard>

// Glass card
<ModernCard variant="glass" padding="lg" rounded="2xl">
  Content with glassmorphism effect
</ModernCard>

// Interactive card
<ModernCard 
  variant="outlined" 
  hoverable 
  interactive
  onClick={() => navigate('/details')}
>
  Clickable card
</ModernCard>
```

#### Variants
- `default`: Basic card with subtle shadow
- `elevated`: Enhanced shadow for prominence
- `glass`: Glassmorphism effect with backdrop blur
- `outlined`: Transparent with border
- `subtle`: Light background tint

### ModernInput

Comprehensive input component with icons, states, and validation.

```jsx
import { ModernInput } from '@/components/design-system/modern-input';
import { MagnifyingGlass, Lock } from 'phosphor-react';

// Basic input
<ModernInput
  label="Email"
  placeholder="Enter your email"
  type="email"
/>

// With icons and states
<ModernInput
  label="Search"
  placeholder="Search..."
  leftIcon={<MagnifyingGlass />}
  variant="filled"
  size="lg"
/>

// Error state
<ModernInput
  label="Password"
  type="password"
  leftIcon={<Lock />}
  state="error"
  errorText="Password must be at least 8 characters"
/>

// Loading state
<ModernInput
  label="Username"
  placeholder="Enter username"
  isLoading={true}
  helperText="Checking availability..."
/>
```

#### Variants
- `default`: Standard border with background
- `filled`: Solid background, no border
- `outlined`: Prominent border, transparent background
- `ghost`: Minimal styling, transparent

#### States
- `default`: Normal state
- `error`: Red accent for validation errors
- `success`: Green accent for valid input
- `warning`: Orange accent for warnings

## 🎭 Animations

### CSS Animation Classes

Our design system includes predefined animation classes for smooth interactions:

```jsx
// Fade animations
<div className="animate-fade-up">Content fades up</div>
<div className="animate-fade-down">Content fades down</div>

// Scale animations
<div className="animate-scale-in">Content scales in</div>
<div className="animate-zoom-in">Content zooms in</div>

// Bounce animation
<div className="animate-bounce-gentle">Gentle bounce effect</div>

// Hover effects
<div className="hover-lift-gentle">Lifts on hover</div>
<div className="hover-scale-gentle">Scales on hover</div>

// Loading states
<div className="skeleton-loading">Loading skeleton</div>
<div className="pulse-soft">Soft pulsing</div>
```

### Animation Principles

1. **Performance**: Use `transform` and `opacity` for smooth 60fps animations
2. **Duration**: Keep animations between 150-500ms for responsiveness
3. **Easing**: Use `cubic-bezier` functions for natural motion
4. **Accessibility**: Respect `prefers-reduced-motion` settings

## 🎨 Utility Classes

### Glassmorphism
```jsx
<div className="glass-card">
  Beautiful glassmorphism effect
</div>
```

### Focus States
```jsx
<button className="focus-ring-primary">Primary focus ring</button>
<button className="focus-ring-error">Error focus ring</button>
<button className="focus-ring-success">Success focus ring</button>
```

### Gradients
```jsx
<div className="bg-gradient-primary">Primary gradient background</div>
<h1 className="text-gradient-primary">Gradient text</h1>
```

### Interactive Elements
```jsx
<div className="interactive">Scales and focus ring on interaction</div>
<div className="clickable">Hover and click effects</div>
```

### Layout Utilities
```jsx
<div className="container-modern">Modern container with responsive padding</div>
<div className="stack-vertical">Vertical spacing between children</div>
<div className="stack-horizontal">Horizontal spacing between children</div>
```

## 📱 Responsive Design

### Breakpoints
```typescript
xs: '350px'       // Extra small devices
sm: '640px'       // Small devices
md: '768px'       // Medium devices
lg: '1024px'      // Large devices
xl: '1280px'      // Extra large devices
2xl: '1536px'     // 2X extra large devices
```

### Mobile-First Approach
```jsx
// Always design mobile-first, then enhance for larger screens
<div className="p-3 sm:p-4 md:p-6 lg:p-8">
  Responsive padding
</div>

<h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl">
  Responsive typography
</h1>
```

## ♿ Accessibility Guidelines

### Focus Management
- All interactive elements must have visible focus indicators
- Use `focus-ring-*` utilities for consistent focus styling
- Ensure logical tab order

### Color Contrast
- All text meets WCAG 2.1 AA contrast ratios
- Use semantic colors appropriately
- Don't rely on color alone to convey information

### Keyboard Navigation
- All functionality accessible via keyboard
- Use semantic HTML elements
- Provide skip links for navigation

### Screen Reader Support
- Use proper heading hierarchy
- Include `aria-label` for icon-only buttons
- Provide alternative text for images

## 🚀 Performance Best Practices

### CSS Optimization
- Use CSS custom properties for theme variables
- Leverage Tailwind's purging for minimal bundle size
- Prefer CSS animations over JavaScript for simple effects

### Component Optimization
- Use `React.memo` for expensive components
- Implement proper prop typing with TypeScript
- Lazy load components when appropriate

### Image Optimization
- Use WebP format when possible
- Implement responsive images with `srcset`
- Add `loading="lazy"` for off-screen images

## 🧪 Testing Guidelines

### Visual Testing
- Test components in all variants and states
- Verify responsive behavior across breakpoints
- Check dark mode compatibility

### Accessibility Testing
- Use axe-core for automated accessibility testing
- Test with keyboard navigation
- Verify screen reader compatibility

### Performance Testing
- Monitor bundle size impact
- Test animation performance on low-end devices
- Measure Cumulative Layout Shift (CLS)

## 🔧 Implementation Examples

### Creating a Dashboard Card
```jsx
import { ModernCard, ModernCardHeader, ModernCardTitle, ModernCardContent } from '@/components/design-system/modern-card';
import { ModernButton } from '@/components/design-system/modern-button';
import { TrendUp } from 'phosphor-react';

export const DashboardCard = ({ title, value, trend, onClick }) => (
  <ModernCard 
    variant="elevated" 
    hoverable 
    interactive
    onClick={onClick}
    className="group"
  >
    <ModernCardHeader variant="subtle">
      <div className="flex items-center justify-between">
        <ModernCardTitle size="md">{title}</ModernCardTitle>
        <TrendUp 
          weight="duotone" 
          className="text-success-500 group-hover:scale-110 transition-transform" 
        />
      </div>
    </ModernCardHeader>
    <ModernCardContent>
      <div className="text-h2-semibold text-primary-600 mb-2">
        {value}
      </div>
      <div className="text-caption text-neutral-600">
        {trend}% increase
      </div>
    </ModernCardContent>
  </ModernCard>
);
```

### Creating a Form with Validation
```jsx
import { ModernInput } from '@/components/design-system/modern-input';
import { ModernButton } from '@/components/design-system/modern-button';
import { ModernCard } from '@/components/design-system/modern-card';
import { User, Mail, Lock } from 'phosphor-react';

export const SignupForm = () => {
  const [formState, setFormState] = useState({});
  const [errors, setErrors] = useState({});

  return (
    <ModernCard variant="glass" padding="xl" rounded="2xl">
      <div className="stack-vertical">
        <h2 className="text-h2-semibold text-center mb-6">Create Account</h2>
        
        <ModernInput
          label="Full Name"
          placeholder="Enter your full name"
          leftIcon={<User />}
          state={errors.name ? 'error' : 'default'}
          errorText={errors.name}
        />
        
        <ModernInput
          label="Email"
          type="email"
          placeholder="Enter your email"
          leftIcon={<Mail />}
          state={errors.email ? 'error' : 'default'}
          errorText={errors.email}
        />
        
        <ModernInput
          label="Password"
          type="password"
          placeholder="Enter your password"
          leftIcon={<Lock />}
          state={errors.password ? 'error' : 'default'}
          errorText={errors.password}
          helperText="Must be at least 8 characters"
        />
        
        <ModernButton 
          variant="primary" 
          size="lg" 
          className="w-full mt-4"
          isLoading={isSubmitting}
        >
          Create Account
        </ModernButton>
      </div>
    </ModernCard>
  );
};
```

## 📚 Resources

### Design Tokens Reference
- [Design Tokens File](../src/constants/design-tokens.ts)
- [Tailwind Config](../tailwind.config.js)
- [CSS Variables](../src/index.css)

### Component Files
- [ModernButton](../src/components/design-system/modern-button.tsx)
- [ModernCard](../src/components/design-system/modern-card.tsx)
- [ModernInput](../src/components/design-system/modern-input.tsx)

### Additional Resources
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Inter Font](https://fonts.google.com/specimen/Inter)
- [Phosphor Icons](https://phosphoricons.com/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## 🎯 Next Steps

1. **Install Framer Motion** (when npm issues are resolved):
   ```bash
   npm install framer-motion
   ```

2. **Switch to Open Sans** (if preferred):
   - Update `font-family` in `tailwind.config.js`
   - Add Open Sans import to `index.html`

3. **Extend Components**:
   - Create ModernDropdown component
   - Add ModernModal component
   - Implement ModernToast system

4. **Enhanced Animations**:
   - Implement Framer Motion variants
   - Add page transition animations
   - Create loading state components

This design system provides a solid foundation for building modern, accessible, and performant user interfaces. Continue to expand and refine based on your specific needs and user feedback. 