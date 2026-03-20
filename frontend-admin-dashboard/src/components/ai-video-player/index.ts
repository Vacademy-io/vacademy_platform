// New unified content player (supports all 12 content types)
export { AIContentPlayer, AIVideoPlayer as AIVideoPlayerNew } from './AIContentPlayer';
export type { AIContentPlayerProps } from './types';

// Legacy video player (backward compatible)
export { AIVideoPlayer } from './AIVideoPlayer';
export type { AIVideoPlayerProps, Frame } from './AIVideoPlayer';

// Type exports
export type {
    ContentType,
    NavigationType,
    Entry,
    TimelineMeta,
    TimelineData,
    BrandingConfig,
    // Caption types
    WordTimestamp,
    CaptionSettings,
    CaptionPosition,
    CaptionFontSize,
    CaptionStyle,
} from './types';

export {
    CONTENT_TYPE_LABELS,
    CONTENT_TYPE_NAVIGATION,
    CONTENT_TYPE_ENTRY_LABELS,
    formatEntryLabel,
    getDefaultMeta,
    // Caption defaults
    DEFAULT_CAPTION_SETTINGS,
    CAPTION_FONT_SIZES,
} from './types';

// Utility exports
export { processHtmlContent, fixHtmlContent } from './html-processor';
export { initializeLibraries, loadLibraries } from './library-loader';

// Hook exports
export * from './hooks';


// Component exports
export { CaptionDisplay, CaptionSettingsPopover } from './components';
