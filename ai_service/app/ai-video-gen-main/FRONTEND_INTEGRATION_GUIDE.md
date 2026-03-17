# Frontend Integration Guide: Multi-Content Type Support

> **Last Updated**: February 2026
> **Author**: AI Service Team
> **For**: Frontend Development Team

---

## Overview

The AI content generation backend now supports **12 different content types** beyond just videos. This document explains what changes the frontend needs to implement to support these new content types.

## What Changed (Backend)

### New Content Types Added

| Content Type        | Navigation         | Entry Label  | Use Case                              |
| ------------------- | ------------------ | ------------ | ------------------------------------- |
| `WORKSHEET`       | `user_driven`    | `exercise` | Printable homework, practice problems |
| `CODE_PLAYGROUND` | `self_contained` | `exercise` | Interactive coding exercises          |
| `TIMELINE`        | `user_driven`    | `event`    | Historical timelines, process flows   |
| `CONVERSATION`    | `user_driven`    | `exchange` | Language learning dialogues           |

### Full Content Type List

```typescript
type ContentType =
  | "VIDEO" // Default: time-synced HTML overlays
  | "QUIZ" // Question-based assessments
  | "STORYBOOK" // Page-by-page narratives
  | "INTERACTIVE_GAME" // Self-contained HTML5 games
  | "PUZZLE_BOOK" // Collection of puzzles
  | "SIMULATION" // Physics/science sandboxes
  | "FLASHCARDS" // Spaced-repetition cards
  | "MAP_EXPLORATION" // Interactive SVG maps
  | "WORKSHEET" // NEW: Printable worksheets
  | "CODE_PLAYGROUND" // NEW: Code editor exercises
  | "TIMELINE" // NEW: Chronological visualization
  | "CONVERSATION"; // NEW: Language dialogues
```

---

## API Changes

### Request Schema

The API request now accepts a `content_type` field:

```typescript
interface VideoGenerationRequest {
  prompt: string;
  content_type?: ContentType; // Default: "VIDEO"
  language?: string; // Default: "English"
  target_audience?: string; // Default: "General/Adult"
  target_duration?: string; // Default: "2-3 minutes"
  captions_enabled?: boolean; // Default: true
  html_quality?: "classic" | "advanced"; // Default: "advanced"
  video_id?: string; // Optional
  institute_id?: string; // For branding
}
```

### Response Schema

The `time_based_frame.json` now includes additional metadata:

```typescript
interface TimeBasedFrame {
  meta: {
    content_type: ContentType; // NEW: Type of content
    navigation: NavigationType; // NEW: How to navigate
    entry_label: string; // NEW: UI label for entries
    audio_start_at: number;
    total_duration: number | null;
    dimensions: { width: number; height: number };
    branding?: BrandingConfig;
  };
  entries: Entry[];
}

type NavigationType = "time_driven" | "user_driven" | "self_contained";
```

---

## Frontend Implementation Requirements

### 1. Navigation Mode Handler

Create a navigation controller that switches behavior based on `meta.navigation`:

```typescript
// navigation-controller.ts

export function initializeNavigation(meta: FrameMeta, entries: Entry[]) {
  switch (meta.navigation) {
    case "time_driven":
      return new TimeDrivenNavigation(entries);

    case "user_driven":
      return new UserDrivenNavigation(entries, meta.entry_label);

    case "self_contained":
      return new SelfContainedNavigation(entries[0]);
  }
}
```

#### Time-Driven Navigation (VIDEO)

```typescript
class TimeDrivenNavigation {
  private audio: HTMLAudioElement;
  private currentIndex = 0;

  constructor(entries: Entry[]) {
    this.audio = document.getElementById("audio") as HTMLAudioElement;

    this.audio.ontimeupdate = () => {
      const currentTime = this.audio.currentTime;
      const newIndex = entries.findIndex(
        (e) => currentTime >= e.start && currentTime < e.end,
      );

      if (newIndex !== -1 && newIndex !== this.currentIndex) {
        this.currentIndex = newIndex;
        this.renderEntry(entries[newIndex]);
      }
    };
  }

  play() {
    this.audio.play();
  }
  pause() {
    this.audio.pause();
  }
  seek(time: number) {
    this.audio.currentTime = time;
  }
}
```

#### User-Driven Navigation (QUIZ, STORYBOOK, WORKSHEET, TIMELINE, etc.)

