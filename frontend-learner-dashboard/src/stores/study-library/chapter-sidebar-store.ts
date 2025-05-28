// stores/content-store.ts
import { create } from "zustand";
import { Slide } from "@/hooks/study-library/use-slides";

interface ContentStore {
    items: Slide[];
    activeItem: Slide | null;
    setItems: (items: Slide[]) => void;
    setActiveItem: (item: Slide | null) => void;
}

export const useContentStore = create<ContentStore>((set) => ({
    items: [],
    activeItem: null,
    setItems: (items) => set({ items }),
    setActiveItem: (item) => set({ activeItem: item })
}));
