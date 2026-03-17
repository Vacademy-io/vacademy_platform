# Content Type Prompts - Implementation Guide

This document describes the content-type-specific LLM prompts that have been implemented to support multi-format content generation beyond just videos.

## Supported Content Types

| Content Type       | Navigation Mode  | Entry Label  | Description                                          |
| ------------------ | ---------------- | ------------ | ---------------------------------------------------- |
| `VIDEO`            | `time_driven`    | `segment`    | Standard narrated explainer videos (default)         |
| `QUIZ`             | `user_driven`    | `question`   | Interactive multiple-choice assessments              |
| `STORYBOOK`        | `user_driven`    | `page`       | Illustrated page-by-page narratives                  |
| `INTERACTIVE_GAME` | `self_contained` | `game`       | Self-contained HTML5 games (memory match, drag-drop) |
| `PUZZLE_BOOK`      | `user_driven`    | `puzzle`     | Collection of puzzles (crossword, word search)       |
| `SIMULATION`       | `self_contained` | `simulation` | Interactive physics/science sandboxes                |
| `FLASHCARDS`       | `user_driven`    | `card`       | Spaced-repetition flashcard decks                    |
| `MAP_EXPLORATION`  | `user_driven`    | `region`     | Interactive SVG maps with hotspots                   |
| `WORKSHEET`        | `user_driven`    | `exercise`   | Printable/interactive homework assignments           |
| `CODE_PLAYGROUND`  | `self_contained` | `exercise`   | Interactive code editor with exercises               |
| `TIMELINE`         | `user_driven`    | `event`      | Chronological event visualization                    |
| `CONVERSATION`     | `user_driven`    | `exchange`   | Language learning dialogue scenarios                 |

## Navigation Modes Explained

### `time_driven` (Videos)

- Audio drives the timeline automatically
- Entries transition based on timing
- User controls: play, pause, seek, speed

### `user_driven` (Quizzes, Storybooks, Flashcards)

- User clicks to advance between entries
- Audio plays for the current entry only
- User controls: next, previous, replay

### `self_contained` (Games, Simulations)

- The entire experience is ONE entry
- All interactivity is within the HTML
- No timeline navigation needed

## File Structure

```
ai_service/app/ai-video-gen-main/
├── prompts.py                    # Original VIDEO prompts
├── content_type_prompts.py       # NEW: Content-type-specific prompts
└── automation_pipeline.py        # Updated to use content-type prompts
```

## How It Works

### 1. API Request

```json
{
  "prompt": "Create a quiz about photosynthesis",
  "content_type": "QUIZ",
  "target_audience": "Class 6-8",
  "language": "English"
}
```

### 2. Script Generation (`_draft_script`)

- Checks if `content_type` is VIDEO (uses existing prompts)
- Otherwise, loads prompts from `CONTENT_TYPE_PROMPTS[content_type]`
- Formats user prompt with type-specific parameters
- Extracts appropriate output (quiz questions, story pages, etc.)
- Generates TTS script from extracted content

### 3. Timeline Generation (`_write_timeline`)

- Includes `content_type` in timeline meta
- Includes `navigation` mode for frontend
- Includes `entry_label` for UI display
- Entries can have `entry_meta` for type-specific data

### 4. Output Format (`time_based_frame.json`)

```json
{
  "meta": {
    "content_type": "QUIZ",
    "navigation": "user_driven",
    "entry_label": "question",
    "audio_start_at": 0.0,
    "total_duration": null
  },
  "entries": [
    {
      "id": "q1",
      "html": "<div class='quiz-question'>...</div>",
      "entry_meta": {
        "correct_option": "b",
        "explanation_html": "..."
      }
    }
  ]
}
```

## Prompt Templates

Each content type has:

1. **System Prompt**: Describes the AI's role and capabilities
2. **User Template**: Structured prompt with placeholders
3. **Defaults**: Default values for type-specific parameters

### Example: Quiz Prompts

```python
QUIZ_SYSTEM_PROMPT = """You are an expert educational quiz designer...
- Question design principles
- Available question types
- HTML structure requirements
- Styling guidelines
"""

QUIZ_USER_PROMPT_TEMPLATE = """
Create a quiz about:
{base_prompt}

Target Audience: {target_audience}
Language: {language}
Number of Questions: {question_count}

OUTPUT JSON STRUCTURE:
{
  "title": "...",
  "questions": [...]
}
"""
```

