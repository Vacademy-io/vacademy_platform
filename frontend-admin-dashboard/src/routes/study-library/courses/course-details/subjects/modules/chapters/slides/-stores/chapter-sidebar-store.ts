// stores/content-store.ts
import { create } from 'zustand';
import { Slide } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-hooks/use-slides';

interface ContentStore {
    items: Slide[];
    activeItem: Slide | null;
    setItems: (items: Slide[]) => void;
    setActiveItem: (item: Slide | null) => void;
    reorderItems: (oldIndex: number, newIndex: number) => void;
    resetChapterSidebarStore: () => void;
    getSlideById: (slideId: string) => Slide | null;
    updateActiveSlideQuestions: (questions: unknown[]) => void;
}

export const useContentStore = create<ContentStore>((set, get) => ({
    items: [],
    activeItem: null,

    setItems: (items) => {
        set({ items });
    },

    setActiveItem: (item) => {
        set({ activeItem: item });
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

    resetChapterSidebarStore: () => set({ items: [], activeItem: null }),

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
