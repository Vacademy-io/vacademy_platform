import { create } from "zustand";

interface DoubtSidebarStore {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useDoubtSidebarStore = create<DoubtSidebarStore>((set, get) => ({
  isOpen: false,
  setIsOpen: (open: boolean) => set({ isOpen: open }),
  toggle: () => set({ isOpen: !get().isOpen }),
})); 