## Frontend Integration Requirements

### Library Loading

```javascript
const LIBRARY_MAP = {
  VIDEO: ["gsap", "mermaid", "katex", "prism"],
  QUIZ: ["gsap", "confetti"],
  STORYBOOK: ["gsap", "swiper", "howler"],
  INTERACTIVE_GAME: ["interact", "gsap", "confetti", "howler"],
  SIMULATION: ["matter", "p5", "gsap"],
  FLASHCARDS: ["gsap", "swiper"],
  PUZZLE_BOOK: ["interact", "gsap", "confetti"], // Enhanced with confetti for win celebrations
  MAP_EXPLORATION: ["gsap", "confetti"], // Enhanced with confetti for completion
  WORKSHEET: ["gsap"],
  CODE_PLAYGROUND: ["prism", "gsap"], // Prism for syntax highlighting
  TIMELINE: ["gsap"],
  CONVERSATION: ["gsap", "howler"], // Howler for audio playback
};
```

### Navigation Switch

```javascript
switch (meta.navigation) {
  case "time_driven":
    // Use audio time to drive entry transitions
    audio.ontimeupdate = () => updateCurrentEntry(audio.currentTime);
    break;

  case "user_driven":
    // Show next/prev buttons
    showNavigationControls();
    nextBtn.onclick = () => goToEntry(currentIndex + 1);
    break;

  case "self_contained":
    // Just render the single entry, it handles itself
    renderSingleEntry(entries[0]);
    break;
}
```

## Testing

### Generate a Quiz

```bash
curl -X POST http://localhost:8000/ai-service/v1/generate/till-html \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a quiz about the water cycle",
    "content_type": "QUIZ",
    "target_audience": "Class 5-6",
    "language": "English"
  }'
```

### Generate a Storybook

```bash
curl -X POST http://localhost:8000/ai-service/v1/generate/till-html \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A story about a curious caterpillar who learns about metamorphosis",
    "content_type": "STORYBOOK",
    "target_audience": "Class 1-2",
    "language": "English"
  }'
```

### Generate a Worksheet

```bash
curl -X POST http://localhost:8000/ai-service/v1/generate/till-html \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create fraction addition and subtraction practice problems",
    "content_type": "WORKSHEET",
    "target_audience": "Class 5-6",
    "language": "English"
  }'
```

### Generate a Code Playground

```bash
curl -X POST http://localhost:8000/ai-service/v1/generate/till-html \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "JavaScript basics: variables and console.log",
    "content_type": "CODE_PLAYGROUND",
    "target_audience": "Beginners",
    "language": "English"
  }'
```

### Generate a Timeline

```bash
curl -X POST http://localhost:8000/ai-service/v1/generate/till-html \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Major events of the French Revolution",
    "content_type": "TIMELINE",
    "target_audience": "Class 9-10",
    "language": "English"
  }'
```

### Generate a Conversation

```bash
curl -X POST http://localhost:8000/ai-service/v1/generate/till-html \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Ordering food at a French café",
    "content_type": "CONVERSATION",
    "target_audience": "French A2 learners",
    "language": "French"
  }'
```

## New Content Types (Recently Added)

### WORKSHEET

**Purpose**: Generate printable and interactive homework assignments.

**Key Features**:

- Print-friendly CSS with high contrast
- Multiple question types (MCQ, fill-in-the-blank, matching, labeling)
- Answer key generation
- Sections with progressive difficulty
- Name/Date fields at the top

**Parameters**:

- `worksheet_type`: `practice_problems`, `reading_comprehension`, `fill_blanks`, `matching`
- `question_count`: Number of questions/exercises

### CODE_PLAYGROUND

**Purpose**: Interactive coding exercises with live execution.

**Key Features**:

- Syntax-highlighted code editor
- Run button with output panel
- Progressive hints system
- Solution reveal after attempts
- Test case validation

**Parameters**:

