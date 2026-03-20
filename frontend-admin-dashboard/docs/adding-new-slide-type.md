# Adding a New Slide Type

This document provides a comprehensive checklist and guide for adding a new slide type to the Admin Portal and Learner App.

## Prerequisites

Before adding a new slide type, ensure you have:

1. **Backend API Ready** - The API endpoint for creating/updating the new slide type should be implemented
2. **Data Structure Defined** - Understand the payload structure required by the API
3. **Icon Selected** - Choose an appropriate icon from `@phosphor-icons/react`

## ⚠️ Important Notes

### Snake_case for DTOs

**All API payloads and response interfaces MUST use snake_case** to match the backend DTOs.

For example:

-   ✅ `audio_file_id`, `slide_order`, `source_type`
-   ❌ `audioFileId`, `slideOrder`, `sourceType`

### The `new_slide` Flag

When creating a new slide, you **MUST** include `new_slide: true` in the payload. This tells the backend that this is a new slide creation, not an update.

```typescript
await addUpdateYourSlide({
    id: slideId,
    title: 'My Slide',
    // ... other fields
    new_slide: true,  // <-- REQUIRED for new slides
    your_slide: { ... }
});
```

---

## Step-by-Step Checklist

### 1. API URL Constant

**File:** `src/constants/urls.ts`

Add the API endpoint constant for your new slide type:

```typescript
export const ADD_UPDATE_[YOUR_SLIDE_TYPE]_SLIDE = `${BASE_URL}/admin-core-service/slide/[your-slide-type]-slide/add-or-update`;
```

---

### 2. Slide Interfaces & Mutations

**File:** `src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-hooks/use-slides.tsx`

#### 2.1 Import the URL constant

```typescript
import {
    // ... existing imports
    ADD_UPDATE_[YOUR_SLIDE_TYPE]_SLIDE,
} from '@/constants/urls';
```

#### 2.2 Add Slide Interface

Define the interface for your slide's data structure:

```typescript
export interface [YourSlideType]Slide {
    id: string;
    // ... your slide-specific properties
}
```

#### 2.3 Update the Main `Slide` Interface

Add your slide type to the main `Slide` interface:

```typescript
export interface Slide {
    // ... existing properties
    [your_slide_type]_slide?: [YourSlideType]Slide | null;
}
```

#### 2.4 Add Payload Interface

Define the API payload structure (use **snake_case** for all keys):

```typescript
export interface [YourSlideType]SlidePayload {
    id?: string | null;
    title: string;
    description?: string | null;
    image_file_id?: string | null;
    status: 'DRAFT' | 'PUBLISHED';
    slide_order?: number | null;
    notify?: boolean;
    new_slide: boolean;  // REQUIRED - true for create, false for update
    [your_slide_type]_slide: {
        id?: string | null;
        // ... slide-specific data (snake_case)
    };
}
```

#### 2.5 Add Mutation Hook

Add the mutation for creating/updating your slide:

```typescript
const addUpdate[YourSlideType]SlideMutation = useMutation({
    mutationFn: async (payload: [YourSlideType]SlidePayload) => {
        const response = await authenticatedAxiosInstance.post(
            `${ADD_UPDATE_[YOUR_SLIDE_TYPE]_SLIDE}?chapterId=${chapterId}&moduleId=${moduleId}&subjectId=${subjectId}&packageSessionId=${packageSessionId}&instituteId=${INSTITUTE_ID}`,
            payload
        );
        return { data: response.data, isNewSlide: payload.new_slide };
    },
    onSuccess: async (result) => {
        await queryClient.invalidateQueries({ queryKey: ['slides'] });
        // ... handle success
    },
});
```

#### 2.6 Export the Mutation

Add to the return statement:

