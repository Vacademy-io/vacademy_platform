import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChatbotPanelState {
  // Panel open/close state
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  togglePanel: () => void;

  // Panel width (for resizable behavior)
  panelWidth: number;
  setPanelWidth: (width: number) => void;

  // Docked mode: when true, the docked panel is being used instead of floating overlay
  isDockedMode: boolean;
  setIsDockedMode: (isDockedMode: boolean) => void;

  // Constants
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
}

export const useChatbotPanelStore = create<ChatbotPanelState>()(
  persist(
    (set) => ({
      // Default state
      isOpen: false,
      panelWidth: 350,
      isDockedMode: false,

      // Constants
      minWidth: 280,
      maxWidth: 600,
      defaultWidth: 350,

      // Actions
      setIsOpen: (isOpen) => set({ isOpen }),
      togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
      setPanelWidth: (width) =>
        set((state) => ({
          panelWidth: Math.max(state.minWidth, Math.min(state.maxWidth, width)),
        })),
      setIsDockedMode: (isDockedMode) => set({ isDockedMode }),
    }),
    {
      name: "chatbot-panel-storage",
      partialize: (state) => ({
        isOpen: state.isOpen,
        panelWidth: state.panelWidth,
      }),
    }
  )
);