- `programming_language`: `javascript`, `python`, `html_css`, `sql`
- `difficulty_level`: `beginner`, `intermediate`, `advanced`
- `exercise_count`: Number of exercises

### TIMELINE

**Purpose**: Interactive chronological visualization of events.

**Key Features**:

- Horizontal or vertical timeline layouts
- Event markers with hover cards
- Era color-coding
- Detail panels on click
- Image prompts for AI-generated visuals

**Parameters**:

- `timeline_type`: `historical`, `biographical`, `process`, `geological`
- `event_count`: Number of events to generate
- `time_period`: Specific range or `auto`

### CONVERSATION

**Purpose**: Language learning through branching dialogue scenarios.

**Key Features**:

- Authentic dialogue with native speaker NPCs
- Branching choices with quality feedback (excellent/acceptable/needs_work)
- Vocabulary hints and cultural notes
- Translation toggle
- Audio playback for pronunciation

**Parameters**:

- `scenario_type`: `role_play`, `customer_service`, `social`, `academic`
- `difficulty_level`: `beginner` (A1-A2), `intermediate` (B1-B2), `advanced` (C1-C2)
- `exchange_count`: Number of dialogue exchanges

### PUZZLE_BOOK (Enhanced)

**Purpose**: Generate interactive educational puzzle collections including crosswords, word searches, and logic puzzles.

**Key Features**:

- **Crossword Puzzles**: Full grid construction with across/down clues, cell numbering, and keyboard navigation
- **Word Search Puzzles**: Letter grid with mouse-drag selection, horizontal/vertical/diagonal word placement
- **Interactive Validation**: Check answers button with visual feedback (green/red cells)
- **Hint System**: Progressive hints that don't give away answers
- **Win Celebration**: Confetti animation and fun facts on completion
- **Print Support**: Print-friendly styles for offline use
- **Age-Appropriate Sizing**: Grid and word complexity scales with target audience

**Parameters**:

- `puzzle_count`: Number of puzzles to generate (default: 5)
- `puzzle_types`: Comma-separated list of types (`crossword`, `word_search`, `logic`, `sequence`)

**Example Curl**:

```bash
curl -X POST http://localhost:8000/ai-service/v1/generate/till-html \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Science vocabulary for middle school students",
    "content_type": "PUZZLE_BOOK",
    "target_audience": "Class 6-8",
    "language": "English"
  }'
```

### MAP_EXPLORATION (Enhanced)

**Purpose**: Create interactive SVG maps for exploring geographic, anatomical, or conceptual topics.

**Key Features**:

- **SVG-Based Maps**: Scalable vector graphics with precise region definitions
- **Interactive Regions**: Click to reveal detailed information panels
- **Hover Feedback**: Regions brighten on hover with tooltip showing name
- **Keyboard Navigation**: Tab through regions, Enter to select (accessibility)
- **Exploration Progress**: Track which regions have been explored with progress bar
- **Related Regions**: Cross-linking between related areas
- **Discovery Mode**: Optional gamification with completion celebration
- **Quiz Integration**: Optional quiz questions for each region
- **Legend**: Color-coded categories for easy understanding

**Map Types Supported**:

- `geographic`: Countries, continents, states, cities
- `anatomical`: Body systems, organs, cells, skeletal systems
- `conceptual`: Process flows, mind maps, ecosystems
- `historical`: Battle maps, trade routes, empires
- `scientific`: Periodic table, solar system, atomic structure

**Parameters**:

- `map_type`: Type of map to generate (default: `geographic`)

**Example Curl**:

```bash
curl -X POST http://localhost:8000/ai-service/v1/generate/till-html \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Human digestive system with all major organs",
    "content_type": "MAP_EXPLORATION",
    "target_audience": "Class 7-8",
    "language": "English"
  }'
```

## Future Enhancements

1. **Per-type HTML generation prompts**: Currently only script/content generation uses type-specific prompts. HTML generation could also be customized.

2. **Type-specific TTS handling**: Different content types might need different voice styles (quiz = slower, dramatic pauses; storybook = storytelling voice).

3. **Content type chaining**: A LESSON content type that combines VIDEO + QUIZ + FLASHCARDS.

4. **Analytics tracking**: Different interaction models need different analytics (quiz scores, storybook completion, game high scores).
