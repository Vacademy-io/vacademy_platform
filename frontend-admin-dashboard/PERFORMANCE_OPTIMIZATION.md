# 🚀 Admin Dashboard Performance Optimization Strategy

## Overview
This document outlines a phased approach to reduce the initial bundle size from **20+ MB** to under **5 MB** for faster loading times.

**Starting State (Before Optimization):**
- Main bundle: 25 MB (uncompressed)
- Total JS: 36.28 MB
- Transfer size with Brotli: ~3-5 MB (estimated)

**Current State (After Phase 2 - Batch 2):**
- Main bundle: **17 MB** (reduced by 8 MB / 32%)
- 31 routes now lazy loaded
- Lazy chunks created: ~2.3 MB moved to on-demand loading
- Key lazy chunks: Dashboard (213 KB), Announcement History (1.1 MB), Teams (344 KB), Settings (142 KB)

**Target State:**
- Main bundle: < 5 MB
- Initial route: < 1 MB
- Time to Interactive: < 3 seconds on 4G

---

## Phase 1: Analysis & Quick Wins ✅ (Completed)

### 1.1 ✅ Vendor Chunk Splitting
- Added 20+ vendor chunks for heavy libraries
- Separated: Excalidraw, GrapesJS, Mermaid, PDF tools, editors, charts, etc.
- **Result**: Main bundle reduced from 25 MB → 20.2 MB

### 1.2 ✅ Bundle Analyzer Setup
- Added `rollup-plugin-visualizer` to generate `dist/stats.html`
- Run `pnpm build` to generate the analysis

### 1.3 ✅ Verified Server Compression
- Cloudflare serves with Brotli compression
- ~80-90% size reduction in transfer

---

## Phase 2: Route-Level Code Splitting 🔄 (In Progress)

### Goal
Convert major routes to use TanStack Router's lazy loading to defer loading route components until navigation.

### ✅ Routes Converted to Lazy Loading (31 total):
| Route | Lazy Chunk Size | Status |
|-------|-----------------|--------|
| `/dashboard` | 213 KB | ✅ Done |
| `/study-library/courses` | 41 KB | ✅ Done |
| `/ai-center` | 3.4 KB | ✅ Done |
| `/ai-center/ai-tools` | 20 KB | ✅ Done |
| `/settings` | 142 KB | ✅ Done |
| `/instructor-copilot` | 48 KB | ✅ Done |
| `/manage-payments` | 15 KB | ✅ Done |
| `/community` | 4 KB | ✅ Done |
| `/assessment/assessment-list` | 20 KB | ✅ Done |
| `/assessment/question-papers` | 15 KB | ✅ Done |
| `/manage-students/students-list` | 12 KB | ✅ Done |
| `/manage-institute/batches` | 8 KB | ✅ Done |
| `/manage-institute/sessions` | 11 KB | ✅ Done |
| `/manage-institute/teams` | 344 KB | ✅ Done |
| `/announcement/history` | 1.1 MB | ✅ Done |
| `/planning/planning` | 12 KB | ✅ Done |
| `/membership-expiry` | 15 KB | ✅ Done |
| `/membership-stats` | 18 KB | ✅ Done |
| `/manage-contacts` | 5 KB | ✅ Done |
| `/evaluator-ai` | 20 KB | ✅ Done |
| `/evaluator-ai/evaluation` | ~8 KB | ✅ Done |
| `/evaluation/evaluations` | ~5 KB | ✅ Done |
| `/slides (course details)` | 10 KB | ✅ Done |
| `/certificate-generation/student-data` | ~8 KB | ✅ Done |
| `/audience-manager/list` | 10 KB | ✅ Done |
| `/homework-creation/assessment-list` | ~8 KB | ✅ Done |
| `/templates/create` | ~5 KB | ✅ Done |
| `/learner-insights` | 11 KB | ✅ Done |
| `/pricing` | 5 KB | ✅ Done |
| `/landing` | 9 KB | ✅ Done |

### Routes to Convert (Priority Order)

