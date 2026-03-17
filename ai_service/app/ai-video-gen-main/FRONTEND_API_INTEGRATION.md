# Frontend API Integration Guide

## Multi-Format AI Content Generation API

This guide documents the frontend changes required to integrate with the enhanced AI Video Generation API that now supports multiple content types.

---

## API Endpoint

```
POST /ai-service/external/video/v1/generate
```

**Authentication:** `X-Institute-Key` header required

---

## Request Schema: `VideoGenerationRequest`

```typescript
interface VideoGenerationRequest {
  // Required
  prompt: string; // Text prompt for content generation

  // Optional with defaults
  content_type?: ContentType; // Default: "VIDEO"
  language?: string; // Default: "English"
  captions_enabled?: boolean; // Default: true
  html_quality?: "classic" | "advanced"; // Default: "advanced"
  video_id?: string; // Auto-generated UUID if not provided
  target_audience?: string; // Default: "General/Adult"
  target_duration?: string; // Default: "2-3 minutes"
  voice_gender?: "male" | "female"; // Default: "female"
  tts_provider?: "edge" | "google"; // Default: "edge"
  model?: string; // AI model override (optional)
}

// NEW: Content type options
type ContentType =
  | "VIDEO" // Time-synced HTML overlays with audio (default)
  | "QUIZ" // Question-based assessments
  | "STORYBOOK" // Page-by-page narratives
  | "INTERACTIVE_GAME" // Self-contained HTML games
  | "PUZZLE_BOOK" // Collection of puzzles (crossword, word search)
  | "SIMULATION" // Physics/economic sandboxes
  | "FLASHCARDS" // Spaced-repetition cards
  | "MAP_EXPLORATION" // Interactive SVG maps
  | "WORKSHEET" // Printable/interactive homework
  | "CODE_PLAYGROUND" // Interactive code exercises
  | "TIMELINE" // Chronological event visualization
  | "CONVERSATION"; // Language learning dialogues
```

---

## Response Headers

| Header           | Description                                |
| ---------------- | ------------------------------------------ |
| `X-Video-ID`     | The generated or provided video/content ID |
| `X-Content-Type` | **NEW**: The content type being generated  |

---

## SSE Event Stream

The endpoint returns Server-Sent Events (SSE). Parse events like this:

```typescript
interface SSEEvent {
  type: "progress" | "completed" | "error" | "info";
  stage?: string; // "SCRIPT" | "TTS" | "WORDS" | "HTML"
  message?: string;
  percentage?: number; // 0-100
  video_id?: string;
  content_type?: string; // NEW: Included in events
  files?: Record<string, string>; // S3 URLs when completed
}
```

---

## Content Type to Navigation Mode Mapping

Frontend must render content differently based on navigation mode:

```typescript
const NAVIGATION_MAP: Record<ContentType, NavigationMode> = {
  VIDEO: "time_driven",
  QUIZ: "user_driven",
  STORYBOOK: "user_driven",
  INTERACTIVE_GAME: "self_contained",
  PUZZLE_BOOK: "user_driven",
  SIMULATION: "self_contained",
  FLASHCARDS: "user_driven",
  MAP_EXPLORATION: "user_driven",
  WORKSHEET: "user_driven",
  CODE_PLAYGROUND: "self_contained",
  TIMELINE: "user_driven",
  CONVERSATION: "user_driven",
};

type NavigationMode = "time_driven" | "user_driven" | "self_contained";
```

---

## Frontend Implementation Checklist

### 1. Update Request Form/UI

```tsx
// Add content type selector
<Select
  label="Content Type"
  value={contentType}
  onChange={setContentType}
  options={[
    { value: "VIDEO", label: "📹 Video" },
    { value: "QUIZ", label: "❓ Quiz" },
    { value: "STORYBOOK", label: "📚 Storybook" },
    { value: "INTERACTIVE_GAME", label: "🎮 Interactive Game" },
    { value: "PUZZLE_BOOK", label: "🧩 Puzzle Book" },
    { value: "SIMULATION", label: "🔬 Simulation" },
    { value: "FLASHCARDS", label: "📇 Flashcards" },
    { value: "MAP_EXPLORATION", label: "🗺️ Map Exploration" },
    { value: "WORKSHEET", label: "📝 Worksheet" },
    { value: "CODE_PLAYGROUND", label: "💻 Code Playground" },
    { value: "TIMELINE", label: "⏳ Timeline" },
    { value: "CONVERSATION", label: "💬 Conversation" },
  ]}
/>
```

### 2. Update API Call

```typescript
async function generateContent(request: VideoGenerationRequest) {
  const response = await fetch("/ai-service/external/video/v1/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Institute-Key": apiKey,
    },
    body: JSON.stringify({
      prompt: request.prompt,
      content_type: request.content_type, // NEW: Pass content type
      language: request.language,
      target_audience: request.target_audience,
      target_duration: request.target_duration,
      voice_gender: request.voice_gender,
      tts_provider: request.tts_provider,
    }),
  });

  // Read content type from response header
  const contentType = response.headers.get("X-Content-Type") || "VIDEO";

  // Parse SSE stream
  const reader = response.body?.getReader();
  // ... handle stream
}
```

### 3. Library Loading Based on Content Type

