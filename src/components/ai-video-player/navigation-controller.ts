import type { Frame, TimelineMeta, NavigationType } from "./types";

/**
 * Base navigation controller interface
 */
export interface NavigationController {
  type: NavigationType;
  currentIndex: number;
  totalEntries: number;
  canGoNext: boolean;
  canGoPrev: boolean;
  getCurrentEntry: () => Frame | null;
  next: () => Frame | null;
  prev: () => Frame | null;
  goTo: (index: number) => Frame | null;
  getProgress: () => { current: number; total: number; label: string };
  dispose: () => void;
}

/**
 * Time-driven navigation for VIDEO content
 * Navigation is controlled by audio playback
 */
export class TimeDrivenNavigation implements NavigationController {
  type: NavigationType = "time_driven";
  entries: Frame[];
  currentIndex: number = 0;
  entryLabel: string;

  constructor(entries: Frame[], entryLabel: string = "segment") {
    this.entries = entries;
    this.entryLabel = entryLabel;
  }

  get totalEntries() {
    return this.entries.length;
  }

  get canGoNext() {
    return this.currentIndex < this.entries.length - 1;
  }

  get canGoPrev() {
    return this.currentIndex > 0;
  }

  /**
   * Find active entries based on current audio time
   */
  getEntriesAtTime(currentTime: number): Frame[] {
    return this.entries.filter(
      (entry) => currentTime >= entry.inTime && currentTime <= entry.exitTime
    );
  }

  /**
   * Update current index based on time and return active entries
   */
  updateForTime(currentTime: number): { entries: Frame[]; newIndex: number } {
    const activeEntries = this.getEntriesAtTime(currentTime);

    if (activeEntries.length > 0) {
      // Find the index of the first active entry
      const newIndex = this.entries.findIndex(
        (e) => e.id === activeEntries[0].id
      );
      if (newIndex !== -1) {
        this.currentIndex = newIndex;
      }
    }

    return { entries: activeEntries, newIndex: this.currentIndex };
  }

  getCurrentEntry() {
    return this.entries[this.currentIndex] || null;
  }

  next() {
    if (this.canGoNext) {
      this.currentIndex++;
      return this.getCurrentEntry();
    }
    return null;
  }

  prev() {
    if (this.canGoPrev) {
      this.currentIndex--;
      return this.getCurrentEntry();
    }
    return null;
  }

  goTo(index: number) {
    if (index >= 0 && index < this.entries.length) {
      this.currentIndex = index;
      return this.getCurrentEntry();
    }
    return null;
  }

  getProgress() {
    const label = this.entryLabel.charAt(0).toUpperCase() + this.entryLabel.slice(1);
    return {
      current: this.currentIndex + 1,
      total: this.entries.length,
      label: `${label} ${this.currentIndex + 1} of ${this.entries.length}`,
    };
  }

  /**
   * Get the start time of an entry for seeking
   */
  getEntryStartTime(index: number): number {
    return this.entries[index]?.inTime || 0;
  }

  dispose() {
    // Cleanup if needed
  }
}

/**
 * User-driven navigation for QUIZ, STORYBOOK, WORKSHEET, TIMELINE, etc.
 * Navigation is controlled by user clicking prev/next
 */
export class UserDrivenNavigation implements NavigationController {
  type: NavigationType = "user_driven";
  entries: Frame[];
  currentIndex: number = 0;
  entryLabel: string;
  private onChangeCallback?: (entry: Frame, index: number) => void;

  constructor(
    entries: Frame[],
    entryLabel: string = "page",
    onChange?: (entry: Frame, index: number) => void
  ) {
    this.entries = entries;
    this.entryLabel = entryLabel;
    this.onChangeCallback = onChange;
  }

  get totalEntries() {
    return this.entries.length;
  }

  get canGoNext() {
    return this.currentIndex < this.entries.length - 1;
  }

  get canGoPrev() {
    return this.currentIndex > 0;
  }

  getCurrentEntry() {
    return this.entries[this.currentIndex] || null;
  }

  next() {
    if (this.canGoNext) {
      this.currentIndex++;
      const entry = this.getCurrentEntry();
      if (entry && this.onChangeCallback) {
        this.onChangeCallback(entry, this.currentIndex);
      }
      return entry;
    }
    return null;
  }

  prev() {
    if (this.canGoPrev) {
      this.currentIndex--;
      const entry = this.getCurrentEntry();
      if (entry && this.onChangeCallback) {
        this.onChangeCallback(entry, this.currentIndex);
      }
      return entry;
    }
    return null;
  }

  goTo(index: number) {
    if (index >= 0 && index < this.entries.length) {
      this.currentIndex = index;
      const entry = this.getCurrentEntry();
      if (entry && this.onChangeCallback) {
        this.onChangeCallback(entry, this.currentIndex);
      }
      return entry;
    }
    return null;
  }

  getProgress() {
    const label = this.entryLabel.charAt(0).toUpperCase() + this.entryLabel.slice(1);
    return {
      current: this.currentIndex + 1,
      total: this.entries.length,
      label: `${label} ${this.currentIndex + 1} of ${this.entries.length}`,
    };
  }

  dispose() {
    this.onChangeCallback = undefined;
  }
}

/**
 * Self-contained navigation for INTERACTIVE_GAME, SIMULATION, CODE_PLAYGROUND
 * All interactivity is within the HTML itself, no external navigation needed
 */
export class SelfContainedNavigation implements NavigationController {
  type: NavigationType = "self_contained";
  entry: Frame;
  currentIndex: number = 0;
  entryLabel: string;

  constructor(entry: Frame, entryLabel: string = "level") {
    this.entry = entry;
    this.entryLabel = entryLabel;
  }

  get totalEntries() {
    return 1;
  }

  get canGoNext() {
    return false;
  }

  get canGoPrev() {
    return false;
  }

  getCurrentEntry() {
    return this.entry;
  }

  next() {
    return null;
  }

  prev() {
    return null;
  }

  goTo(_index: number) {
    return this.entry;
  }

  getProgress() {
    const label = this.entryLabel.charAt(0).toUpperCase() + this.entryLabel.slice(1);
    return {
      current: 1,
      total: 1,
      label: `${label} 1 of 1`,
    };
  }

  dispose() {
    // Cleanup if needed
  }
}

/**
 * Factory function to create the appropriate navigation controller
 */
export function createNavigationController(
  meta: TimelineMeta,
  entries: Frame[],
  onChange?: (entry: Frame, index: number) => void
): NavigationController {
  const { navigation, entry_label } = meta;

  switch (navigation) {
    case "time_driven":
      return new TimeDrivenNavigation(entries, entry_label);

    case "user_driven":
      return new UserDrivenNavigation(entries, entry_label, onChange);

    case "self_contained":
      // For self-contained, we only use the first entry
      return new SelfContainedNavigation(entries[0], entry_label);

    default:
      // Default to time-driven for backward compatibility
      console.warn(`[NavigationController] Unknown navigation type: ${navigation}, defaulting to time_driven`);
      return new TimeDrivenNavigation(entries, entry_label);
  }
}

/**
 * Helper to format entry label for display
 */
export function formatEntryLabel(label: string, index: number, total: number): string {
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return `${capitalized} ${index + 1} of ${total}`;
}
