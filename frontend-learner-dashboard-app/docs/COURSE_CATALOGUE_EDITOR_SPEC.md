# Course Catalogue JSON Editor - Admin Portal Specification

> **Version:** 2.0
> **Last Updated:** 2026-03-25
> **Status:** Active

---

## 1. Overview

### 1.1 Purpose

A visual editor in the admin portal that allows administrators to create, edit, and manage course catalogue JSON configurations. The editor provides a no-code/low-code interface with live preview capabilities, drag-and-drop functionality, and form-based component configuration.

### 1.2 Key Features

- **Visual Page Builder** with drag-and-drop components
- **Live Preview** via iframe (Desktop/Tablet/Mobile viewports)
- **Form-based Component Editors** for each component type
- **Advanced JSON Editor** for power users
- **Multi-Tag Management** (courses, books, products)
- **Component Library** with pre-built components
- **Component Duplication** and reordering

---

## 2. Architecture

### 2.1 Tech Stack

| Layer            | Technology                           |
| ---------------- | ------------------------------------ |
| Framework        | React (existing admin dashboard)     |
| UI Library       | ShadCN/ui                            |
| State Management | Zustand or React Context             |
| Drag & Drop      | @dnd-kit/core or react-beautiful-dnd |
| Form Handling    | react-hook-form + zod validation     |
| JSON Editor      | @monaco-editor/react                 |
| Preview          | iframe pointing to learner app       |

### 2.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Admin Portal                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Component   │───▶│    JSON      │───▶│   Live Preview   │  │
│  │   Editor     │    │    State     │    │   (iframe)       │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│         │                   │                      │            │
│         │                   ▼                      │            │
│         │            ┌──────────────┐              │            │
│         └───────────▶│  Save API    │◀─────────────┘            │
│                      └──────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. UI Layout

### 3.1 Main Editor Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Catalogue Editor - [Tag Name Dropdown] ▼        [Save] [Preview] [JSON]│
├────────────────┬────────────────────────────────┬───────────────────────┤
│                │                                │                       │
│   Component    │      Canvas / Page View        │   Property Panel      │
│   Library      │                                │                       │
│                │  ┌──────────────────────────┐  │   ┌───────────────┐   │
│  ┌──────────┐  │  │      Header              │  │   │ Component:    │   │
│  │ Header   │  │  └──────────────────────────┘  │   │ Header        │   │
│  ├──────────┤  │  ┌──────────────────────────┐  │   ├───────────────┤   │
│  │ Hero     │  │  │      Hero Section        │  │   │ Logo URL      │   │
│  ├──────────┤  │  └──────────────────────────┘  │   │ [________]    │   │
│  │ Catalog  │  │  ┌──────────────────────────┐  │   │               │   │
│  ├──────────┤  │  │      Course Catalog      │  │   │ Navigation    │   │
│  │ Cart     │  │  └──────────────────────────┘  │   │ + Add Item    │   │
│  ├──────────┤  │  ┌──────────────────────────┐  │   │               │   │
│  │ Footer   │  │  │      Footer              │  │   │ [Form fields] │   │
│  ├──────────┤  │  └──────────────────────────┘  │   │               │   │
│  │ Media    │  │                                │   └───────────────┘   │
│  │ Showcase │  │                                │                       │
│  ├──────────┤  │                                │                       │
│  │ Stats    │  │                                │                       │
│  └──────────┘  │                                │                       │
│                │                                │                       │
├────────────────┴────────────────────────────────┴───────────────────────┤
│  Pages: [Homepage] [Details] [Cart] [Buy/Rent] [+ Add Page]             │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Viewport Toggles

```
┌─────────────────────────────────────────────────┐
│  Preview Viewport:  [🖥 Desktop] [📱 Tablet] [📱 Mobile] │
│  Zoom: [100%] ▼                                 │
└─────────────────────────────────────────────────┘
```

---

## 4. Component Library

### 4.1 Available Components

| Component        | Type Key             | Description                                   |
| ---------------- | -------------------- | --------------------------------------------- |
| Header           | `header`             | Site header with logo, navigation, auth links |
| Footer           | `footer`             | Site footer with columns and social links     |
| Hero Section     | `heroSection`        | Banner with image, title, CTA                 |
| Course Catalog   | `courseCatalog`      | Grid/list of courses with filters             |
| Book Catalogue   | `bookCatalogue`      | Grid/list of books with filters               |
| Book Details     | `bookDetails`        | Single book detail page                       |
| Cart Component   | `cartComponent`      | Shopping cart display                         |
| Buy/Rent Section | `buyRentSection`     | Mode selection component                      |
| Media Showcase   | `mediaShowcase`      | Image/video slider                            |
| Stats Highlights | `statsHighlights`    | Statistics display                            |
| Testimonials     | `testimonialSection` | Customer reviews carousel                     |
| Banner           | `banner`             | Simple banner component                       |
| Policy Renderer  | `policyRenderer`     | HTML policy content                           |

---

## 5. Component Editor Schemas

### 5.1 Global Settings Editor

```typescript
interface GlobalSettingsForm {
  // Catalogue Type
  courseCatalogeType: {
    enabled: boolean; // Toggle: Is this a product catalog?
    value: "Course" | "Product"; // Dropdown
  };

  // Theme
  mode: "light" | "dark"; // Toggle switch

  // Typography
  fonts: {
    enabled: boolean; // Toggle
    family: string; // Dropdown: Google Fonts list
  };

  // Layout
  compactness: "small" | "medium" | "large"; // Radio buttons
  audience: "children" | "adults" | "all"; // Dropdown

  // Lead Collection
  leadCollection: {
    enabled: boolean; // Toggle
    mandatory: boolean; // Toggle (shown if enabled)
    inviteLink: string | null; // Text input
    formStyle: {
      type: "single" | "multiStep"; // Radio
      showProgress: boolean; // Toggle
      progressType: "bar" | "dots" | "steps"; // Dropdown
      transition: "slide" | "fade"; // Dropdown
    };
    fields: LeadField[]; // Dynamic array editor
  };

  // Payment
  payment: {
    enabled: boolean; // Toggle
    provider: "razorpay" | "stripe" | "paypal" | "PHONEPE"; // Dropdown
    fields: string[]; // Checkbox group
  };
}
```

### 5.2 Header Component Editor

```typescript
interface HeaderEditorForm {
  id: string; // Auto-generated, readonly
  type: "header"; // Readonly
  enabled: boolean; // Toggle

  props: {
    logo: string; // URL input with preview
    title: string; // Text input

    navigation: Array<{
      // Sortable list
      label: string; // Text input
      route: string; // Text input or page selector
      openInSameTab: boolean; // Toggle
    }>;

    authLinks: Array<{
      // Sortable list
      label: string; // Text input
      route: string; // Text input
    }>;
  };
}
```

**UI Representation:**

```
┌─────────────────────────────────────────────────┐
│ Header Component                          [✓]   │
├─────────────────────────────────────────────────┤
│ Logo URL                                        │
│ ┌─────────────────────────────────────────────┐ │
│ │ https://example.com/logo.png                │ │
│ └─────────────────────────────────────────────┘ │
│ [Preview] 🖼️ [logo thumbnail]                   │
│                                                 │
│ Title                                           │
│ ┌─────────────────────────────────────────────┐ │
│ │ Learning Platform                           │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Navigation Items                    [+ Add]     │
│ ┌─────────────────────────────────────────────┐ │
│ │ ≡ Home      | homepage    | ☐ New Tab  [🗑] │ │
│ │ ≡ Plan      | buy-rent    | ☐ New Tab  [🗑] │ │
│ │ ≡ Cart      | cart        | ☐ New Tab  [🗑] │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Auth Links                          [+ Add]     │
│ ┌─────────────────────────────────────────────┐ │
│ │ Signup | signup                        [🗑] │ │
│ │ Login  | login                         [🗑] │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 5.3 Footer Component Editor

```typescript
interface FooterEditorForm {
  enabled: boolean;
  props: {
    layout: "two-column" | "three-column" | "four-column"; // Visual selector

    leftSection: {
      title: string;
      text: string; // Textarea
      socials: Array<{
        // Sortable list
        platform: string; // Dropdown: Facebook, Instagram, etc.
        icon: string; // Auto-filled based on platform
        url: string;
        openInSameTab: boolean;
      }>;
    };

    rightSection1?: FooterLinkSection;
    rightSection2?: FooterLinkSection;
    rightSection3?: FooterLinkSection;

    bottomNote: string;
  };
}

interface FooterLinkSection {
  title: string;
  links: Array<{
    label: string;
    route: string;
    openInSameTab: boolean;
  }>;
}
```

### 5.4 Hero Section Editor

```typescript
interface HeroSectionEditorForm {
  enabled: boolean;
  props: {
    layout: "split" | "centered" | "fullwidth"; // Visual selector with preview
    backgroundImage: string; // URL input
    backgroundColor: string; // Color picker

    left: {
      title: string;
      description: string; // Textarea or rich text
      button: {
        enabled: boolean;
        text: string;
        action: "navigate" | "enroll" | "openLeadCollection";
        target: string; // Page selector or URL
        backgroundColor: string; // Color picker
      };
    };

    right: {
      image: string; // URL input with preview
      alt: string;
    };

    styles: {
      padding: string; // Spacing selector
      roundedEdges: boolean;
      textAlign: "left" | "center" | "right";
    };
  };
}
```

### 5.5 Course Catalog Editor

```typescript
interface CourseCatalogEditorForm {
  enabled: boolean;
  props: {
    title: string;
    showFilters: boolean;

    filtersConfig: Array<{
      // Dynamic array
      id: string; // Auto-generated
      label: string;
      type: "checkbox" | "dropdown" | "range" | "chips";
      field: string; // Dropdown: level_name, price, genre, etc.
      options?: string[]; // For chips type
      default?: {
        min?: number;
        max?: number;
      };
    }>;

    cartButtonConfig: {
      enabled: boolean;
      showAddToCartButton: boolean;
      showQuantitySelector: boolean;
      quantityMin: number;
    };

    render: {
      layout: "grid" | "list"; // Visual toggle
      cardFields: string[]; // Checkbox group
      styles: {
        hoverEffect: "scale" | "shadow" | "none";
        roundedEdges: boolean;
        backgroundColor: string;
      };
    };
  };
}
```

**Card Fields Checkbox Group:**

```
┌─────────────────────────────────────────────────┐
│ Card Display Fields           [Select All]      │
├─────────────────────────────────────────────────┤
│ ☑ Package Name (package_name)                   │
│ ☑ Description (course_html_description_html)    │
│ ☑ Preview Image (course_preview_image_media_id) │
│ ☑ Level (level_name)                            │
│ ☑ Rating (rating)                               │
│ ☑ Price (price)                                 │
│ ☐ Duration (read_time_in_minutes)               │
│ ☐ Quantity Selector (quantity)                  │
│ ☐ Cart Actions (cart_actions)                   │
└─────────────────────────────────────────────────┘
```

### 5.6 Media Showcase / Slider Editor

```typescript
interface MediaShowcaseEditorForm {
  enabled: boolean;
  showCondition?: {
    field: string; // Dropdown of globalSettings paths
    value: boolean | string;
  };