```typescript
const LIBRARY_MAP: Record<ContentType, string[]> = {
  VIDEO: ["gsap", "mermaid", "katex", "prism"],
  QUIZ: ["gsap", "confetti"],
  STORYBOOK: ["gsap", "swiper", "howler"],
  INTERACTIVE_GAME: ["interact", "gsap", "confetti", "howler"],
  SIMULATION: ["matter", "p5", "gsap"],
  FLASHCARDS: ["gsap", "swiper"],
  PUZZLE_BOOK: ["interact", "gsap", "confetti"],
  MAP_EXPLORATION: ["gsap", "confetti"],
  WORKSHEET: ["gsap"],
  CODE_PLAYGROUND: ["prism", "gsap"],
  TIMELINE: ["gsap"],
  CONVERSATION: ["gsap", "howler"],
};

async function loadLibraries(contentType: ContentType) {
  const libs = LIBRARY_MAP[contentType] || LIBRARY_MAP.VIDEO;
  await Promise.all(libs.map(loadLibrary));
}
```

### 4. Navigation Controller

```typescript
function ContentRenderer({ content, meta }: { content: Entry[], meta: Meta }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  switch (meta.navigation) {
    case "time_driven":
      // Audio controls timeline
      return (
        <TimelinePlayer
          entries={content}
          audioUrl={meta.audio_url}
          wordsUrl={meta.words_url}
        />
      );

    case "user_driven":
      // User clicks to navigate
      return (
        <UserNavigator
          entries={content}
          currentIndex={currentIndex}
          onNavigate={setCurrentIndex}
          entryLabel={meta.entry_label}  // "question", "page", "card", etc.
        />
      );

    case "self_contained":
      // Single entry, no navigation needed
      return (
        <SelfContainedRenderer
          entry={content[0]}
          contentType={meta.content_type}
        />
      );
  }
}
```

### 5. Content-Type Specific UI Elements

```typescript
// Add print button for worksheets
{meta.content_type === "WORKSHEET" && (
  <Button onClick={() => window.print()}>🖨️ Print Worksheet</Button>
)}

// Add code run button for playgrounds
{meta.content_type === "CODE_PLAYGROUND" && (
  <Button onClick={runCode}>▶️ Run Code</Button>
)}

// Add score tracking for quizzes
{meta.content_type === "QUIZ" && (
  <QuizScoreTracker entries={content} />
)}
```

---

## Example API Calls

### Generate a Quiz

```bash
curl -X POST http://localhost:8000/ai-service/external/video/v1/generate \
  -H "Content-Type: application/json" \
  -H "X-Institute-Key: your-api-key" \
  -d '{
    "prompt": "Create a quiz about photosynthesis",
    "content_type": "QUIZ",
    "target_audience": "Class 6-8",
    "language": "English"
  }'
```

### Generate a Puzzle Book

```bash
curl -X POST http://localhost:8000/ai-service/external/video/v1/generate \
  -H "Content-Type: application/json" \
  -H "X-Institute-Key: your-api-key" \
  -d '{
    "prompt": "Science vocabulary crossword and word search",
    "content_type": "PUZZLE_BOOK",
    "target_audience": "Class 5-6",
    "language": "English"
  }'
```

### Generate an Interactive Map

```bash
curl -X POST http://localhost:8000/ai-service/external/video/v1/generate \
  -H "Content-Type: application/json" \
  -H "X-Institute-Key: your-api-key" \
  -d '{
    "prompt": "Human digestive system with all major organs",
    "content_type": "MAP_EXPLORATION",
    "target_audience": "Class 7-8",
    "language": "English"
  }'
```

---

## time_based_frame.json Response Structure

The output JSON now includes a `meta` object with content type information:

```json
{
  "meta": {
    "content_type": "QUIZ",
    "navigation": "user_driven",
    "entry_label": "question",
    "audio_start_at": 0.0,
    "total_duration": null,
    "total_entries": 10
  },
  "entries": [
    {
      "id": "q1",
      "html": "<div class='quiz-question'>...</div>",
      "audio_start": 0.0,
      "audio_end": 5.0,
      "entry_meta": {
        "correct_option": "b",
        "explanation_html": "..."
      }
    }
  ]
}
```

---

## Error Handling

```typescript
interface ErrorEvent {
  type: "error";
  message: string;
  stage?: string;
  video_id?: string;
}

// Handle in SSE stream
if (event.type === "error") {
  showError(event.message);
  setGenerationStatus("failed");
}
```

---

## Migration Notes

### Backward Compatibility

- Default `content_type` is `"VIDEO"` - existing integrations work unchanged
- Response structure remains the same, with `meta` object additions
- All existing endpoints continue to function

### New Fields to Handle

1. **Request**: Add `content_type` field
2. **Response Header**: Read `X-Content-Type`
3. **SSE Events**: Handle `content_type` in events
4. **Output JSON**: Parse `meta.navigation` and `meta.entry_label`

---

## Testing Checklist

- [ ] Generate VIDEO content (baseline)
- [ ] Generate QUIZ with answer checking
- [ ] Generate STORYBOOK with page navigation
- [ ] Generate PUZZLE_BOOK with crossword/word search
- [ ] Generate MAP_EXPLORATION with region clicking
- [ ] Verify library loading per content type
- [ ] Test navigation modes (time_driven, user_driven, self_contained)
- [ ] Verify print functionality for WORKSHEET
- [ ] Test code execution for CODE_PLAYGROUND
