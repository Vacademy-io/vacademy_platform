import { create } from "zustand";
import { persist } from "zustand/middleware";

// Which side edge the floating chat button (FAB) hugs. It can be dragged freely,
// but on release it snaps horizontally to the nearest edge while keeping the
// vertical spot where it was dropped (so it can sit at any height, not a corner).
export type FabSide = "left" | "right";

// Persisted position of the FAB. `null` means "use the default docked
// bottom-right position". `yRatio` (0..1 of viewport height) is resize-proof.
export interface FabPosition {
  side: FabSide;
  yRatio: number;
}

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

  // Floating button (FAB) position — where the user dragged the launcher to
  fabPosition: FabPosition | null;
  setFabPosition: (position: FabPosition | null) => void;

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
      fabPosition: null,

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
      setFabPosition: (fabPosition) => set({ fabPosition }),
    }),
    {
      name: "chatbot-panel-storage",
      version: 3,
      // Older builds used other position shapes ({ xRatio, yRatio }, { corner }).
      // Drop anything that isn't the current { side, yRatio } shape.
      migrate: (persisted: unknown, version: number): ChatbotPanelState => {
        const state = persisted as ChatbotPanelState;
        const p = state?.fabPosition as { side?: unknown } | null;
        if (version < 3 && p && p.side !== "left" && p.side !== "right") {
          return { ...state, fabPosition: null };
        }
        return state;
      },
      partialize: (state) => ({
        isOpen: state.isOpen,
        panelWidth: state.panelWidth,
        fabPosition: state.fabPosition,
      }),
    }
  )
);