  props: {
    layout: "slider" | "carousel" | "grid";
    autoplay: boolean;
    autoplayInterval: number; // Slider: 1000-10000ms

    slides: Array<{
      // Sortable array with visual cards
      backgroundImage: string; // URL input with preview
      heading: string;
      description: string;
      button: {
        enabled: boolean;
        text: string;
        action: "navigate";
        target: string; // Page selector
      };
    }>;
  };
}
```

**Slide Editor UI:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Slides                                              [+ Add Slide]│
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ≡  Slide 1                                     [⬆][⬇][🗑]  │ │
│ │    ┌──────────────┐                                         │ │
│ │    │   [Image]    │  Heading: Discover Your Next...         │ │
│ │    │   Preview    │  Description: Explore thousands...      │ │
│ │    └──────────────┘  Button: ☐ Enabled                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ≡  Slide 2                                     [⬆][⬇][🗑]  │ │
│ │    ...                                                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 5.7 Cart Component Editor

```typescript
interface CartComponentEditorForm {
  enabled: boolean;
  props: {
    showItemImage: boolean;
    showItemTitle: boolean;
    showItemLevel: boolean;
    showQuantitySelector: boolean;
    quantityMin: number;
    showRemoveButton: boolean;
    showPrice: boolean;
    showEmptyState: boolean;
    emptyStateMessage: string;

    styles: {
      padding: string;
      roundedEdges: boolean;
      backgroundColor: string;
    };
  };
}
```

### 5.8 Buy/Rent Section Editor

```typescript
interface BuyRentSectionEditorForm {
  enabled: boolean;
  props: {
    heading: string;

    buy: {
      buttonLabel: string;
      levelFilterValue: string; // e.g., "Buy"
      targetRoute: string; // Page selector
    };

    rent: {
      buttonLabel: string;
      levelFilterValue: string; // e.g., "Rent"
      targetRoute: string;
    };
  };
}
```

### 5.9 Policy Renderer Editor

```typescript
interface PolicyRendererEditorForm {
  enabled: boolean;
  props: {
    policies: Record<
      string,
      {
        title: string;
        content: string; // Rich text / HTML editor
      }
    >;
  };
}
```

### 5.10 Testimonials Editor

```typescript
interface TestimonialsEditorForm {
  enabled: boolean;
  props: {
    headerText: string;
    description: string;
    layout: "grid-scroll" | "carousel" | "static-grid";

    testimonials: Array<{
      // Sortable cards
      name: string;
      role: string; // Textarea for multiline
      feedback: string; // Textarea
      avatar: string; // URL with preview
    }>;

    styles: {
      backgroundColor: string;
      roundedEdges: boolean;
      cardHoverEffect: "lift" | "scale" | "none";
      scrollEnabled: boolean;
    };
  };
}
```

### 5.11 Stats Highlights Editor

```typescript
interface StatsHighlightsEditorForm {
  enabled: boolean;
  props: {
    headerText: string;

    // Simple stats mode
    stats?: Array<{
      label: string;
      value: string;
    }>;

    // Grouped stats mode (for complex layouts)
    groups?: Array<{
      description: string;
      stats: Array<{
        label: string;
        value?: string;
      }>;
    }>;

    style: "circle" | "card" | "minimal";
    styles: {
      backgroundColor: string;
      textColor: string;
      hoverEffect: "scale" | "none";
    };
  };
}
```

---

## 6. Page Management

### 6.1 Page Structure

```typescript
interface PageEditorForm {
  id: string; // Auto-generated or custom
  route: string; // URL slug (validated for uniqueness)
  title?: string; // Optional page title
  components: ComponentReference[]; // Drag-drop sortable list
}
```

### 6.2 Page Actions

- **Add Page**: Create new page with empty component list
- **Duplicate Page**: Clone existing page with new ID
- **Delete Page**: Remove page (with confirmation)
- **Reorder Pages**: Drag-drop in page tabs

### 6.3 Reserved Routes

```
homepage     - Main landing page
cart         - Shopping cart
buy-rent     - Mode selection
course-details / books-details - Dynamic detail pages
```

---

## 7. Live Preview System

### 7.1 Implementation

```typescript
// Preview URL construction
const previewUrl = `${LEARNER_APP_URL}/${tagName}?preview=true&config=${encodeURIComponent(
  JSON.stringify(currentConfig)
)}`;

// Or use postMessage for real-time updates
iframe.contentWindow.postMessage(
  {
    type: "CATALOGUE_CONFIG_UPDATE",
    payload: currentConfig,
  },
  LEARNER_APP_URL
);
```

### 7.2 Viewport Sizes

| Viewport | Width  | Height |
| -------- | ------ | ------ |
| Desktop  | 1440px | 900px  |
| Tablet   | 768px  | 1024px |
| Mobile   | 375px  | 667px  |

### 7.3 Preview Toolbar

```
┌───────────────────────────────────────────────────────────────┐
│ [🖥 Desktop] [📱 Tablet] [📱 Mobile]  |  Zoom: [100%] ▼  [↗ Open in New Tab] │
└───────────────────────────────────────────────────────────────┘
```

---

## 8. JSON Editor Mode

### 8.1 Features

- **Monaco Editor** with JSON syntax highlighting
- **Schema Validation** with inline errors
- **Auto-formatting** (Prettier)
- **Search & Replace**
- **Collapse/Expand** JSON nodes

### 8.2 Toggle Between Modes

```
┌─────────────────────────────────────────┐
│ Editor Mode:  [🎨 Visual] | [{ } Code]  │
└─────────────────────────────────────────┘
```

### 8.3 Validation Errors Display

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Validation Errors (2)                                    │
├─────────────────────────────────────────────────────────────┤
│ Line 45: globalSettings.payment.provider must be one of:    │
│          razorpay, stripe, paypal, PHONEPE                  │
│                                                             │
│ Line 128: pages[2].components[0].props.layout is required   │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. API Integration

### 9.1 Endpoints

```typescript
// Get catalogue config
GET /admin-core-service/course-catalogue/v1/institute/{instituteId}/tag/{tagName}

// Save catalogue config
PUT /admin-core-service/course-catalogue/v1/institute/{instituteId}/tag/{tagName}
Body: {
  catalogue_json: string  // Stringified JSON config
}

// List all tags for institute
GET /admin-core-service/course-catalogue/v1/institute/{instituteId}/tags

// Create new tag
POST /admin-core-service/course-catalogue/v1/institute/{instituteId}/tag
Body: {
  tagName: string,
  catalogue_json: string
}

// Delete tag
DELETE /admin-core-service/course-catalogue/v1/institute/{instituteId}/tag/{tagName}
```

---

## 10. Component Templates

### 10.1 Default Component Configs

When dragging a new component, use these defaults:

```typescript
const componentTemplates = {
  header: {
    id: generateId(),
    type: "header",
    enabled: true,
    props: {
      logo: "",
      title: "My Platform",
      navigation: [{ label: "Home", route: "homepage", openInSameTab: true }],
      authLinks: [{ label: "Login", route: "login" }],
    },
  },

  heroSection: {
    id: generateId(),
    type: "heroSection",
    enabled: true,
    props: {
      layout: "split",
      backgroundColor: "#F8FAFC",
      left: {
        title: "Welcome to Our Platform",
        description: "Start your learning journey today.",
        button: {
          enabled: false,
          text: "Get Started",
          action: "navigate",
          target: "",
        },
      },
      right: { image: "", alt: "Hero image" },
      styles: { padding: "40px", roundedEdges: true, textAlign: "left" },
    },
  },

  courseCatalog: {
    id: generateId(),
    type: "courseCatalog",
    enabled: true,
    props: {
      title: "Our Courses",
      showFilters: true,
      filtersConfig: [
        { id: "level", label: "Level", type: "checkbox", field: "level_name" },
      ],
      render: {
        layout: "grid",
        cardFields: ["package_name", "course_preview_image_media_id", "price"],
        styles: {
          hoverEffect: "shadow",
          roundedEdges: true,
          backgroundColor: "#FFFFFF",
        },
      },
    },
  },

  // ... other component templates
};
```

---

## 11. File Structure (Admin Portal)

```
src/routes/catalogue-editor/
├── index.tsx                    # Main route
├── -components/
│   ├── CatalogueEditor.tsx     # Main editor container
│   ├── ComponentLibrary.tsx    # Left sidebar
│   ├── PageCanvas.tsx          # Center canvas
│   ├── PropertyPanel.tsx       # Right sidebar
│   ├── PreviewPanel.tsx        # Live preview iframe
│   ├── PageTabs.tsx            # Bottom page tabs
│   ├── JsonEditorPanel.tsx     # Monaco editor
│   └── editors/                # Component-specific editors
│       ├── HeaderEditor.tsx
│       ├── FooterEditor.tsx
│       ├── HeroSectionEditor.tsx
│       ├── CourseCatalogEditor.tsx
│       ├── CartComponentEditor.tsx
│       ├── MediaShowcaseEditor.tsx
│       ├── TestimonialsEditor.tsx
│       ├── StatsEditor.tsx
│       ├── BuyRentEditor.tsx
│       ├── PolicyEditor.tsx
│       └── GlobalSettingsEditor.tsx
├── -hooks/
│   ├── useCatalogueState.ts    # Zustand store
│   ├── useDragDrop.ts          # DnD logic
│   └── usePreview.ts           # Preview communication
├── -types/
│   └── editor-types.ts         # TypeScript interfaces
├── -utils/
│   ├── component-templates.ts  # Default templates
│   ├── validation.ts           # Zod schemas
│   └── id-generator.ts
└── -services/
    └── catalogue-api.ts        # API calls