```typescript
return {
    // ... existing exports
    addUpdate[YourSlideType]Slide: (payload: [YourSlideType]SlidePayload) =>
        addUpdate[YourSlideType]SlideMutation.mutateAsync(payload).then((result) => result.data),
    isUpdating:
        // ... add to isUpdating check
        addUpdate[YourSlideType]SlideMutation.isPending ||
        // ...
};
```

---

### 3. Create Preview Component

**File:** `src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/[your-slide-type]-slide-preview.tsx`

Create a new component for rendering your slide type:

```tsx
export const [YourSlideType]SlidePreview = ({
    activeItem,
    isLearnerView,
}: {
    activeItem: Slide;
    isLearnerView: boolean;
}) => {
    // Your slide preview implementation
};
```

---

### 4. Add to Slide Material Renderer

**File:** `src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/slide-material.tsx`

#### 4.1 Import your Preview Component

```typescript
import { [YourSlideType]SlidePreview } from './[your-slide-type]-slide-preview';
```

#### 4.2 Add Source Type Handling

In the `loadContent` function, add handling for your slide type:

```typescript
if (activeItem?.source_type === '[YOUR_SLIDE_TYPE]') {
    return (
        <[YourSlideType]SlidePreview
            activeItem={activeItem}
            isLearnerView={isNonAdmin}
        />
    );
}
```

#### 4.3 Update SaveDraft

In the `SaveDraft` function, add a condition for your slide type to enable saving drafts:

```typescript
if (activeItem?.source_type === '[YOUR_SLIDE_TYPE]') {
    try {
        await addUpdate[YourSlideType]Slide({
            // ... construct payload with status based on current activeItem status
        });
        toast.success('[Your Slide Type] slide saved successfully!');
    } catch (error) {
        toast.error('Error saving slide');
    }
    return;
}
```

---

### 5. Dialog Store

**File:** `src/routes/study-library/courses/-stores/slide-add-dialogs-store.ts`

Add state and actions for your slide dialog:

```typescript
interface SlideAddDialogsState {
    // ... existing state
    is[YourSlideType]DialogOpen: boolean;
}

interface SlideAddDialogsActions {
    // ... existing actions
    open[YourSlideType]Dialog: () => void;
    close[YourSlideType]Dialog: () => void;
    toggle[YourSlideType]Dialog: () => void;
}

// In the store:
is[YourSlideType]DialogOpen: false,

open[YourSlideType]Dialog: () => set({ is[YourSlideType]DialogOpen: true }),
close[YourSlideType]Dialog: () => set({ is[YourSlideType]DialogOpen: false }),
toggle[YourSlideType]Dialog: () => set((state) => ({
    is[YourSlideType]DialogOpen: !state.is[YourSlideType]DialogOpen
})),

// Also add to resetDialogs():
is[YourSlideType]DialogOpen: false,
```

---

### 6. Create Add Dialog Component

**File:** `src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/slides-sidebar/add-[your-slide-type]-dialog.tsx`

Create the dialog component for adding your new slide type.

---

### 7. Sidebar Add Button

**File:** `src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/slides-sidebar/slides-sidebar-add-button.tsx`

#### 7.1 Add Imports

```typescript
import { [YourIcon] } from '@phosphor-icons/react';
import { Add[YourSlideType]Dialog } from './add-[your-slide-type]-dialog';
```

#### 7.2 Destructure Dialog State

```typescript
const {
    // ... existing state
    is[YourSlideType]DialogOpen,
    open[YourSlideType]Dialog,
    close[YourSlideType]Dialog,
} = useDialogStore();
```

#### 7.3 Add Dropdown Item

In the `dropdownList` array:

```typescript
{
    label: '[Your Slide Type]',
    value: '[your-slide-type]',
    icon: <[YourIcon] className="size-4 text-[color]-500" />,
    description: 'Description of your slide type',
},
```

#### 7.4 Add Filter Case (if needed)

In the `isAllowed` function:

```typescript
case '[your-slide-type]':
    return ct.[yourSlideType] !== false;
```