| Priority | Route | File | Reason |
|----------|-------|------|--------|
| 1 | Dashboard | `/dashboard/index.tsx` | First page after login (~48KB) |
| 2 | Study Library Courses | `/study-library/courses/index.tsx` | Heavy component |
| 3 | AI Center | `/ai-center/index.tsx` | AI tools (heavy deps) |
| 4 | Settings | `/settings/index.tsx` | Firebase, many tabs |
| 5 | Assessment List | `/assessment/assessment-list/index.tsx` | Tables, heavy |
| 6 | Slides Editor | `.../slides/index.tsx` | Excalidraw (374KB) |
| 7 | Template Editor | `/templates/...` | GrapesJS (1MB) |
| 8 | Instructor Copilot | `/instructor-copilot/index.tsx` | New feature |

### Implementation Pattern

**Step 1: Create minimal route file (keeps auth/loaders):**
```tsx
// /routes/dashboard/index.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/')({
    // Keep loaders, beforeLoad, validateSearch here
});
```

**Step 2: Create lazy file with component:**
```tsx
// /routes/dashboard/index.lazy.tsx
import { createLazyFileRoute } from '@tanstack/react-router';
// All imports here are lazy loaded
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
// ... rest of imports

export const Route = createLazyFileRoute('/dashboard/')({
    component: DashboardPage,
});

function DashboardPage() {
    // Full component implementation
}
```

---

## Phase 3: Component-Level Lazy Loading (MEDIUM IMPACT)

### Heavy Components to Lazy Load

These components should use `React.lazy()` with `Suspense`:

| Component | Size | Where Used |
|-----------|------|------------|
| `SlideEditor` (Excalidraw) | 374 KB | Slides page |
| `TemplateEditorGrapes` | 54 KB + 1 MB vendor | Email templates |
| PDF Viewer | ~2 MB vendor | Various |
| Monaco Editor | Large | Code editing |
| Quill/TipTap Editors | 200-365 KB | Rich text |
| Chart Components | 445 KB | Dashboard, reports |

### Implementation Pattern

```tsx
// Before
import { SlideEditor } from './SlideEditor';

// After
import { lazy, Suspense } from 'react';
const SlideEditor = lazy(() => import('./SlideEditor'));

// Usage
<Suspense fallback={<Skeleton className="h-[600px]" />}>
    <SlideEditor {...props} />
</Suspense>
```

---

## Phase 4: Dependency Optimization (LOW-MEDIUM IMPACT)

### 4.1 Icon Library Consolidation
Currently using multiple icon libraries:
- `phosphor-react` (legacy)
- `@phosphor-icons/react` (new)
- `lucide-react`
- `react-icons`

**Action**: Standardize on `@phosphor-icons/react` and migrate others.

### 4.2 Remove Unused Dependencies
Review and remove if unused:
- `jquery` (172 KB) - Legacy?
- `emailjs-com` - Deprecated, use `@emailjs/browser`
- `react-scripts` - Not needed with Vite
- `pnpm` as dependency (should be devDependency only)

### 4.3 Replace Heavy Libraries
- `lodash` → `lodash-es` (tree-shakable)
- Check if `mammoth` (docx) is needed everywhere

---

## Phase 5: Build Optimization (LOW IMPACT)

### 5.1 Enable Tree Shaking Hints
Add `sideEffects: false` to package.json for proper tree-shaking.

### 5.2 Optimize Imports
Use specific imports instead of barrel exports:
```tsx
// Bad
import { Button, Card, Dialog } from '@/components/ui';

// Good
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
```

---

## Execution Plan

### Today's Session
1. ✅ Phase 1 completed
2. → Run build with analyzer
3. → Convert Dashboard route to lazy loading (demonstration)
4. → Convert 2-3 more critical routes

### Follow-up Tasks
- Convert remaining routes (Phase 2)
- Lazy load heavy components (Phase 3)
- Dependency cleanup (Phase 4)

---

## Commands

```bash
# Build with analysis
pnpm build

# View bundle analysis
open dist/stats.html

# Check bundle sizes
ls -lh dist/assets/*.js | sort -k5 -rn | head -20
```

---

## Success Metrics

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| Main bundle | 20 MB | < 3 MB | Route splitting |
| Initial load JS | 20 MB | < 1 MB | Lazy loading |
| LCP | Slow | < 2.5s | Code splitting |
| TTI | Slow | < 3s | Defer non-critical |

---

## Notes

- Always test after each change
- Check that all routes still work
- Monitor for any console errors
- Use Chrome DevTools Network tab to verify