```

---

## 12. User Flows

### 12.1 Creating New Catalogue

1. Admin navigates to Catalogue Editor
2. Clicks "Create New Tag"
3. Enters tag name (e.g., "books", "courses")
4. System creates with default template
5. Admin customizes using visual editor
6. Clicks Save

### 12.2 Editing Existing Catalogue

1. Admin selects tag from dropdown
2. Existing config loads into editor
3. Admin modifies components/settings
4. Changes reflect in live preview
5. Admin saves changes

### 12.3 Adding New Component

1. Admin drags component from library
2. Drops onto canvas at desired position
3. Component appears with default values
4. Property panel opens for editing
5. Admin fills in required fields

### 12.4 Reordering Components

1. Admin hovers over component in canvas
2. Drag handle appears
3. Admin drags to new position
4. Drop indicator shows placement
5. Component moves on drop

---

## 13. Validation Rules

### 13.1 Required Fields

- `globalSettings.mode` is required
- Each page must have `id` and `route`
- Each component must have `id`, `type`, `enabled`
- Header `logo` should be valid URL if provided
- Footer must have at least `leftSection`

### 13.2 Route Validation

- Routes must be unique within catalogue
- Routes can only contain: a-z, 0-9, -, &
- Reserved routes cannot be deleted

### 13.3 URL Validation

- Image URLs must be valid HTTP/HTTPS URLs
- External routes must start with http:// or https://

---

## 14. Keyboard Shortcuts

| Shortcut               | Action                    |
| ---------------------- | ------------------------- |
| `Ctrl/Cmd + S`         | Save                      |
| `Ctrl/Cmd + Z`         | Undo                      |
| `Ctrl/Cmd + Shift + Z` | Redo                      |
| `Ctrl/Cmd + D`         | Duplicate selected        |
| `Delete`               | Delete selected component |
| `Ctrl/Cmd + P`         | Toggle preview            |
| `Ctrl/Cmd + J`         | Toggle JSON editor        |

---

## 15. Future Enhancements (Post-MVP)

1. **Version History** with rollback
2. **Draft/Published** workflow
3. **Template Library** - save/load reusable templates
4. **Collaboration** - multiple editors with locking
5. **A/B Testing** - variant configurations
6. **Analytics Integration** - track component performance
7. **Media Library** - integrated asset management
8. **Custom CSS** injection
9. **SEO Settings** per page
10. **Localization** - multi-language support

---

## 16. Appendix

### A. Sample Complete JSON Structure

See `course-catalogue-types.ts` in the learner dashboard for the complete TypeScript interface definitions.

### B. Component Icon Mapping

```typescript
const componentIcons = {
  header: "LayoutTop",
  footer: "LayoutBottom",
  heroSection: "Image",
  courseCatalog: "Grid3x3",
  bookCatalogue: "BookOpen",
  cartComponent: "ShoppingCart",
  buyRentSection: "ArrowLeftRight",
  mediaShowcase: "Film",
  statsHighlights: "BarChart",
  testimonialSection: "MessageSquare",
  banner: "PanelTop",
  policyRenderer: "FileText",
};
```

### C. Color Palette Presets

```typescript
const colorPresets = {
  primary: ["#3B82F6", "#2563EB", "#1D4ED8"],
  success: ["#22C55E", "#16A34A", "#15803D"],
  warning: ["#F59E0B", "#D97706", "#B45309"],
  neutral: ["#F8FAFC", "#F1F5F9", "#E2E8F0", "#CBD5E1"],
};
```

---

## 17. Intro Page Editor (Splash Screen)

The intro page is a full-screen splash/welcome screen shown to first-time visitors.

### 17.1 Intro Page Schema

```typescript
interface IntroPageEditorForm {
  enabled: boolean; // Master toggle
  fullScreen: boolean; // Full viewport height
  showHeader: boolean; // Show header on intro

  logo: {
    source: string; // URL input (optional - uses institute logo if empty)
    alt: string; // Alt text
    height: string; // Dropdown: 60px, 80px, 100px, 120px
    alignment: "left" | "center" | "right"; // Radio buttons
  };

  imageSlider: {
    autoPlay: boolean; // Toggle
    interval: number; // Slider: 2000-8000ms
    images: Array<{
      // Sortable card list
      source: string; // URL input with preview
      caption: string; // Text that appears below image
    }>;
    styles: {
      height: string; // Dropdown: 50vh, 60vh, 70vh, 80vh
      objectFit: "contain" | "cover" | "fill" | "none"; // Visual selector
      transitionEffect: "fade" | "slide" | "zoom"; // Visual selector
    };
  };

  actions: {
    alignment: "top" | "center" | "bottom" | "right" | "left"; // Visual picker
    buttons: Array<{
      // Max 3 buttons
      label: string; // Text input
      action: "loadNextSection" | "navigateToLogin" | "openLeadCollection"; // Dropdown
      style: "primary" | "outlined" | "text"; // Visual toggle
    }>;
  };

  afterIntro: {
    action: "loadAllSections" | "navigateToCatalogue"; // Radio
    target: string; // Auto-filled based on action
  };
}
```

### 17.2 Intro Page Editor UI

```
┌─────────────────────────────────────────────────────────────────┐
│ Intro / Splash Page                               [✓ Enabled]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ Display Settings ─────────────────────────────────────────┐  │
│ │ Full Screen: [✓]      Show Header: [ ]                     │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ Logo ─────────────────────────────────────────────────────┐  │
│ │ Source URL: [_________________________________] [Preview]  │  │
│ │ (Leave empty to use institute logo)                        │  │
│ │                                                            │  │
│ │ Height: [80px ▼]    Alignment: ( ) Left (•) Center ( ) Right │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ Image Slider ─────────────────────────────────────────────┐  │
│ │ Auto Play: [✓]     Interval: [──●──────] 3000ms            │  │
│ │                                                            │  │
│ │ Slides:                                      [+ Add Slide] │  │
│ │ ┌────────────────────────────────────────────────────────┐ │  │
│ │ │ ≡ [🖼] slide1.png                                      │ │  │
│ │ │   Caption: "The Smarter Way to Study"        [⬆][⬇][🗑]│ │  │
│ │ ├────────────────────────────────────────────────────────┤ │  │
│ │ │ ≡ [🖼] slide2.png                                      │ │  │
│ │ │   Caption: "Simplifying Tough Topics"        [⬆][⬇][🗑]│ │  │
│ │ └────────────────────────────────────────────────────────┘ │  │
│ │                                                            │  │
│ │ Styles:                                                    │  │
│ │ Height: [70vh ▼]  Object Fit: [contain ▼]  Effect: [fade ▼]│  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ Action Buttons ───────────────────────────────────────────┐  │
│ │ Alignment: [● Bottom] [ Top] [ Center]                     │  │
│ │                                                            │  │
│ │ Buttons:                                      [+ Add] (max 3) │
│ │ ┌────────────────────────────────────────────────────────┐ │  │
│ │ │ Label: [Get Started]                                   │ │  │
│ │ │ Action: [loadNextSection ▼]   Style: [● Primary]       │ │  │
│ │ ├────────────────────────────────────────────────────────┤ │  │
│ │ │ Label: [Login]                                         │ │  │
│ │ │ Action: [navigateToLogin ▼]   Style: [● Outlined]      │ │  │
│ │ └────────────────────────────────────────────────────────┘ │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ After Intro ──────────────────────────────────────────────┐  │
│ │ When intro completes:                                      │  │
│ │ (•) Load all page sections   ( ) Navigate to catalogue    │  │
│ └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 18. Lead Collection Form Builder

The lead collection modal captures user information before showing content.

### 18.1 Lead Collection Schema

```typescript
interface LeadCollectionEditorForm {
  enabled: boolean; // Master toggle
  mandatory: boolean; // Can't be dismissed
  inviteLink: string | null; // Pre-fill from invite system

  formStyle: {
    type: "single" | "multiStep"; // Toggle
    showProgress: boolean; // Toggle (only if multiStep)
    progressType: "bar" | "dots" | "steps"; // Visual selector
    transition: "slide" | "fade"; // Visual selector
  };

  fields: Array<LeadFormField>; // Dynamic sortable array
}

interface LeadFormField {
  name: string; // Internal field name (lowercase, no spaces)
  label: string; // Display label
  type: "text" | "email" | "tel" | "chips" | "dropdown"; // Field type
  required: boolean; // Validation
  step: number; // Step number for multiStep forms
  placeholder?: string; // Placeholder text

  // For chips/dropdown types:
  options?: Array<{
    label: string; // Display text
    value: string; // Stored value
    levelId?: string; // Link to level (for enrollment)
    packageSessionId?: string; // Link to package session
  }>;

  style?: {
    variant: "filled" | "outlined"; // Input style
    chipColor?: string; // Color for chips
    allowMultiple?: boolean; // Multi-select for chips
  };
}
```

### 18.2 Lead Collection Form Builder UI

