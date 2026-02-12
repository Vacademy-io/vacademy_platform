import type { ContentType } from "./types";

// Library configuration by content type
const LIBRARY_CONFIG: Record<ContentType, string[]> = {
  VIDEO: [
    "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js",
    "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js",
    "https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.js",
    "https://cdn.jsdelivr.net/npm/prismjs@1.29/prism.min.js",
  ],
  QUIZ: [
    "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js",
    "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6/dist/confetti.browser.min.js",
  ],
  STORYBOOK: [
    "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js",
    "https://cdn.jsdelivr.net/npm/swiper@10/swiper-bundle.min.js",
    "https://cdn.jsdelivr.net/npm/howler@2.2/dist/howler.min.js",
  ],
  INTERACTIVE_GAME: [
    "https://cdn.jsdelivr.net/npm/interactjs@1.10/dist/interact.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js",
    "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6/dist/confetti.browser.min.js",
    "https://cdn.jsdelivr.net/npm/howler@2.2/dist/howler.min.js",
  ],
  PUZZLE_BOOK: [
    "https://cdn.jsdelivr.net/npm/interactjs@1.10/dist/interact.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js",
  ],
  SIMULATION: [
    "https://cdn.jsdelivr.net/npm/matter-js@0.19/build/matter.min.js",
    "https://cdn.jsdelivr.net/npm/p5@1.7/lib/p5.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js",
  ],
  FLASHCARDS: [
    "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js",
    "https://cdn.jsdelivr.net/npm/swiper@10/swiper-bundle.min.js",
  ],
  MAP_EXPLORATION: [
    "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js",
  ],
  WORKSHEET: [
    "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js",
    // Minimal JS - mostly print-friendly
  ],
  CODE_PLAYGROUND: [
    "https://cdn.jsdelivr.net/npm/prismjs@1.29/prism.min.js",
    "https://cdn.jsdelivr.net/npm/prismjs@1.29/components/prism-javascript.min.js",
    "https://cdn.jsdelivr.net/npm/prismjs@1.29/components/prism-python.min.js",
  ],
  TIMELINE: [
    "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js",
  ],
  CONVERSATION: [
    "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js",
    "https://cdn.jsdelivr.net/npm/howler@2.2/dist/howler.min.js",
  ],
};

// Track loaded libraries to avoid duplicate loading
const loadedLibraries = new Set<string>();

/**
 * Load a single script dynamically
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Skip if already loaded
    if (loadedLibraries.has(src)) {
      resolve();
      return;
    }

    // Check if script already exists in DOM
    if (document.querySelector(`script[src="${src}"]`)) {
      loadedLibraries.add(src);
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      loadedLibraries.add(src);
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Load all required libraries for a specific content type
 */
export async function loadLibraries(contentType: ContentType): Promise<void> {
  const libs = LIBRARY_CONFIG[contentType] || [];

  if (libs.length === 0) {
    return;
  }

  console.log(`[LibraryLoader] Loading ${libs.length} libraries for ${contentType}`);

  try {
    await Promise.all(libs.map(loadScript));
    console.log(`[LibraryLoader] All libraries loaded for ${contentType}`);
  } catch (error) {
    console.error(`[LibraryLoader] Error loading libraries for ${contentType}:`, error);
    throw error;
  }
}

/**
 * Get the list of library URLs for a content type
 */
export function getLibraryUrls(contentType: ContentType): string[] {
  return LIBRARY_CONFIG[contentType] || [];
}

/**
 * Generate inline script tags for embedding in iframe
 */
export function getLibraryScriptTags(contentType: ContentType): string {
  const libs = LIBRARY_CONFIG[contentType] || [];
  return libs.map((src) => `<script src="${src}"></script>`).join("\n");
}
