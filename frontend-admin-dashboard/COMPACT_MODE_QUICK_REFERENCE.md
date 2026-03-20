# Compact Mode - Quick Reference Card

## 🚀 5-Minute Setup

```bash
# 1. Files are already created:
src/hooks/use-compact-mode.ts
src/components/compact-mode/CompactModeToggle.tsx
src/styles/compact-mode.css

# 2. Import CSS in your main file
# Add to src/index.css:
@import './styles/compact-mode.css';

# 3. Add toggle to navbar
# In src/components/common/layout-container/top-navbar.tsx/navbar.tsx
import { CompactModeToggle } from '@/components/compact-mode/CompactModeToggle';

// In the navbar JSX, add:
<CompactModeToggle variant="icon" />

# 4. Test it!
pnpm run dev
```

## 📖 Common Patterns

### Pattern 1: Conditional Classes
```tsx
import { useCompactMode } from '@/hooks/use-compact-mode';
import { cn } from '@/lib/utils';

function MyComponent() {
  const { isCompact } = useCompactMode();
  
  return (
    <div className={cn(
      isCompact ? 'p-3 gap-2 text-sm' : 'p-6 gap-4 text-base'
    )}>
      Content
    </div>
  );
}
```

### Pattern 2: Using Constants
```tsx
import { useCompactMode, COMPACT_MODE } from '@/hooks/use-compact-mode';

function MyButton() {
  const { isCompact } = useCompactMode();
  
  const classes = isCompact 
    ? COMPACT_MODE.COMPONENTS.BUTTON.medium.compact 
    : COMPACT_MODE.COMPONENTS.BUTTON.medium.default;
  
  return <button className={classes}>Click Me</button>;
}
```

### Pattern 3: Wrapper Component
```tsx
import { useCompactMode } from '@/hooks/use-compact-mode';

export function CompactWrapper({ children }) {
  const { isCompact } = useCompactMode();
  
  return (
    <div className={isCompact ? 'compact-mode' : ''}>
      {children}
    </div>
  );
}
```

## 🎯 URL Methods

```bash
# Method 1: Query Parameter (Primary)
http://localhost:5173/dashboard?compact=true

# Method 2: Route Prefix (Optional, needs setup)
http://localhost:5173/cm/dashboard

# Method 3: User Preference (Saved automatically)
# Toggle in UI → Saves to localStorage → Applied everywhere
```

## 🎨 Size Reference

| Component | Default | Compact |
|-----------|---------|---------|
| Sidebar Width | 307px | 220px |
| Navbar Height | 72px | 48px |
| Card Padding | 24px | 12px |
| Button Height | 44px | 36px |
| Input Height | 48px | 36px |
| Body Text | 16px | 14px |
| H1 | 30px | 24px |
| Icon | 20px | 16px |
| Avatar | 40px | 32px |

## 🔧 Integration Checklist

- [ ] Import CSS in `src/index.css`
- [ ] Add toggle to navbar
- [ ] Update `LayoutContainer` with `useCompactMode`
- [ ] Update `Sidebar` component sizing
- [ ] Update `Navbar` component height
- [ ] Test toggle functionality
- [ ] Test on mobile (should ignore compact)
- [ ] Add to settings page (optional)
- [ ] Save preference to backend (optional)

## 💡 Pro Tips

1. **Mobile Auto-Ignores**: Compact mode automatically uses normal spacing on mobile
2. **Smooth Transitions**: CSS transitions make switching smooth
3. **Accessible**: Maintains minimum touch target sizes
4. **Shareable**: URLs with `?compact=true` preserve mode
5. **Preference Persists**: User choice saved in localStorage

## 🐛 Troubleshooting

### Toggle doesn't appear
- Check if you imported the component correctly
- Verify the toggle is inside the navbar JSX

### Styles not applying
- Make sure `compact-mode.css` is imported in `index.css`
- Check browser console for CSS errors

### Mobile still shows compact
- This shouldn't happen - compact mode is disabled on mobile
- Check `@media (max-width: 768px)` in CSS

### Toggle works but nothing changes visually
- Did you update components to use `useCompactMode`?
- Start with updating Sidebar and Navbar first

## 📚 Documentation

- Full Plan: `COMPACT_MODE_IMPLEMENTATION_PLAN.md`
- Visual Comparison: `COMPACT_MODE_VISUAL_COMPARISON.md`
- Summary: `COMPACT_MODE_SUMMARY.md`
- This Card: `COMPACT_MODE_QUICK_REFERENCE.md`

## 🎉 You're Ready!

The compact mode system is now integrated. Users can toggle between comfortable default spacing and dense enterprise layout with a single click!