```
┌─────────────────────────────────────────────────────────────────┐
│ Lead Collection Form                              [✓ Enabled]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ Behavior ─────────────────────────────────────────────────┐  │
│ │ Mandatory (cannot dismiss): [✓]                            │  │
│ │ Invite Link Override: [_______________________________]    │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ Form Style ───────────────────────────────────────────────┐  │
│ │ Type: ( ) Single Page  (•) Multi-Step                      │  │
│ │                                                            │  │
│ │ ┌─ Multi-Step Options (shown when multiStep) ────────────┐ │  │
│ │ │ Show Progress: [✓]                                     │ │  │
│ │ │ Progress Type: [● Bar] [ Dots] [ Steps]                │ │  │
│ │ │ Transition: [● Slide] [ Fade]                          │ │  │
│ │ └────────────────────────────────────────────────────────┘ │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ Form Fields ──────────────────────────────────────────────┐  │
│ │                                               [+ Add Field] │  │
│ │                                                            │  │
│ │ ┌──────────────────────────────────────────────────────┐   │  │
│ │ │ ≡ Step 1: name                              [⬆][⬇][🗑] │   │  │
│ │ │   ┌─ Field Settings ───────────────────────────────┐ │   │  │
│ │ │   │ Name: [name]              Label: [Full Name]   │ │   │  │
│ │ │   │ Type: [text ▼]            Required: [✓]        │ │   │  │
│ │ │   │ Step: [1]                 Placeholder: [...]   │ │   │  │
│ │ │   └────────────────────────────────────────────────┘ │   │  │
│ │ └──────────────────────────────────────────────────────┘   │  │
│ │                                                            │  │
│ │ ┌──────────────────────────────────────────────────────┐   │  │
│ │ │ ≡ Step 2: email                             [⬆][⬇][🗑] │   │  │
│ │ │   Type: [email ▼]  Label: [Email]  Required: [✓]     │   │  │
│ │ └──────────────────────────────────────────────────────┘   │  │
│ │                                                            │  │
│ │ ┌──────────────────────────────────────────────────────┐   │  │
│ │ │ ≡ Step 3: phone                             [⬆][⬇][🗑] │   │  │
│ │ │   Type: [tel ▼]    Label: [Phone]  Required: [✓]     │   │  │
│ │ └──────────────────────────────────────────────────────┘   │  │
│ │                                                            │  │
│ │ ┌──────────────────────────────────────────────────────┐   │  │
│ │ │ ≡ Step 4: Level                             [⬆][⬇][🗑] │   │  │
│ │ │   Type: [chips ▼]  Label: [Select Level]             │   │  │
│ │ │   ┌─ Chip Options ───────────────────────[+ Add]───┐ │   │  │
│ │ │   │ ≡ 8th  | levelId: fd9f... | pkgId: b6d9...  [🗑]│ │   │  │
│ │ │   │ ≡ 9th  | levelId: 5a3c... | pkgId: 17c1...  [🗑]│ │   │  │
│ │ │   │ ≡ 10th | levelId: 2ddc... | pkgId: 1b15...  [🗑]│ │   │  │
│ │ │   └────────────────────────────────────────────────┘ │   │  │
│ │ │   Style:                                             │   │  │
│ │ │   Variant: [outlined ▼]  Chip Color: [🎨 #ED7626]    │   │  │
│ │ │   Allow Multiple: [ ]                                │   │  │
│ │ └──────────────────────────────────────────────────────┘   │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                 │
│ [Preview Form]                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 18.3 Field Type Reference

| Type       | Use Case                   | Validation            |
| ---------- | -------------------------- | --------------------- |
| `text`     | Name, general text         | Min/max length        |
| `email`    | Email address              | Email format          |
| `tel`      | Phone number               | Indian phone format   |
| `chips`    | Level/category selection   | At least one selected |
| `dropdown` | Single selection from list | Required if marked    |

---

## 19. Book Details Component Editor

For product/book detail pages.

### 19.1 Book Details Schema

```typescript
interface BookDetailsEditorForm {
  enabled: boolean;
  props: {
    showEnquiry: boolean; // Show enquiry button
    showPayment: boolean; // Show payment option
    showAddToCart: boolean; // Show add to cart

    fields: {
      title: string; // "package_name"
      description: string; // "about_the_course_html"
      whyLearn: string; // "why_learn_html"
      whoShouldLearn: string; // "who_should_learn_html"
      duration: string; // "read_time_in_minutes"
      level: string; // "level_name"
      tags: string; // "comma_separeted_tags"
      previewImage: string; // "course_preview_image_media_id"
      banner: string; // "course_banner_media_id"
      rating: string; // "rating"
      price: string; // "price"
      cover?: string; // "book_cover_media_id"
    };
  };
}
```

### 19.2 Field Mapping Reference

| Display Field    | API Field Key                   | Description             |
| ---------------- | ------------------------------- | ----------------------- |
| Title            | `package_name`                  | Course/book title       |
| Description      | `about_the_course_html`         | HTML description        |
| Why Learn        | `why_learn_html`                | Benefits section        |
| Who Should Learn | `who_should_learn_html`         | Target audience         |
| Duration         | `read_time_in_minutes`          | Reading/completion time |
| Level            | `level_name`                    | Difficulty level        |
| Tags             | `comma_separeted_tags`          | Category tags           |
| Preview Image    | `course_preview_image_media_id` | Thumbnail               |
| Banner           | `course_banner_media_id`        | Hero banner             |
| Rating           | `rating`                        | Star rating             |
| Price            | `price`                         | Display price           |
| Book Cover       | `book_cover_media_id`           | Cover image             |

---

## 20. Conditional Rendering (showCondition)

Components can be conditionally shown based on global settings.

### 20.1 Schema

```typescript
interface ShowCondition {
  field: string; // Path to globalSettings field
  value: boolean | string; // Expected value
}
```

### 20.2 Editor UI

```
┌─────────────────────────────────────────────────────────────────┐
│ Conditional Display                                             │
├─────────────────────────────────────────────────────────────────┤
│ [ ] Show this component conditionally                           │
│                                                                 │
│ ┌─ Condition (shown when enabled) ───────────────────────────┐  │
│ │ Show when:                                                 │  │
│ │ Field: [globalSettings.courseCatalogeType.enabled ▼]       │  │
│ │ Equals: [true ▼]                                           │  │
│ └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 20.3 Available Condition Fields

```typescript
const conditionFields = [
  "globalSettings.courseCatalogeType.enabled",
  "globalSettings.courseCatalogeType.value",
  "globalSettings.mode",
  "globalSettings.leadCollection.enabled",
  "globalSettings.payment.enabled",
];
```

---

## 21. Undo/Redo System

### 21.1 State Management

```typescript
interface EditorHistoryState {
  past: CatalogueConfig[]; // Previous states
  present: CatalogueConfig; // Current state
  future: CatalogueConfig[]; // Redo states
}

interface EditorActions {
  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // State
  updateConfig: (updater: (config: CatalogueConfig) => CatalogueConfig) => void;
  resetToSaved: () => void;

  // Selection
  selectedComponentId: string | null;
  selectComponent: (id: string | null) => void;
  selectedPageId: string;
  selectPage: (id: string) => void;
}
```

### 21.2 History Limits

| Setting           | Value |
| ----------------- | ----- |
| Max history items | 50    |
| Debounce changes  | 300ms |
| Group rapid edits | Yes   |

---

## 22. Error Handling & Validation

