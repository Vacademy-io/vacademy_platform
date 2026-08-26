import { create } from "zustand";

/**
 * Tracks whether a learner is inside a live assessment attempt.
 *
 * The exam shell owns the whole viewport, but the app root renders a few
 * siblings above it — the chatbot launcher/panel, OTA banner, announcement
 * overlays. On a phone those either cover the exam's own controls or push the
 * safe zone off-screen, and an AI chatbot inside a proctored exam is an
 * integrity problem on any device. `page.tsx` raises this flag on mount and
 * clears it on unmount; `__root.tsx` reads it to stand those surfaces down.
 *
 * `hideAppChrome` mirrors the institute's
 * `ASSESSMENT_SETTING.examExperience.mobile.hideAppNavigation` toggle so the
 * banner/overlay suppression stays configurable; the chatbot is suppressed on
 * `isActive` alone.
 */
interface LiveTestStore {
  isActive: boolean;
  hideAppChrome: boolean;
  /**
   * Whether Android's system bars are actually hidden right now. False on iOS
   * and web, and false on an Android shell whose native side predates the
   * Immersive plugin — an OTA bundle can outlive the APK it shipped in, so the
   * exam screens read this to decide whether they still need to pad around a
   * status bar that is really there.
   */
  immersiveActive: boolean;
  setLiveTest: (state: { isActive: boolean; hideAppChrome?: boolean }) => void;
  setImmersiveActive: (active: boolean) => void;
}

export const useLiveTestStore = create<LiveTestStore>((set) => ({
  isActive: false,
  hideAppChrome: false,
  immersiveActive: false,
  setLiveTest: ({ isActive, hideAppChrome }) =>
    set({ isActive, hideAppChrome: hideAppChrome ?? false }),
  setImmersiveActive: (active) => set({ immersiveActive: active }),
}));
