// Main component export
export { AIVideoPlayer } from "./AIVideoPlayer";
export type { AIVideoPlayerProps } from "./AIVideoPlayer";

// Types
export type {
  ContentType,
  NavigationType,
  EntryLabel,
  BrandingConfig,
  Frame,
  TimelineMeta,
  TimelineData,
} from "./types";

export {
  CONTENT_TYPE_LABELS,
  NAVIGATION_CONFIG,
  DEFAULT_ENTRY_LABELS,
} from "./types";

// Library loader utilities
export { loadLibraries, getLibraryUrls, getLibraryScriptTags } from "./library-loader";

// Navigation controller
export {
  createNavigationController,
  TimeDrivenNavigation,
  UserDrivenNavigation,
  SelfContainedNavigation,
  formatEntryLabel,
} from "./navigation-controller";
export type { NavigationController } from "./navigation-controller";