### 22.1 Validation Errors Panel

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Validation Issues (3)                            [Dismiss]   │
├─────────────────────────────────────────────────────────────────┤
│ ❌ Error: Header logo URL is required                           │
│    → Component: header-1 • Field: props.logo                    │
│    [Go to field]                                                │
│                                                                 │
│ ⚠️ Warning: Hero section has no CTA button                      │
│    → Component: hero-1 • Field: props.left.button.enabled       │
│    [Go to field]                                                │
│                                                                 │
│ ℹ️ Info: Footer social links are empty                          │
│    → Component: footer-1 • Field: props.leftSection.socials     │
│    [Go to field]                                                │
└─────────────────────────────────────────────────────────────────┘
```

### 22.2 Validation Rules

```typescript
const validationRules = {
  globalSettings: {
    mode: { required: true, enum: ["light", "dark"] },
    "payment.provider": {
      required: true,
      enum: ["razorpay", "stripe", "paypal", "PHONEPE"],
    },
  },

  header: {
    "props.logo": {
      type: "url",
      required: false,
      pattern: /^https?:\/\/.+/,
    },
    "props.navigation": {
      type: "array",
      minItems: 1,
    },
  },

  heroSection: {
    "props.left.title": { required: true, minLength: 3 },
    "props.right.image": { type: "url" },
  },

  // ... more rules
};
```

### 22.3 Save Validation

```
┌─────────────────────────────────────────────────────────────────┐
│ Unable to Save                                      [✕]         │
├─────────────────────────────────────────────────────────────────┤
│ Please fix the following errors before saving:                  │
│                                                                 │
│ • globalSettings.payment.provider is required                   │
│ • pages[0].components[2].props.title cannot be empty            │
│                                                                 │
│                              [Fix Errors] [Save Anyway (Draft)] │
└─────────────────────────────────────────────────────────────────┘
```

---

## 23. Social Icons Reference

### 23.1 Supported Platforms

| Platform  | Icon Key         | Component           |
| --------- | ---------------- | ------------------- |
| Facebook  | `facebook`       | `<Facebook />`      |
| Instagram | `instagram`      | `<Instagram />`     |
| Twitter/X | `x` or `twitter` | `<Twitter />`       |
| LinkedIn  | `linkedin`       | `<Linkedin />`      |
| YouTube   | `youtube`        | `<Youtube />`       |
| Pinterest | `pinterest`      | `<Pin />`           |
| WhatsApp  | `whatsapp`       | `<MessageCircle />` |

### 23.2 Social Link Editor

```
┌─────────────────────────────────────────────────────────────────┐
│ Social Links                                        [+ Add]     │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Platform: [Instagram ▼]  🔗 Icon auto-selected              │ │
│ │ URL: [https://instagram.com/brand_______________]           │ │
│ │ Open in: (•) New Tab  ( ) Same Tab                 [🗑]     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Platform: [LinkedIn ▼]                                      │ │
│ │ URL: [https://linkedin.com/company/brand_______]            │ │
│ │ Open in: (•) New Tab  ( ) Same Tab                 [🗑]     │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 24. Google Fonts Integration

### 24.1 Curated Font List

```typescript
const fontOptions = [
  { label: "Mulish", value: "Mulish, sans-serif" },
  { label: "Poppins", value: "Poppins, sans-serif" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Open Sans", value: "Open Sans, sans-serif" },
  { label: "Lato", value: "Lato, sans-serif" },
  { label: "Montserrat", value: "Montserrat, sans-serif" },
  { label: "Figtree", value: "Figtree, sans-serif" },
  { label: "Outfit", value: "Outfit, sans-serif" },
  { label: "Nunito", value: "Nunito, sans-serif" },
];
```

### 24.2 Font Preview

```
┌─────────────────────────────────────────────────────────────────┐
│ Typography                                                      │
├─────────────────────────────────────────────────────────────────┤
│ Enable Custom Font: [✓]                                         │
│                                                                 │
│ Font Family: [Poppins ▼]                                        │
│                                                                 │
│ Preview:                                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ The quick brown fox jumps over the lazy dog                │ │
│ │ ABCDEFGHIJKLMNOPQRSTUVWXYZ                                  │ │
│ │ abcdefghijklmnopqrstuvwxyz                                  │ │
│ │ 0123456789                                                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 25. Tag/Catalogue Management

### 25.1 Tag List View

```
┌─────────────────────────────────────────────────────────────────┐
│ Course Catalogues                              [+ Create New]   │
├─────────────────────────────────────────────────────────────────┤
│ Tag Name        │ Status    │ Last Modified  │ Actions         │
│─────────────────┼───────────┼────────────────┼─────────────────│
│ 📦 books        │ 🟢 Active │ 2 hours ago    │ [Edit] [⋮]      │
│ 📚 courses      │ 🟢 Active │ 1 day ago      │ [Edit] [⋮]      │
│ 🛍️ products     │ 🟡 Draft  │ 3 days ago     │ [Edit] [⋮]      │
└─────────────────────────────────────────────────────────────────┘

⋮ Menu:
├── Duplicate
├── Export JSON
├── Import JSON
└── Delete
```

### 25.2 Create New Tag Dialog

```
┌─────────────────────────────────────────────────────────────────┐
│ Create New Catalogue                                   [✕]      │
├─────────────────────────────────────────────────────────────────┤
│ Tag Name: [________________________]                            │
│           (lowercase, no spaces, e.g., "summer-courses")        │
│                                                                 │
│ Start From:                                                     │
│ (•) Blank template                                              │
│ ( ) Duplicate existing: [books ▼]                               │
│ ( ) Import JSON file: [Choose File]                             │
│                                                                 │
│                                      [Cancel] [Create Catalogue]│
└─────────────────────────────────────────────────────────────────┘
```

---

## 26. Accessibility Requirements

### 26.1 Editor Accessibility

| Requirement           | Implementation                             |
| --------------------- | ------------------------------------------ |
| Keyboard navigation   | All controls accessible via Tab            |
| Screen reader support | ARIA labels on all interactive elements    |
| Focus indicators      | Visible focus rings on all focusable items |
| Color contrast        | WCAG AA compliant (4.5:1 ratio)            |
| Error announcements   | Live regions for validation messages       |

### 26.2 Preview Accessibility

All generated catalogues must be:

- Keyboard navigable
- Screen reader friendly
- Mobile touch accessible
- Focusable interactive elements

---

## 27. Performance Considerations

### 27.1 Editor Performance

| Optimization    | Strategy                                |
| --------------- | --------------------------------------- |
| Large JSON      | Virtual scrolling for component lists   |
| Preview updates | Debounce iframe updates (500ms)         |
| Image previews  | Lazy load thumbnails                    |
| Undo history    | Limit to 50 states, compress old states |

### 27.2 Preview Performance

| Optimization         | Strategy                           |
| -------------------- | ---------------------------------- |
| Iframe communication | postMessage instead of URL updates |
| State sync           | Only send changed portions         |
| Initial load         | Show skeleton while loading        |

---

## 28. Testing Checklist

### 28.1 Unit Tests

```typescript
// Component editor tests
describe("HeaderEditor", () => {
  it("renders all form fields");
  it("validates logo URL format");
  it("allows adding/removing navigation items");
  it("reorders navigation items on drag");
  it("updates JSON on field change");
});

// Validation tests
describe("ConfigValidator", () => {
  it("detects missing required fields");
  it("validates URL formats");
  it("validates enum values");
  it("returns field paths for errors");
});
```

### 28.2 Integration Tests

- [ ] Create new catalogue from blank template
- [ ] Add all component types to a page
- [ ] Reorder components via drag-drop
- [ ] Edit component properties
- [ ] Preview updates in real-time
- [ ] Save and reload configuration
- [ ] Export/Import JSON
- [ ] Undo/Redo functionality
- [ ] Switch between Visual and JSON mode

### 28.3 E2E Tests

- [ ] Complete flow: Create → Edit → Preview → Save
- [ ] Multi-page catalogue creation
- [ ] Lead collection form builder
- [ ] Viewport switching (Desktop/Tablet/Mobile)

---

## 29. Required Dependencies (Admin Portal)

### 29.1 NPM Packages

```bash
# Core Dependencies
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
pnpm add @monaco-editor/react monaco-editor
pnpm add zustand immer
pnpm add react-hook-form @hookform/resolvers zod
pnpm add uuid

# Already in ShadCN (verify these exist)
# - @radix-ui/react-dialog
# - @radix-ui/react-tabs
# - @radix-ui/react-toggle
# - @radix-ui/react-tooltip
# - lucide-react
```

### 29.2 Package Versions (Recommended)

```json
{
  "@dnd-kit/core": "^6.1.0",
  "@dnd-kit/sortable": "^8.0.0",
  "@dnd-kit/utilities": "^3.2.2",
  "@monaco-editor/react": "^4.6.0",
  "zustand": "^4.5.0",
  "immer": "^10.0.0",
  "react-hook-form": "^7.50.0",
  "zod": "^3.22.0",
  "uuid": "^9.0.0"
}
```

---

## 30. Environment Variables

### 30.1 Required Variables (Admin Portal)

```env
# Learner App URL for preview iframe
VITE_LEARNER_APP_URL=https://learner.vacademy.io

# API Base URL (likely already exists)
VITE_API_BASE_URL=https://api.vacademy.io

# Optional: Enable preview debug mode
VITE_CATALOGUE_PREVIEW_DEBUG=false
```

### 30.2 Configuration Constants

```typescript
// src/constants/catalogue-editor.ts

export const CATALOGUE_EDITOR_CONFIG = {
  // Preview
  LEARNER_APP_URL:
    import.meta.env.VITE_LEARNER_APP_URL || "http://localhost:5174",
  PREVIEW_DEBOUNCE_MS: 500,

  // History
  MAX_UNDO_HISTORY: 50,
  HISTORY_DEBOUNCE_MS: 300,

  // Validation
  MAX_PAGES: 20,
  MAX_COMPONENTS_PER_PAGE: 30,
  MAX_SLIDES: 10,
  MAX_NAV_ITEMS: 8,
  MAX_TESTIMONIALS: 20,

  // Viewport sizes
  VIEWPORTS: {
    desktop: { width: 1440, height: 900 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 667 },
  },
};
```

---

## 31. Zod Validation Schemas

### 31.1 Global Settings Schema

```typescript
// src/routes/catalogue-editor/-schemas/global-settings.schema.ts

import { z } from "zod";

export const courseCatalogeTypeSchema = z.object({
  enabled: z.boolean(),
  value: z.enum(["Course", "Product"]).optional(),
});

export const fontsSchema = z.object({
  enabled: z.boolean(),
  family: z.string().optional(),
});

export const leadCollectionFieldSchema = z.object({
  name: z.string().min(1, "Field name is required"),
  label: z.string().min(1, "Field label is required"),
  type: z.enum(["text", "email", "tel", "chips", "dropdown"]),
  required: z.boolean(),
  step: z.number().min(1),
  placeholder: z.string().optional(),
  options: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        levelId: z.string().optional(),
        packageSessionId: z.string().optional(),
      })
    )
    .optional(),
  style: z
    .object({
      variant: z.enum(["filled", "outlined"]).optional(),
      chipColor: z.string().optional(),
      allowMultiple: z.boolean().optional(),
    })
    .optional(),
});

export const leadCollectionSchema = z.object({
  enabled: z.boolean(),
  mandatory: z.boolean(),
  inviteLink: z.string().nullable(),
  formStyle: z
    .object({
      type: z.enum(["single", "multiStep"]),
      showProgress: z.boolean(),
      progressType: z.enum(["bar", "dots", "steps"]),
      transition: z.enum(["slide", "fade"]),
    })
    .optional(),
  fields: z.array(leadCollectionFieldSchema),
});

export const paymentSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(["razorpay", "stripe", "paypal", "PHONEPE"]),
  fields: z.array(z.string()),
});

export const globalSettingsSchema = z.object({
  courseCatalogeType: courseCatalogeTypeSchema,
  mode: z.enum(["light", "dark"]),
  fonts: fontsSchema.optional(),
  compactness: z.enum(["small", "medium", "large"]),
  audience: z.enum(["children", "adults", "all"]),
  leadCollection: leadCollectionSchema,
  enrquiry: z.object({
    enabled: z.boolean(),
    requirePayment: z.boolean(),
  }),
  payment: paymentSchema,
  layout: z
    .object({
      header: z.any().optional(),
      footer: z.any().optional(),
    })
    .optional(),
});
```

### 31.2 Component Schemas

```typescript
// src/routes/catalogue-editor/-schemas/components.schema.ts

import { z } from "zod";

const urlSchema = z.string().url().or(z.literal(""));

export const navigationItemSchema = z.object({
  label: z.string().min(1, "Label is required"),
  route: z.string().min(1, "Route is required"),
  openInSameTab: z.boolean().optional(),
});

export const headerPropsSchema = z.object({
  logo: urlSchema.optional(),
  title: z.string().optional(),
  navigation: z
    .array(navigationItemSchema)
    .min(1, "At least one nav item required"),
  authLinks: z
    .array(
      z.object({
        label: z.string(),
        route: z.string(),
      })
    )
    .optional(),
});

export const heroSectionPropsSchema = z.object({
  layout: z.enum(["split", "centered", "fullwidth"]),
  backgroundImage: z.string().optional(),
  backgroundColor: z.string().optional(),
  left: z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    button: z
      .object({
        enabled: z.boolean(),
        text: z.string(),
        action: z.enum(["navigate", "enroll", "openLeadCollection"]),
        target: z.string(),
        backgroundColor: z.string().optional(),
      })
      .optional(),
  }),
  right: z
    .object({
      image: urlSchema.optional(),
      alt: z.string().optional(),
    })
    .optional(),
  styles: z
    .object({
      padding: z.string().optional(),
      roundedEdges: z.boolean().optional(),
      textAlign: z.enum(["left", "center", "right"]).optional(),
    })
    .optional(),
});

export const mediaSlideSchema = z.object({
  backgroundImage: urlSchema,
  heading: z.string().min(1),
  description: z.string(),
  button: z
    .object({
      enabled: z.boolean(),
      text: z.string(),
      action: z.string(),
      target: z.string(),
    })
    .optional(),
});

export const componentSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  enabled: z.boolean(),
  showCondition: z
    .object({
      field: z.string(),
      value: z.union([z.boolean(), z.string()]),
    })
    .optional(),
  props: z.record(z.any()),
});

