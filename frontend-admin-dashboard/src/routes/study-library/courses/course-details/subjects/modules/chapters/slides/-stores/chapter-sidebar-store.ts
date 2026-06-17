// stores/content-store.ts
import { create } from 'zustand';
import { Slide } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-hooks/use-slides';

interface ContentStore {
    items: Slide[];
    activeItem: Slide | null;
    // When true, the slides content area renders the in-slide "create assessment"
    // form instead of a slide (mirrors how assignment is configured in-slide).
    assessmentCreateMode: boolean;
    setItems: (items: Slide[]) => void;
    setActiveItem: (item: Slide | null) => void;
    setAssessmentCreateMode: (on: boolean) => void;
    reorderItems: (oldIndex: number, newIndex: number) => void;
    resetChapterSidebarStore: () => void;
    getSlideById: (slideId: string) => Slide | null;
    updateActiveSlideQuestions: (questions: unknown[]) => void;
}

export const useContentStore = create<ContentStore>((set, get) => ({
    items: [],
    activeItem: null,
    assessmentCreateMode: false,

    setItems: (items) => {
        set({ items });
    },

    setActiveItem: (item) => {
        // Selecting a slide always exits the transient create-assessment mode.
        set({ activeItem: item, assessmentCreateMode: false });
    },

    setAssessmentCreateMode: (on) => {
        set({ assessmentCreateMode: on });
    },

    reorderItems: (oldIndex: number, newIndex: number) =>
        set((state) => {
            if (
                oldIndex < 0 ||
                oldIndex >= state.items.length ||
                newIndex < 0 ||
                newIndex >= state.items.length
            ) {
                return state;
            }

            const newItems = [...state.items];
            const movedItem: Slide = newItems[oldIndex]!;
            newItems.splice(oldIndex, 1);
            newItems.splice(newIndex, 0, movedItem);

            return {
                ...state,
                items: newItems,
            };
        }),

    resetChapterSidebarStore: () =>
        set({ items: [], activeItem: null, assessmentCreateMode: false }),

    getSlideById: (slideId: string) => {
        const state = get();
        return state.items.find((slide) => slide.id === slideId) || null;
    },

    updateActiveSlideQuestions: (questions: unknown[]) => {
        set((state) => {
            if (!state.activeItem) return state;

            const updatedItem: Slide = {
                ...state.activeItem,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                question_slide: questions as any, // Type assertion for compatibility with existing code
            };

            const updatedItems = state.items.map((item) =>
                item.id === updatedItem.id ? updatedItem : item
            );

            return {
                activeItem: updatedItem,
                items: updatedItems,
            };
        });
    },
}));
