/**
 * Library Loader
 * Dynamic loading of required JavaScript libraries based on content type
 */

import { ContentType } from './types';

/**
 * Library configuration by content type
 */
const LIBRARY_CONFIG: Record<ContentType, string[]> = {
    VIDEO: [
        'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js',
        'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js',
        'https://unpkg.com/rough-notation/lib/rough-notation.iife.js',
        'https://cdn.jsdelivr.net/npm/vivus@0.4.6/dist/vivus.min.js',
        'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
        'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js',
        'https://cdn.jsdelivr.net/npm/prismjs@1.29/prism.min.js',
        'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js',
    ],
    QUIZ: [
        'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js',
        'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6/dist/confetti.browser.min.js',
    ],
    STORYBOOK: [
        'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js',
        'https://cdn.jsdelivr.net/npm/swiper@10/swiper-bundle.min.js',
        'https://cdn.jsdelivr.net/npm/howler@2.2/dist/howler.min.js',
    ],
    INTERACTIVE_GAME: [
        'https://cdn.jsdelivr.net/npm/interactjs@1.10/dist/interact.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js',
        'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6/dist/confetti.browser.min.js',
        'https://cdn.jsdelivr.net/npm/howler@2.2/dist/howler.min.js',
    ],
    PUZZLE_BOOK: [
        'https://cdn.jsdelivr.net/npm/interactjs@1.10/dist/interact.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js',
    ],
    SIMULATION: [
        'https://cdn.jsdelivr.net/npm/matter-js@0.19/build/matter.min.js',
        'https://cdn.jsdelivr.net/npm/p5@1.7/lib/p5.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js',
    ],
    FLASHCARDS: [
        'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js',
        'https://cdn.jsdelivr.net/npm/swiper@10/swiper-bundle.min.js',
    ],
    MAP_EXPLORATION: ['https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js'],
    WORKSHEET: [
        'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js',
        // Minimal JS - mostly print-friendly
    ],
    CODE_PLAYGROUND: [
        'https://cdn.jsdelivr.net/npm/prismjs@1.29/prism.min.js',
        'https://cdn.jsdelivr.net/npm/prismjs@1.29/components/prism-javascript.min.js',
        'https://cdn.jsdelivr.net/npm/prismjs@1.29/components/prism-python.min.js',
    ],
    TIMELINE: ['https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js'],
    CONVERSATION: [
        'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js',
        'https://cdn.jsdelivr.net/npm/howler@2.2/dist/howler.min.js',
    ],
    SLIDES: [],
};

/**
 * Track loaded libraries to avoid duplicate loading
 */
const loadedLibraries = new Set<string>();

/**
 * Load a single script
 */
function loadScript(src: string): Promise<void> {
    return new Promise((resolve) => {
        // Skip if already loaded
        if (loadedLibraries.has(src)) {
            resolve();
            return;
        }

        // Check if script already exists in DOM
        const existingScript = document.querySelector(`script[src="${src}"]`);
        if (existingScript) {
            loadedLibraries.add(src);
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;

        script.onload = () => {
            loadedLibraries.add(src);
            resolve();
        };

        script.onerror = () => {
            console.warn(`Failed to load library: ${src}`);
            // Resolve anyway to not block other libraries
            resolve();
        };

        document.head.appendChild(script);
    });
}

/**
 * Load all required libraries for a content type
 */
export async function loadLibraries(contentType: ContentType): Promise<void> {
    const libs = LIBRARY_CONFIG[contentType] || [];

    if (libs.length === 0) {
        return;
    }

    console.log(`📚 Loading libraries for ${contentType}:`, libs);

    await Promise.all(libs.map(loadScript));

    console.log(`✅ Libraries loaded for ${contentType}`);
}

/**
 * Load CSS stylesheets for content type
 */
const CSS_CONFIG: Partial<Record<ContentType, string[]>> = {
    CODE_PLAYGROUND: [
        'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css',
    ],
    VIDEO: [
        'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
        'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css',
    ],
};

/**
 * Load CSS stylesheets
 */
export async function loadStyles(contentType: ContentType): Promise<void> {
    const styles = CSS_CONFIG[contentType] || [];

    styles.forEach((href) => {
        const existingLink = document.querySelector(`link[href="${href}"]`);
        if (!existingLink) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        }
    });
}

/**
 * Initialize libraries
 */
export async function initializeLibraries(contentType: ContentType): Promise<void> {
    await loadStyles(contentType);
    await loadLibraries(contentType);
}