export const pageSchema = z.object({
  id: z.string().min(1, "Page ID is required"),
  route: z
    .string()
    .min(1, "Route is required")
    .regex(/^[a-z0-9-&]+$/, "Invalid route format"),
  title: z.string().optional(),
  components: z.array(componentSchema),
});

export const catalogueConfigSchema = z.object({
  version: z.string().optional(),
  globalSettings: globalSettingsSchema,
  introPage: z.any().optional(),
  pages: z.array(pageSchema).min(1, "At least one page is required"),
});
```

---

## 32. Zustand Store Structure

### 32.1 Editor Store

```typescript
// src/routes/catalogue-editor/-stores/editor-store.ts

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { CatalogueConfig } from "../-types/editor-types";

interface EditorState {
  // Data
  config: CatalogueConfig | null;
  originalConfig: CatalogueConfig | null; // For dirty checking

  // History
  past: CatalogueConfig[];
  future: CatalogueConfig[];

  // UI State
  selectedPageId: string | null;
  selectedComponentId: string | null;
  activeTab: "visual" | "json";
  previewViewport: "desktop" | "tablet" | "mobile";
  isSaving: boolean;
  validationErrors: ValidationError[];

  // Actions
  setConfig: (config: CatalogueConfig) => void;
  updateConfig: (updater: (config: CatalogueConfig) => void) => void;

  selectPage: (pageId: string) => void;
  selectComponent: (componentId: string | null) => void;

  addPage: (page: Page) => void;
  updatePage: (pageId: string, updates: Partial<Page>) => void;
  deletePage: (pageId: string) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;

  addComponent: (pageId: string, component: Component, index?: number) => void;
  updateComponent: (componentId: string, updates: Partial<Component>) => void;
  deleteComponent: (componentId: string) => void;
  reorderComponents: (
    pageId: string,
    fromIndex: number,
    toIndex: number
  ) => void;
  duplicateComponent: (componentId: string) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  setViewport: (viewport: "desktop" | "tablet" | "mobile") => void;
  setActiveTab: (tab: "visual" | "json") => void;

  validate: () => ValidationError[];
  isDirty: () => boolean;
  reset: () => void;
}

interface ValidationError {
  path: string;
  message: string;
  severity: "error" | "warning" | "info";
}

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    config: null,
    originalConfig: null,
    past: [],
    future: [],
    selectedPageId: null,
    selectedComponentId: null,
    activeTab: "visual",
    previewViewport: "desktop",
    isSaving: false,
    validationErrors: [],

    setConfig: (config) =>
      set((state) => {
        state.config = config;
        state.originalConfig = JSON.parse(JSON.stringify(config));
        state.selectedPageId = config.pages[0]?.id || null;
        state.past = [];
        state.future = [];
      }),

    updateConfig: (updater) =>
      set((state) => {
        if (!state.config) return;

        // Save to history
        state.past.push(JSON.parse(JSON.stringify(state.config)));
        if (state.past.length > 50) state.past.shift();
        state.future = [];

        // Apply update
        updater(state.config);
      }),

    // ... implement other actions

    undo: () =>
      set((state) => {
        if (state.past.length === 0 || !state.config) return;
        state.future.unshift(JSON.parse(JSON.stringify(state.config)));
        state.config = state.past.pop()!;
      }),

    redo: () =>
      set((state) => {
        if (state.future.length === 0 || !state.config) return;
        state.past.push(JSON.parse(JSON.stringify(state.config)));
        state.config = state.future.shift()!;
      }),

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    isDirty: () => {
      const { config, originalConfig } = get();
      if (!config || !originalConfig) return false;
      return JSON.stringify(config) !== JSON.stringify(originalConfig);
    },

    // ... implement remaining actions
  }))
);
```

---

## 33. Preview Mode Implementation (Learner App)

The learner app needs to support receiving config via `postMessage` for live preview.

### 33.1 Preview Receiver (Add to Learner App)

```typescript
// src/hooks/use-preview-mode.ts (LEARNER APP)

import { useEffect, useState } from "react";
import { CourseCatalogueData } from "@/routes/$tagName/-types/course-catalogue-types";

