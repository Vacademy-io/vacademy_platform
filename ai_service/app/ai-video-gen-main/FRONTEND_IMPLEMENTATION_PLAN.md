# AI Content Creation Portal - Frontend Implementation Plan

## 1. Overview

This document outlines the frontend implementation plan for the **Vacademy Content Creation Portal**. This portal allows Teachers, Directors, and Administrators to generate varied educational content (Videos, Quizzes, Storybooks, etc.) using our AI generation pipeline.

## 2. Target Audience

- **Teachers**: Want quick lesson supplements (quizzes, short explainers).
- **Directors/Admins**: Creating curriculum-wide assets.
- **Content Creators**: Building interactive modules.

## 3. Core Features & User Journey

### 3.1. The Landing Page (Dashboard)

**Purpose**: Central hub for content management.

- **Header**: "Create New" button (Primary Call-to-Action), User Profile, AI Credits Balance.
- **Recent Projects**: Grid/List view of recently generated content.
- **Templates/Quick Start**: "Popular now" section (e.g., "Create a 5-min Math Video").

### 3.2. Content Creation Wizard (The "Create" Flow)

A multi-step modal or dedicated page guiding the user through generation.

**Step 1: Select Content Type**

- Display a grid of cards for each supported type (from `CONTENT_TYPE_PROMPTS.md`).
- **Cards**:
  - **Video**: "Narrated explainer videos."
  - **Quiz**: "Interactive 10-question assessment."
  - **Storybook**: "Illustrated narrative for younger students."
  - **Interactive Game**: "Memory match, Drag & Drop."
  - **Worksheet**: "Printable homework assignments."
  - **Map Exploration**: "Interactive SVG maps."

**Step 2: Configuration (Dynamic Form)**

- **Common Fields**:
  - **Topic/Prompt**: Text area (e.g., "Photosynthesis for Class 5").
  - **Target Audience**: Dropdown (Age groups/Grades).
  - **Language**: Dropdown (English, Hindi, etc. - mapped to `VOICE_MAPPING`).
- **Type-Specific Fields** (Conditional rendering):
  - _Video_: Duration (Short/Long), Voice Gender, Background Style (Dark/Light).
  - _Quiz_: Number of Questions, Difficulty.
  - _Game_: Game Type (Memory/Puzzle).

**Step 3: Generation & Loading State**

- **Visual Feedback**: Progress bar or stepped loader (Drafting Script -> Generating Audio -> Building Visuals).
- **"Fun Facts"**: Show educational facts while waiting to reduce perceived latency.
- **Background Processing**: Option to "Notify me when done" for long videos.

**Step 4: Review & Finalize**

- **Draft Review**: (Optional intermediate step) User reviews the generated script/questions before final rendering.
- **Editor**: Simple text editor to tweak the script or questions.

### 3.3. Content Player / Preview

- **Video Player**: Standard HTML5 video controls for `.mp4` outputs.
- **Interactive Runner**: A specialized container to render the `HTML` outputs (Quizzes, Games) directly in the browser.
  - Needs to inject the required libraries defined in `CONTENT_TYPE_PROMPTS.md` (GSAP, Mermaid, etc.).

## 4. Technical Architecture

### 4.1. Tech Stack

- **Framework**: React / Next.js (aligned with Vacademy platform).
- **Styling**: Tailwind CSS (for rapid UI development) or CSS Modules.
- **State Management**: React Query (for API data fetching and caching).
- **Components**: Radix UI or Headless UI for accessible primitives.

### 4.2. API Integration points

| Action           | Endpoint                    | Payload                                             |
| :--------------- | :-------------------------- | :-------------------------------------------------- |
| **List Types**   | `GET /api/ai/content-types` | -                                                   |
| **Generate**     | `POST /api/ai/generate`     | `{ prompt, content_type, audience, language, ... }` |
| **Check Status** | `GET /api/ai/tasks/:id`     | -                                                   |
| **Get Result**   | `GET /api/ai/content/:id`   | -                                                   |

### 4.3. Library Injection Strategy

For interactive content (Quizzes, Games), the frontend must dynamically load scripts:

```javascript
const LIBRARY_MAP = {
  QUIZ: ["https://.../confetti.js", "https://.../gsap.min.js"],
  VIDEO: ["https://.../katex.min.js", "https://.../prism.js"],
  // ...
};

function useExternalScripts(contentType) {
  useEffect(() => {
    LIBRARY_MAP[contentType].forEach(loadScript);
  }, [contentType]);
}
```

## 5. UI/UX Design Specifications

### 5.1. Color Palette (Vacademy Brand)

- **Primary**: Deep Blue/Purple (Learning, Trust).
- **Accent**: Vibrant Green/Orange (Gamification, Action).
- **Background**: Clean White/Light Gray (Dashboard), Dark Mode (Player).

### 5.2. Layout Structure

```
+----------------------------------------------------+
|  Sidebar  |          Top Navigation Bar            |
| (Nav)     +----------------------------------------+
|           |                                        |
|  - Home   |  [ Content Type Selection Grid ]       |
|  - My     |                                        |
|    Lib    |  [ Video ]  [ Quiz ]  [ Puzzle ]       |
|  - Tools  |                                        |
|           |  [  Recent Generations Table   ]       |
|           |                                        |
+----------------------------------------------------+
```

### 5.3. Error Handling

- **Toast Notifications**: For transient errors (e.g., "Failed to load credits").
- **Retry Mechanism**: "Generation failed. Try again?" button.
- **Input Validation**: Real-time validation for prompt length and required fields.

## 6. Implementation Roadmap

1.  **Phase 1**: Dashboard Skeleton & "Video" Generation Flow.
2.  **Phase 2**: Interactive Player (Quiz, Storybook support).
3.  **Phase 3**: "My Library" (History, Search, Filter).
4.  **Phase 4**: Advanced Editor (Edit generated script/HTML).
