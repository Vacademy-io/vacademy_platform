// Main component export
export { AIVideoPlayer } from "./AIVideoPlayer";
export type { AIVideoPlayerProps } from "./AIVideoPlayer";

// Types
export type {
  ContentType,
  NavigationType,
  BrandingConfig,
  Frame,
  TimelineMeta,
  TimelineData,
} from "./types";

export {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_NAVIGATION,
  CONTENT_TYPE_ENTRY_LABELS,
  formatEntryLabel,
} from "./types";

// Library loader utilities
export { loadLibraries, getLibraryUrls, getLibraryScriptTags } from "./library-loader";

// Navigation controller
export {
  createNavigationController,
  TimeDrivenNavigation,
  UserDrivenNavigation,
  SelfContainedNavigation,
} from "./navigation-controller";
export type { NavigationController } from "./navigation-controller";