```typescript
class UserDrivenNavigation {
  private currentIndex = 0;
  private entries: Entry[];
  private entryLabel: string;

  constructor(entries: Entry[], entryLabel: string) {
    this.entries = entries;
    this.entryLabel = entryLabel;
    this.showNavigationControls();
    this.renderEntry(entries[0]);
  }

  showNavigationControls() {
    const controls = document.getElementById("nav-controls");
    controls.innerHTML = `
      <button id="prev-btn" disabled>← Previous</button>
      <span id="progress">${this.entryLabel} 1 of ${this.entries.length}</span>
      <button id="next-btn">Next →</button>
    `;

    document.getElementById("prev-btn").onclick = () => this.prev();
    document.getElementById("next-btn").onclick = () => this.next();
  }

  next() {
    if (this.currentIndex < this.entries.length - 1) {
      this.currentIndex++;
      this.renderEntry(this.entries[this.currentIndex]);
      this.updateProgress();
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.renderEntry(this.entries[this.currentIndex]);
      this.updateProgress();
    }
  }

  updateProgress() {
    const label =
      this.entryLabel.charAt(0).toUpperCase() + this.entryLabel.slice(1);
    document.getElementById("progress").textContent =
      `${label} ${this.currentIndex + 1} of ${this.entries.length}`;

    document.getElementById("prev-btn").disabled = this.currentIndex === 0;
    document.getElementById("next-btn").disabled =
      this.currentIndex === this.entries.length - 1;
  }
}
```

#### Self-Contained Navigation (INTERACTIVE_GAME, SIMULATION, CODE_PLAYGROUND)

```typescript
class SelfContainedNavigation {
  constructor(entry: Entry) {
    // Just render the single entry
    // All interactivity is within the HTML itself
    const container = document.getElementById("content-container");
    container.innerHTML = entry.html;

    // Execute any inline scripts
    this.executeScripts(container);

    // Hide navigation controls
    document.getElementById("nav-controls").style.display = "none";
  }

  executeScripts(container: HTMLElement) {
    const scripts = container.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }
}
```

---

### 2. Library Loading by Content Type

Load appropriate libraries based on content type:

```typescript
// library-loader.ts

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
  // NEW CONTENT TYPES
  WORKSHEET: [
    "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js",
    // Minimal JS - mostly print-friendly
  ],
  CODE_PLAYGROUND: [
    "https://cdn.jsdelivr.net/npm/prismjs@1.29/prism.min.js",
    "https://cdn.jsdelivr.net/npm/prismjs@1.29/components/prism-javascript.min.js",
    "https://cdn.jsdelivr.net/npm/prismjs@1.29/components/prism-python.min.js",
  ],
  TIMELINE: ["https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"],
  CONVERSATION: [
    "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js",
    "https://cdn.jsdelivr.net/npm/howler@2.2/dist/howler.min.js",
  ],
};

export async function loadLibraries(contentType: ContentType): Promise<void> {
  const libs = LIBRARY_CONFIG[contentType] || [];

  await Promise.all(
    libs.map((src) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }),
  );
}
```

---

### 3. Entry Label Display

Use `meta.entry_label` to display appropriate progress text:

```typescript
// Entry label capitalization helper
function formatEntryLabel(label: string, index: number, total: number): string {
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return `${capitalized} ${index + 1} of ${total}`;
}

// Examples:
// "segment" → "Segment 3 of 10"   (VIDEO)
// "question" → "Question 5 of 15" (QUIZ)
// "page" → "Page 7 of 12"         (STORYBOOK)
// "exercise" → "Exercise 2 of 8"  (WORKSHEET, CODE_PLAYGROUND)
// "event" → "Event 4 of 20"       (TIMELINE)
// "exchange" → "Exchange 3 of 10" (CONVERSATION)
```

---

### 4. Content Type Specific UI

#### WORKSHEET: Print Button

```typescript
if (meta.content_type === "WORKSHEET") {
  // Add print button to toolbar
  const printBtn = document.createElement("button");
  printBtn.textContent = "🖨️ Print Worksheet";
  printBtn.onclick = () => window.print();
  toolbar.appendChild(printBtn);

  // Add print-specific CSS
  const printCSS = document.createElement("style");
  printCSS.textContent = `
    @media print {
      #nav-controls, #audio-player, .no-print { display: none !important; }
      .worksheet-container { max-width: 100%; padding: 0; }
    }
  `;
  document.head.appendChild(printCSS);
}
```

#### CODE_PLAYGROUND: Run Button Handler

The HTML already includes the run button and logic, but you may want to add security measures:

```typescript
if (meta.content_type === "CODE_PLAYGROUND") {
  // Sandbox code execution
  // The generated HTML uses eval() for JavaScript
  // For production, consider using a sandboxed iframe or Web Worker

  console.log("Code Playground loaded - execution is client-side only");
}
```

#### CONVERSATION: Audio for Pronunciation

```typescript
if (meta.content_type === "CONVERSATION") {
  // Enable text-to-speech for dialogue bubbles
  document.querySelectorAll(".audio-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn
        .closest(".message-content")
        .querySelector(".speech-text").textContent;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = meta.target_language || "en-US";
      speechSynthesis.speak(utterance);
    });
  });
}
```

#### TIMELINE: Image Generation

Timeline events may include `image_prompt` for AI-generated images:

```typescript
if (meta.content_type === "TIMELINE") {
  // Find all images with data-img-prompt attribute
  document.querySelectorAll("img[data-img-prompt]").forEach(async (img) => {
    const prompt = img.getAttribute("data-img-prompt");
    if (prompt && img.src.includes("placeholder")) {
      // Call image generation API or use pre-generated images
      // img.src = await generateImage(prompt);
    }
  });
}
```

---

### 5. Audio Handling by Navigation Type

```typescript
function setupAudio(meta: FrameMeta, entries: Entry[]) {
  const audioPlayer = document.getElementById(
    "audio-player",
  ) as HTMLAudioElement;

  switch (meta.navigation) {
    case "time_driven":
      // Audio controls the timeline
      audioPlayer.style.display = "block";
      // Show full controls: play, pause, seek, speed, volume
      break;

    case "user_driven":
      // Audio plays per-entry (optional)
      // May have separate audio clips per entry
      audioPlayer.style.display = "none"; // Or show simplified controls

      // If entries have individual audio:
      entries.forEach((entry, index) => {
        if (entry.audio_url) {
          // Preload audio for this entry
        }
      });
      break;

    case "self_contained":
      // Audio is handled within the HTML itself (e.g., game sounds)
      audioPlayer.style.display = "none";
      break;
  }
}
```

---

## Complete Integration Example

```typescript
// main.ts - Content Player Initialization

import { loadLibraries } from "./library-loader";
import { initializeNavigation } from "./navigation-controller";

interface TimeBasedFrame {
  meta: FrameMeta;
  entries: Entry[];
}

async function initializePlayer(frameData: TimeBasedFrame) {
  const { meta, entries } = frameData;

  // 1. Load required libraries
  await loadLibraries(meta.content_type);

  // 2. Initialize navigation based on mode
  const navigation = initializeNavigation(meta, entries);

  // 3. Setup audio handling
  setupAudio(meta, entries);

  // 4. Apply content-type specific UI
  applyContentTypeUI(meta);

  // 5. Render first entry
  if (meta.navigation !== "self_contained") {
    renderEntry(entries[0]);
  }

  console.log(
    `Initialized ${meta.content_type} player with ${entries.length} entries`,
  );
}

function applyContentTypeUI(meta: FrameMeta) {
  const toolbar = document.getElementById("toolbar");

  // Add print button for worksheets
  if (meta.content_type === "WORKSHEET") {
    addPrintButton(toolbar);
  }

  // Update progress label format
  document.getElementById("progress-label").dataset.entryLabel =
    meta.entry_label;

  // Set appropriate title/header
  const typeLabels: Record<ContentType, string> = {
    VIDEO: "🎬 Video",
    QUIZ: "📝 Quiz",
    STORYBOOK: "📖 Storybook",
    INTERACTIVE_GAME: "🎮 Game",
    PUZZLE_BOOK: "🧩 Puzzles",
    SIMULATION: "🔬 Simulation",
    FLASHCARDS: "🃏 Flashcards",
    MAP_EXPLORATION: "🗺️ Map",
    WORKSHEET: "📋 Worksheet",
    CODE_PLAYGROUND: "💻 Code",
    TIMELINE: "⏳ Timeline",
    CONVERSATION: "🗣️ Conversation",
  };

  document.getElementById("content-type-badge").textContent =
    typeLabels[meta.content_type];
}

// Usage
fetch("/api/content/abc123/time_based_frame.json")
  .then((res) => res.json())
  .then(initializePlayer);
```

---

## Testing Checklist

### For Each New Content Type, Test:

- [ ] **WORKSHEET**

  - [ ] Renders print-friendly layout
  - [ ] Print button works
  - [ ] User can navigate between sections
  - [ ] Answer inputs work (if interactive mode)
- [ ] **CODE_PLAYGROUND**

  - [ ] Code editor displays correctly
  - [ ] Run button executes code
  - [ ] Output panel shows results
  - [ ] Hints system works
  - [ ] Solution reveal works
- [ ] **TIMELINE**

  - [ ] Events display chronologically
  - [ ] Hover cards appear
  - [ ] Detail panel opens on click
  - [ ] Era color-coding visible
- [ ] **CONVERSATION**

  - [ ] Dialogue bubbles render correctly
  - [ ] Response buttons work
  - [ ] Feedback popup shows
  - [ ] Translation toggle works
  - [ ] Audio pronunciation (if implemented)

---

## Migration Notes

### Breaking Changes: None

The API is fully backward compatible:

- `content_type` defaults to `"VIDEO"`
- Existing VIDEO content works unchanged
- `navigation` and `entry_label` are new fields but have sensible defaults

### Recommended Frontend Version

Ensure your frontend player version supports:

- Dynamic library loading
- Navigation mode switching
- Entry label customization

---

## Questions?

Contact the AI Service team on Slack: `#ai-content-generation`