export const usePreviewMode = () => {
  const [previewConfig, setPreviewConfig] =
    useState<CourseCatalogueData | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useEffect(() => {
    // Check if in preview mode via URL param
    const urlParams = new URLSearchParams(window.location.search);
    const isPreview = urlParams.get("preview") === "true";
    setIsPreviewMode(isPreview);

    if (!isPreview) return;

    // Listen for config updates from parent (admin portal)
    const handleMessage = (event: MessageEvent) => {
      // Validate origin (adjust for your admin portal URL)
      const allowedOrigins = [
        "https://admin.vacademy.io",
        "http://localhost:5173", // Dev
      ];

      if (!allowedOrigins.includes(event.origin)) return;

      if (event.data?.type === "CATALOGUE_CONFIG_UPDATE") {
        console.log("[Preview] Received config update");
        setPreviewConfig(event.data.payload);
      }
    };

    window.addEventListener("message", handleMessage);

    // Notify parent that preview is ready
    window.parent.postMessage({ type: "PREVIEW_READY" }, "*");

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return { previewConfig, isPreviewMode };
};
```

### 33.2 Update CourseCataloguePage to Support Preview

```typescript
// In CourseCataloguePage.tsx - add this logic

const { previewConfig, isPreviewMode } = usePreviewMode();

// Use preview config if in preview mode, otherwise fetch from API
useEffect(() => {
  if (isPreviewMode && previewConfig) {
    setCatalogueData(previewConfig);
    setIsLoading(false);
  } else if (!isPreviewMode) {
    // Normal fetch logic
    fetchCatalogueData();
  }
}, [isPreviewMode, previewConfig]);
```

### 33.3 Preview Controller (Admin Portal)

```typescript
// src/routes/catalogue-editor/-components/PreviewPanel.tsx

import { useRef, useEffect, useState } from "react";
import { useEditorStore } from "../-stores/editor-store";
import { CATALOGUE_EDITOR_CONFIG } from "@/constants/catalogue-editor";
import {
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const PreviewPanel = ({ tagName }: { tagName: string }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);

  const config = useEditorStore((state) => state.config);
  const viewport = useEditorStore((state) => state.previewViewport);
  const setViewport = useEditorStore((state) => state.setViewport);

  const previewUrl = `${CATALOGUE_EDITOR_CONFIG.LEARNER_APP_URL}/${tagName}?preview=true`;

  // Listen for preview ready
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PREVIEW_READY") {
        setIsReady(true);
        // Send initial config
        sendConfigToPreview();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Send config updates (debounced)
  useEffect(() => {
    if (!isReady || !config) return;

    const timeout = setTimeout(() => {
      sendConfigToPreview();
    }, CATALOGUE_EDITOR_CONFIG.PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [config, isReady]);

  const sendConfigToPreview = () => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "CATALOGUE_CONFIG_UPDATE",
        payload: config,
      },
      CATALOGUE_EDITOR_CONFIG.LEARNER_APP_URL
    );
  };

  const viewportSizes = CATALOGUE_EDITOR_CONFIG.VIEWPORTS;
  const currentSize = viewportSizes[viewport];

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-white border-b">
        <ToggleGroup
          type="single"
          value={viewport}
          onValueChange={(v) => v && setViewport(v as any)}
        >
          <ToggleGroupItem value="desktop" aria-label="Desktop">
            <Monitor className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="tablet" aria-label="Tablet">
            <Tablet className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="mobile" aria-label="Mobile">
            <Smartphone className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={sendConfigToPreview}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Open
            </a>
          </Button>
        </div>
      </div>

      {/* Preview Frame */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        <div
          className="bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-300"
          style={{
            width: currentSize.width,
            height: currentSize.height,
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        >
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="w-full h-full border-0"
            title="Catalogue Preview"
          />
        </div>
      </div>

      {/* Status */}
      <div className="p-2 bg-white border-t text-xs text-gray-500 flex justify-between">
        <span>
          {currentSize.width} × {currentSize.height}
        </span>
        <span>{isReady ? "🟢 Connected" : "🟡 Connecting..."}</span>
      </div>
    </div>
  );
};
```

---

## 34. Fetching Levels & Package Sessions

For Lead Collection chip options, admins need to select levels from their institute.

### 34.1 Level Fetching Service

```typescript
// src/routes/catalogue-editor/-services/levels-service.ts

import axios from "axios";
import { BASE_URL } from "@/constants/urls";

export interface Level {
  id: string;
  name: string;
  packageSessions: PackageSession[];
}

export interface PackageSession {
  id: string;
  name: string;
  price: number;
  enrollInviteId?: string;
}

export const getLevelsForInstitute = async (
  instituteId: string
): Promise<Level[]> => {
  try {
    const response = await axios.get(
      `${BASE_URL}/admin-core-service/levels/v1/institute/${instituteId}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return response.data?.content || response.data || [];
  } catch (error) {
    console.error("[LevelsService] Error fetching levels:", error);
    throw error;
  }
};
```

### 34.2 Level Selector Component

```typescript
// src/routes/catalogue-editor/-components/editors/LevelSelector.tsx

import { useState, useEffect } => 'react';
import { getLevelsForInstitute, Level } from '../-services/levels-service';
import { useCurrentInstituteId } from '@/hooks/use-current-institute';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LevelSelectorProps {
  value: { levelId: string; packageSessionId: string } | null;
  onChange: (value: { label: string; value: string; levelId: string; packageSessionId: string }) => void;
}

export const LevelSelector = ({ value, onChange }: LevelSelectorProps) => {
  const instituteId = useCurrentInstituteId();
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!instituteId) return;

    getLevelsForInstitute(instituteId)
      .then(setLevels)
      .finally(() => setLoading(false));
  }, [instituteId]);

  if (loading) return <div>Loading levels...</div>;

  return (
    <Select
      value={value?.levelId}
      onValueChange={(levelId) => {
        const level = levels.find(l => l.id === levelId);
        if (level && level.packageSessions[0]) {
          onChange({
            label: level.name,
            value: level.name,
            levelId: level.id,
            packageSessionId: level.packageSessions[0].id,
          });
        }
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a level" />
      </SelectTrigger>
      <SelectContent>
        {levels.map((level) => (
          <SelectItem key={level.id} value={level.id}>
            {level.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
```

---

## 35. Permissions & Access Control

### 35.1 Required Permissions

| Permission          | Description                           |
| ------------------- | ------------------------------------- |
| `catalogue:read`    | View catalogue configurations         |
| `catalogue:write`   | Create and edit catalogues            |
| `catalogue:delete`  | Delete catalogue tags                 |
| `catalogue:publish` | Publish changes (if workflow enabled) |

### 35.2 Role Mapping

| Role            | Permissions                |
| --------------- | -------------------------- |
| Super Admin     | All                        |
| Institute Admin | `read`, `write`, `publish` |
| Content Manager | `read`, `write`            |
| Viewer          | `read` only                |

### 35.3 Permission Check Hook

```typescript
// src/hooks/use-catalogue-permissions.ts

import { useCurrentUser } from "@/hooks/use-current-user";

export const useCataloguePermissions = () => {
  const user = useCurrentUser();

  // Adjust based on your actual permission system
  const permissions = user?.authorities || [];

  return {
    canRead:
      permissions.includes("CATALOGUE_READ") || permissions.includes("ADMIN"),
    canWrite:
      permissions.includes("CATALOGUE_WRITE") || permissions.includes("ADMIN"),
    canDelete:
      permissions.includes("CATALOGUE_DELETE") || permissions.includes("ADMIN"),
    canPublish:
      permissions.includes("CATALOGUE_PUBLISH") ||
      permissions.includes("ADMIN"),
  };
};
```

---

## 36. Default JSON Templates

### 36.1 Blank Template

```typescript
// src/routes/catalogue-editor/-templates/blank.ts

export const blankTemplate = {
  version: "1.0",
  globalSettings: {
    courseCatalogeType: { enabled: false, value: "Course" },
    mode: "light",
    fonts: { enabled: true, family: "Inter, sans-serif" },
    compactness: "medium",
    audience: "all",
    leadCollection: {
      enabled: false,
      mandatory: false,
      inviteLink: null,
      formStyle: {
        type: "single",
        showProgress: false,
        progressType: "bar",
        transition: "slide",
      },
      fields: [],
    },
    enrquiry: { enabled: true, requirePayment: false },
    payment: {
      enabled: true,
      provider: "razorpay",
      fields: ["fullName", "email", "phone"],
    },
    layout: {
      header: {
        id: "header-1",
        type: "header",
        enabled: true,
        props: {
          logo: "",
          title: "My Platform",
          navigation: [
            { label: "Home", route: "homepage", openInSameTab: true },
          ],
          authLinks: [{ label: "Login", route: "login" }],
        },
      },
      footer: {
        id: "footer-1",
        type: "footer",
        enabled: true,
        props: {
          layout: "two-column",
          leftSection: {
            title: "My Platform",
            text: "Welcome to our platform.",
          },
          rightSection: { title: "Links", links: [] },
          bottomNote: "© 2025",
        },
      },
    },
  },
  pages: [
    {
      id: "home",
      route: "homepage",
      title: "Home",
      components: [],
    },
  ],
};
```

### 36.2 Course Catalogue Template

```typescript
// src/routes/catalogue-editor/-templates/course-catalogue.ts

export const courseCatalogueTemplate = {
  version: "1.0",
  globalSettings: {
    courseCatalogeType: { enabled: false, value: "Course" },
    mode: "light",
    fonts: { enabled: true, family: "Poppins, sans-serif" },
    compactness: "medium",
    audience: "all",
    leadCollection: {
      enabled: true,
      mandatory: false,
      inviteLink: null,
      formStyle: {
        type: "multiStep",
        showProgress: true,
        progressType: "bar",
        transition: "slide",
      },
      fields: [
        {
          name: "name",
          label: "Full Name",
          type: "text",
          required: true,
          step: 1,
        },
        {
          name: "email",
          label: "Email",
          type: "email",
          required: true,
          step: 2,
        },
        { name: "phone", label: "Phone", type: "tel", required: true, step: 3 },
      ],
    },
    enrquiry: { enabled: true, requirePayment: false },
    payment: {
      enabled: true,
      provider: "razorpay",
      fields: ["fullName", "email", "phone"],
    },
    layout: {
      header: {
        /* ... */
      },
      footer: {
        /* ... */
      },
    },
  },
  pages: [
    {
      id: "home",
      route: "homepage",
      components: [
        {
          id: "hero-1",
          type: "heroSection",
          enabled: true,
          props: {
            layout: "split",
            backgroundColor: "#F8FAFC",
            left: {
              title: "Upgrade Your Skills Today",
              description: "Join thousands of learners.",
              button: {
                enabled: true,
                text: "Get Started",
                action: "openLeadCollection",
                target: "",
              },
            },
            right: { image: "", alt: "Hero" },
          },
        },
        {
          id: "catalog-1",
          type: "courseCatalog",
          enabled: true,
          props: {
            title: "Featured Courses",
            showFilters: true,
            filtersConfig: [
              {
                id: "level",
                label: "Level",
                type: "checkbox",
                field: "level_name",
              },
            ],
            render: {
              layout: "grid",
              cardFields: [
                "package_name",
                "course_preview_image_media_id",
                "price",
              ],
              styles: { hoverEffect: "shadow", roundedEdges: true },
            },
          },
        },
      ],
    },
  ],
};
```

### 36.3 Book/Product Catalogue Template

```typescript
// src/routes/catalogue-editor/-templates/product-catalogue.ts

export const productCatalogueTemplate = {
  version: "1.0",
  globalSettings: {
    courseCatalogeType: { enabled: true, value: "Product" },
    mode: "light",
    fonts: { enabled: true, family: "Mulish, sans-serif" },
    // ... similar to course but with cart/buy-rent enabled
    payment: {
      enabled: true,
      provider: "PHONEPE",
      fields: ["fullName", "email", "phone"],
    },
  },
  pages: [
    {
      id: "plan",
      route: "buy-rent",
      components: [
        {
          id: "media-1",
          type: "mediaShowcase",
          enabled: true,
          props: {
            /* slider */
          },
        },
        {
          id: "buysell-1",
          type: "buyRentSection",
          enabled: true,
          props: {
            /* buy/rent */
          },
        },
      ],
    },
    {
      id: "home",
      route: "homepage",
      components: [
        {
          id: "books-1",
          type: "bookCatalogue",
          enabled: true,
          props: {
            /* catalog config */
          },
        },
      ],
    },
    {
      id: "cart",
      route: "cart",
      components: [
        {
          id: "cart-1",
          type: "cartComponent",
          enabled: true,
          props: {
            /* cart config */
          },
        },
      ],
    },
  ],
};
```

---

## 37. Route Configuration (Admin Portal)

### 37.1 Route Setup

```typescript
// src/routes/catalogue-editor/index.tsx

import { createFileRoute } from "@tanstack/react-router";
import { CatalogueEditorPage } from "./-components/CatalogueEditorPage";
import { useCataloguePermissions } from "@/hooks/use-catalogue-permissions";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/catalogue-editor/")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    tag: (search.tag as string) || "courses",
  }),
});

function RouteComponent() {
  const { canRead } = useCataloguePermissions();
  const { tag } = Route.useSearch();

  if (!canRead) {
    return <Navigate to="/unauthorized" />;
  }

  return <CatalogueEditorPage tagName={tag} />;
}
```

### 37.2 Navigation Entry

```typescript
// Add to your admin sidebar/navigation config

{
  label: 'Catalogue Editor',
  icon: 'LayoutDashboard',
  href: '/catalogue-editor',
  permission: 'catalogue:read',
}
```

---

## 38. Checklist for Implementation

### 38.1 Pre-Implementation

- [ ] Confirm admin portal tech stack matches spec
- [ ] Verify API endpoints exist or need creation
- [ ] Set up environment variables
- [ ] Install required dependencies
- [ ] Confirm learner app can be embedded in iframe (CORS)

### 38.2 Phase 1: Core Editor

- [ ] Create folder structure
- [ ] Implement Zustand store
- [ ] Build component library sidebar
- [ ] Build page canvas with drag-drop
- [ ] Build property panel
- [ ] Implement undo/redo

### 38.3 Phase 2: Component Editors

- [ ] Global Settings editor
- [ ] Header editor
- [ ] Footer editor
- [ ] Hero Section editor
- [ ] Course/Book Catalog editor
- [ ] Other component editors

### 38.4 Phase 3: Preview & Polish

- [ ] Preview iframe with postMessage
- [ ] Viewport switching
- [ ] JSON editor mode
- [ ] Validation errors panel
- [ ] Save/load functionality

### 38.5 Phase 4: Testing & Launch

- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Documentation
- [ ] User training

---

---

## 39. Per-Component Styling System (v2)

> **Added:** 2026-03-25

Every component now supports an optional `style` field for fine-grained visual control without touching component-specific props.

### 39.1 ComponentStyle Interface

```typescript
interface ComponentStyle {
  // Spacing
  paddingTop?: string; paddingBottom?: string; paddingLeft?: string; paddingRight?: string;
  marginTop?: string; marginBottom?: string;
  // Background
  backgroundColor?: string; backgroundImage?: string;
  backgroundSize?: 'cover' | 'contain' | 'auto'; backgroundPosition?: string;
  backgroundOverlay?: string; // rgba overlay on background images
  gradient?: { type: 'linear' | 'radial'; angle?: number; stops: { color: string; position: number }[] };
  // Border
  borderWidth?: string; borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  borderRadius?: string;
  // Shadow & Effects
  boxShadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  opacity?: number; maxWidth?: string; minHeight?: string;
  customClass?: string;
  // Typography (per-component override)
  typography?: {
    fontFamily?: string; fontSize?: string;
    fontWeight?: '400' | '500' | '600' | '700' | '800';
    lineHeight?: string; letterSpacing?: string;
    textColor?: string; textAlign?: 'left' | 'center' | 'right';
    textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  };
  // Animation
  animation?: {
    entrance?: { type: 'fadeIn' | 'fadeInUp' | 'fadeInDown' | 'fadeInLeft' | 'fadeInRight' | 'scaleUp' | 'slideUp' | 'none'; duration?: number; delay?: number; easing?: string };
    hover?: { type: 'none' | 'lift' | 'glow' | 'scale' | 'brighten' };
  };
  // Responsive
  responsive?: { tablet?: Partial<ComponentStyle>; mobile?: Partial<ComponentStyle> };
  visibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
}
```

### 39.2 Admin Editor

- **StyleEditor.tsx** — collapsible accordion below every component editor with sections: Spacing, Background (with gradient builder), Border & Shadow, Effects, Typography, Animation, Visibility
- Applied via `buildComponentStyle()` utility that converts to `React.CSSProperties`

### 39.3 Learner Rendering

- **ComponentStyleWrapper** — wraps styled components with IntersectionObserver for scroll-triggered entrance animations
- **Responsive CSS** — generates per-component `<style>` tags with media queries for tablet/mobile overrides
- **Hover effects** — CSS classes: `.catalogue-hover-lift`, `.catalogue-hover-glow`, `.catalogue-hover-scale`, `.catalogue-hover-brighten`
- **Animation keyframes** — defined in `catalogue-animations.css`: `catalogue-fadeIn`, `catalogue-fadeInUp`, etc.

### 39.4 Key Files

| File | Location |
|------|----------|
| StyleEditor.tsx | `admin/src/routes/manage-pages/-components/StyleEditor.tsx` |
| style-utils.ts (admin) | `admin/src/routes/manage-pages/-utils/style-utils.ts` |
| style-utils.ts (learner) | `learner/src/routes/$tagName/-utils/style-utils.ts` |
| catalogue-animations.css | `learner/src/styles/catalogue-animations.css` |

---

## 40. Global Heading Scale

> **Added:** 2026-03-25

### 40.1 Settings

Added to `GlobalSettings.theme`:

```typescript
headingScale?: 'compact' | 'default' | 'large' | 'display';
```

| Scale | h1 | h2 | h3 |
|-------|----|----|-----|
| compact | 2rem | 1.5rem | 1.25rem |
| default | 2.5rem | 2rem | 1.5rem |
| large | 3.5rem | 2.5rem | 2rem |
| display | 4.5rem | 3rem | 2.25rem |

### 40.2 Implementation

- Admin: selector in GlobalSettingsEditor (4 buttons)
- Learner: `data-heading-scale` attribute on page wrapper, CSS custom properties in `catalogue-tokens.css`

---

## 41. New Component Types (v2)

> **Added:** 2026-03-25

### 41.1 Utility Components

| Type | Description | Key Props |
|------|-------------|-----------|
| `spacer` | Vertical space with optional divider | `height`, `showDivider`, `dividerStyle`, `dividerColor`, `dividerWidth`, `maxWidth` |
| `textBlock` | Standalone rich text content | `content` (HTML), `maxWidth`, `alignment` |
| `imageBlock` | Single image with caption & link | `src`, `alt`, `caption`, `linkUrl`, `alignment`, `maxWidth`, `borderRadius`, `aspectRatio` |
| `buttonBlock` | Standalone CTA button | `text`, `url`, `target`, `variant` (filled/outline/ghost), `size`, `alignment`, `fullWidth`, colors |

### 41.2 Content Components

| Type | Description | Key Props |
|------|-------------|-----------|
| `featureGrid` | "Why Choose Us" icon grid | `headerText`, `subheading`, `columns` (2-4), `features[]` ({icon, title, description}), `style` (cards/minimal/bordered), `iconSize` |
| `stepsProcess` | "How It Works" steps | `headerText`, `subheading`, `layout` (horizontal/vertical), `steps[]` ({number, title, description}), `connectorStyle` (line/dashed/dots/none), `accentColor` |
| `newsletterSignup` | Email capture form | `heading`, `subheading`, `placeholder`, `buttonText`, `layout` (inline/stacked), `successMessage` |

### 41.3 Interactive Components

| Type | Description | Key Props |
|------|-------------|-----------|
| `tabsAccordion` | Tabbed or accordion content | `mode` (tabs/accordion), `items[]` ({title, content}), `allowMultiple`, `backgroundColor` |
| `logoCloud` | Partner/trust logos | `headerText`, `logos[]` ({image, alt, url}), `layout` (grid/marquee), `grayscale`, `columns` |
| `mapEmbed` | Google Maps embed | `embedUrl`, `height`, `borderRadius`, `title` |
| `countdownTimer` | Live countdown | `targetDate`, `heading`, `expiredMessage`, `style` (cards/minimal), colors |

### 41.4 Total Component Count: 34

Original 22 + spacer, tabsAccordion, logoCloud, mapEmbed, countdownTimer, textBlock, featureGrid, imageBlock, buttonBlock, newsletterSignup, stepsProcess, + columnLayout variants = **34 unique types**.

---

## 42. Smart Link Picker & Routing

> **Added:** 2026-03-25

### 42.1 Problem

All route/URL fields were free-text inputs. Users had to manually type page slugs with no validation or autocomplete.

### 42.2 LinkPicker Component (Admin)

**File:** `admin/src/routes/manage-pages/-components/LinkPicker.tsx`

Features:
- **Page/URL mode toggle** — switch between internal page selection and external URL input
- **Searchable page list** — shows all pages with title, route slug, published status (green dot)
- **Click-to-select** — visual selection with "Links to: /about-us" confirmation
- **Clear button** — easy link removal
- **Optional target toggle** — same tab / new tab

### 42.3 Editors Updated

LinkPicker replaces free-text inputs in:
- ButtonBlock (`url`), ImageBlock (`linkUrl`), CTA Banner (`button.target`)
- Header nav items (`navigation[].route`), Header auth links (`authLinks[].route`)
- Footer links (`rightSection.links[].route`), PricingTable (`plans[].buttonTarget`)
- MediaShowcase slider (`slides[].button.target`)

### 42.4 CatalogueLink Component (Learner)

**File:** `learner/src/routes/$tagName/-components/CatalogueLink.tsx`

Smart link component that handles:
- **External URLs** (http/https/mailto/tel) → regular `<a>` with `target=_blank`
- **Anchor links** (`#pricing`) → smooth scroll to element
- **Page + anchor** (`about-us#team`) → SPA navigate then scroll
- **Internal routes** (`about-us`) → TanStack Router `navigate()` for SPA transitions
- **Cmd/Ctrl+click** preserved for open-in-new-tab

Replaces `<a href>` in: ButtonBlock, CTA Banner, PricingTable, ImageBlock renderers.

---

## 43. Anchor Links

> **Added:** 2026-03-25

### 43.1 Component Anchor ID

Every component now has an optional `anchorId` field:

```typescript
interface Component {
  // ...existing fields
  anchorId?: string; // e.g. "pricing", "faq", "contact"
}
```

- Admin: text field in PropertyPanel (below Enabled toggle), auto-strips special characters
- Learner: rendered as `id={anchorId}` on component wrapper divs
- Links: use `#pricing` for same-page scroll or `about-us#team` for cross-page anchor

---

## 44. Auto-Generate Navigation from Pages

> **Added:** 2026-03-25

### 44.1 Feature

"Sync Pages" button in the Header editor that auto-populates navigation items from all published pages.

### 44.2 Behavior

- Reads `config.pages` and filters to published pages
- Creates nav items: `{ label: page.title, route: page.route, openInSameTab: true }`
- Detects home page → sets route to `"homepage"`
- Replaces existing navigation (user can then manually reorder/edit)

---

## 45. Sticky Header

> **Added:** 2026-03-25

### 45.1 Setting

```typescript
interface GlobalSettings {
  // ...existing fields
  stickyHeader?: boolean;
}
```

- Admin: toggle in HeaderEditor
- Learner: header wrapper gets `sticky top-0 z-50` CSS class

---

## 46. Page-Level Background Color

> **Added:** 2026-03-25

### 46.1 Setting

```typescript
interface Page {
  // ...existing fields
  backgroundColor?: string; // hex color, e.g. "#F8FAFC"
}
```

- Admin: ColorPicker in Page Settings panel
- Learner: page content wrapped in `<div style={{ backgroundColor }}>` in CourseCataloguePage

---

## 47. Component Copy/Paste Across Pages

> **Added:** 2026-03-25

### 47.1 Store Actions

```typescript
interface EditorState {
  clipboard: Component | null;
  copyComponent: (pageId: string, componentId: string) => void;
  pasteComponent: (pageId: string) => void;
}
```

### 47.2 UX

- **Copy:** "Copy to Clipboard" button on every component's property panel (deep-clones the component)
- **Paste:** "Paste: [component type]" button in Page Settings (appears when clipboard has content)
- IDs are regenerated on paste (including nested slot IDs for columnLayout)
- Undo-able via Ctrl+Z

---

## 48. Back-to-Top Button

> **Added:** 2026-03-25

### 48.1 Setting

```typescript
interface GlobalSettings {
  // ...existing fields
  backToTop?: boolean;
}
```

- Admin: toggle in GlobalSettingsEditor
- Learner: floating button (dark circle with chevron-up) appears after 400px scroll, smooth-scrolls to top
- Responsive: `bottom-6 right-6` on mobile, `bottom-8 right-8` on desktop
- Hidden in preview mode

---

## 49. Rich Text Typography (catalogue-rich-text)

> **Added:** 2026-03-25

Custom CSS class `.catalogue-rich-text` in `catalogue-animations.css` provides typography styling for `textBlock` and any HTML content rendered via `dangerouslySetInnerHTML`:

- h1/h2/h3 sizing and spacing
- Link styling with theme primary color
- List styles (disc for ul, decimal for ol)
- Blockquote with left border
- Strong/em formatting

This replaces the `@tailwindcss/typography` `prose` class (which is not installed).

---

**Document Maintainers:** @shreyashjain
**Related Files:**

- `/src/routes/$tagName/-types/course-catalogue-types.ts`
- `/src/routes/$tagName/-components/JsonRenderer.tsx`
- `/src/routes/$tagName/-components/CatalogueLink.tsx`
- `/src/routes/$tagName/-utils/style-utils.ts`
- `/src/routes/$tagName/-services/course-catalogue-service.ts`
- `/src/routes/$tagName/-services/route-matcher.ts`
- `/src/routes/$tagName/-components/CourseCataloguePage.tsx`
- `/src/routes/$tagName/-components/IntroPageComponent.tsx`
- `/src/routes/$tagName/-components/LeadCollectionModal.tsx`
- `/src/routes/$tagName/-components/components/BookDetailsComponent.tsx`
- `/src/routes/$tagName/-stores/cart-store.ts`
- `/src/styles/catalogue-animations.css`
- `/src/styles/catalogue-tokens.css`