Or simply return `true` if no specific config exists.

#### 7.5 Add Handler Case

In `handleSelect`:

```typescript
case '[your-slide-type]':
    open[YourSlideType]Dialog();
    break;
```

#### 7.6 Add Dialog JSX

```tsx
<MyDialog
    trigger={<></>}
    heading="Add [Your Slide Type]"
    dialogWidth="min-w-[500px]"
    open={is[YourSlideType]DialogOpen}
    onOpenChange={close[YourSlideType]Dialog}
>
    <div className="duration-300 animate-in fade-in slide-in-from-bottom-4">
        <Add[YourSlideType]Dialog
            openState={(open) => !open && close[YourSlideType]Dialog()}
        />
    </div>
</MyDialog>
```

---

### 8. Slide Icons

**File:** `src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/slides-sidebar/slides-sidebar-slides.tsx`

#### 8.1 Import Icon

```typescript
import { [YourIcon] } from '@phosphor-icons/react';
```

#### 8.2 Add to `getIcon` Function

```typescript
case '[YOUR_SLIDE_TYPE]':
    return <[YourIcon] className={`${iconClass} text-[color]-500`} />;
```

#### 8.3 Update `getSlideTitle` Function

In the `SlideItem` component's `getSlideTitle`:

```typescript
(slide.source_type === '[YOUR_SLIDE_TYPE]' && slide?.title) ||
```

---

### 9. Slide Naming Utils

**File:** `src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-helper/slide-naming-utils.ts`

#### 9.1 Add to SLIDE_TYPE_NAMES

```typescript
export const SLIDE_TYPE_NAMES = {
    // ... existing types
    [YOUR_SLIDE_TYPE]: '[Your Slide Type Display Name]',
} as const;
```

#### 9.2 Add to getSlideTypeForNaming

```typescript
if (slide.source_type === '[YOUR_SLIDE_TYPE]') {
    return SLIDE_TYPE_NAMES.[YOUR_SLIDE_TYPE];
}
```

#### 9.3 Add Title Generator (Optional)

```typescript
export function generateUnique[YourSlideType]SlideTitle(allSlides: Slide[]): string {
    return generateUniqueSlideTitle(allSlides, SLIDE_TYPE_NAMES.[YOUR_SLIDE_TYPE]);
}
```

---

### 10. Quick Add Support (Optional)

**File:** `src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/quick-add.tsx`

If your slide type can be bulk-uploaded:

#### 10.1 Add to StagedKind Type

```typescript
type StagedKind =
    | 'PDF'
    // ... existing types
    | '[YOUR_SLIDE_TYPE]';
```

#### 10.2 Import Mutation

```typescript
const {
    // ... existing mutations
    addUpdate[YourSlideType]Slide,
} = useSlidesMutations(...);
```

#### 10.3 Add Handler

```typescript
} else if (item.kind === '[YOUR_SLIDE_TYPE]' && item.file) {
    // Handle your slide type upload
    const id = crypto.randomUUID();
    const resp = await addUpdate[YourSlideType]Slide({...});
    createdIds.push(resp || id);
    setStaged((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'done' } : it))
    );
}
```

---

---

### 11. Publishing Logic

**File:** `src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/slide-operations/handlePublishSlide.tsx`

#### 11.1 Update `handlePublishSlide`

1.  Import your `[YourSlideType]SlidePayload` interface.
2.  Add `addUpdate[YourSlideType]Slide` to the function signature.
3.  Add the logic to handle publishing:

```typescript
if (activeItem?.source_type === '[YOUR_SLIDE_TYPE]') {
    try {
        await addUpdate[YourSlideType]Slide({
            // ... construct payload with status: 'PUBLISHED', new_slide: false
        });
        toast.success('Slide published successfully!');
        setIsOpen(false);
    } catch {
        toast.error('Error in publishing the slide');
    }
}
```

**File:** `src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/slide-operations/handleUnpublishSlide.tsx`

#### 11.2 Update `handleUnpublishSlide`

1.  Import your `[YourSlideType]SlidePayload` interface.
2.  Add `addUpdate[YourSlideType]Slide` to the function signature.
3.  Add the logic to handle unpublishing:

```typescript
if (activeItem?.source_type === '[YOUR_SLIDE_TYPE]') {
    try {
        await addUpdate[YourSlideType]Slide({
            // ... construct payload with status: 'DRAFT', new_slide: false
        });
        toast.success('Slide unpublished successfully!');
        setIsOpen(false);
    } catch {
        toast.error('Error in unpublishing the slide');
    }
}
```

**File:** `src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/slide-material.tsx`

#### 11.3 Pass Mutation to Handlers

Update `handlePublishSlide` and `handleUnpublishSlide` calls to pass your new mutation:

```typescript
const {
    // ...
    addUpdate[YourSlideType]Slide,
} = useSlidesMutations(...);

// ... in JSX ...
handlePublishSlide(
    // ...
    addUpdate[YourSlideType]Slide, // <--- Add this
    SaveDraft,
    playerRef
)
```

---

### 12. Non-Admin (Learner/Teacher) Support

**File:** `src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/non-admin/hooks/useNonAdminSlides.ts`

Add handling in `saveSlideAsPublished`:

```typescript
} else if (slide?.source_type === '[YOUR_SLIDE_TYPE]') {
    if (slide.[your_slide_type]_slide) {
        const payload = {
            // ... construct payload
        };
        await slidesMutations.addUpdate[YourSlideType]Slide(payload);
        toast.success('[Your Slide Type] slide published successfully');
    } else {
        toast.error('[Your Slide Type] slide data is missing');
    }
}
```

---

## Summary Checklist

| #   | File                            | Change Required                      |
| --- | ------------------------------- | ------------------------------------ |
| 1   | `urls.ts`                       | Add API endpoint constant            |
| 2   | `use-slides.tsx`                | Add interfaces, mutation, and export |
| 3   | `[type]-slide-preview.tsx`      | Create preview component             |
| 4   | `slide-material.tsx`            | Import and render preview            |
| 5   | `slide-add-dialogs-store.ts`    | Add dialog state/actions             |
| 6   | `add-[type]-dialog.tsx`         | Create add dialog component          |
| 7   | `slides-sidebar-add-button.tsx` | Add dropdown item, handler, dialog   |
| 8   | `slides-sidebar-slides.tsx`     | Add icon and title handling          |
| 9   | `slide-naming-utils.ts`         | Add type name and functions          |
| 10  | `quick-add.tsx`                 | Add bulk upload support (optional)   |
| 11  | `handlePublishSlide.tsx`        | Add publishing logic                 |
| 12  | `handleUnpublishSlide.tsx`      | Add unpublishing logic               |
| 13  | `useNonAdminSlides.ts`          | Add non-admin save support           |

---

## Testing Checklist

After implementation, verify:

-   [ ] Slide can be created from Admin Portal
-   [ ] Slide appears in sidebar with correct icon
-   [ ] Slide renders correctly in main content area
-   [ ] Slide title displays correctly
-   [ ] Slide icon appears in course outline/structure
-   [ ] Quick add works (if implemented)
-   [ ] Non-admin users can view/interact with slide
-   [ ] Slide can be edited and saved
-   [ ] Slide can be published and unpublished
-   [ ] Slide order can be changed (drag and drop)
-   [ ] TypeScript compilation passes (`npx tsc --noEmit`)

---

## Example Implementation

Refer to the Audio Slide implementation (January 2026) as a complete example:

-   Preview: `audio-slide-preview.tsx`
-   Dialog: `add-audio-dialog.tsx`
-   API: `ADD_UPDATE_AUDIO_SLIDE`
-   Source Type: `'AUDIO'`
