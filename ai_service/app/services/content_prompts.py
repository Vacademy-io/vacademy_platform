from __future__ import annotations


class ContentGenerationPrompts:
    """
    Prompt templates for content generation (documents and assessments).
    Matches the pattern from media-service ConstantAiTemplate.
    """

    @staticmethod
    def build_document_prompt(
        text_prompt: str,
        title: str,
        include_diagrams: bool = False,
        language: str = "English",
        reference_figures: "list | None" = None,
    ) -> str:
        """
        Build document generation prompt. Always produces HTML (the only format
        the slide editor round-trips losslessly); Mermaid diagrams are emitted
        as <div class="mermaid"> blocks inside the HTML.

        reference_figures: real figures extracted from an uploaded source PDF
        (objects with .fig_id, .url, .caption). When present, the model is told
        to embed the ones relevant to this slide verbatim using their exact URL,
        instead of an AI-generated illustration.
        """
        # Diagram-related keywords strengthen the diagram instruction from
        # "only where genuinely useful" to "include at least one".
        diagram_keywords = ["include diagrams", "include diagram", "with diagrams", "with diagram",
                           "add diagrams", "add diagram", "diagrams", "mermaid"]
        prompt_lower = text_prompt.lower()
        should_include_diagrams = include_diagrams or any(keyword in prompt_lower for keyword in diagram_keywords)

        diagram_emphasis = (
            "The course planner asked for diagrams — include at least ONE Mermaid diagram."
            if should_include_diagrams
            else "Include a Mermaid diagram ONLY where it genuinely aids understanding; skip it otherwise."
        )

        figures_block = ""
        if reference_figures:
            manifest = "\n".join(
                f"  - url={getattr(f, 'url', '')}"
                + (f" — {getattr(f, 'caption', '')}" if getattr(f, "caption", "") else "")
                for f in reference_figures
                if getattr(f, "url", "")
            )
            if manifest:
                figures_block = f"""**Source figures (from the uploaded document — PREFER these over generated images)**:
The uploaded source document provides these REAL figures/diagrams/tables. When this slide's topic matches one, embed it VERBATIM:
{manifest}
- Embed as: `<img src="EXACT_URL_FROM_THE_LIST_ABOVE" alt="short caption" style="max-width:100%;border-radius:8px;margin:12px 0;">`
- Use ONLY a url copied EXACTLY from the list above — never invent, guess, or alter a url.
- Embed ONLY the figures RELEVANT to THIS slide's topic (match by the caption text); skip the rest.
- Prefer a real source figure over a generated illustration whenever one fits the content.

"""

        return f"""You are an expert educator and instructional designer writing premium study notes for students. The notes must be complete enough to learn from without any other material — clear, accurate, engaging, and visually well-organized.

**Language**: Write ALL student-facing content in {language}. Do NOT use English if a different language is specified.

**Topic**: {title}

**Content Requirements** (from the course planner):
{text_prompt}

**Depth & quality bar**:
- Aim for roughly 300-600 words of real substance (more if the topic demands it). Never thin, never padded with filler.
- Explain concepts step by step. For every important idea give a concrete example, analogy, or real-world application.
- Call out common mistakes or misconceptions where relevant.
- Write in a clear, student-friendly tone; keep paragraphs short (2-4 sentences).

**Structure**:
1. Start with `<h1>{title}</h1>`, then a short engaging introduction: what this is and why it matters.
2. Organize the body into logical sections with `<h2>` (and `<h3>` for sub-points).
3. Use `<table>` for comparisons, `<ol>` for step sequences, `<ul>` for enumerations, and `<blockquote>` for key insights, tips, or "common mistake" callouts.
4. End with a short "Key Takeaways" section (`<h2>` + a compact `<ul>`).

**Formatting contract (STRICT — this HTML is parsed by a block editor)**:
- Return ONLY HTML. No markdown syntax anywhere (no `**bold**`, no `#` headings, no ``` fences), no `<html>`/`<head>`/`<body>` wrapper, no commentary outside the HTML.
- Allowed tags: h1, h2, h3, p, ul, ol, li, strong, em, table, thead, tbody, tr, th, td, blockquote, pre, code, img, div, hr.
- Every element must be properly closed and top-level elements must each start on their own line.

**Mermaid diagrams** — {diagram_emphasis}
- Emit each diagram EXACTLY as:
  <div class="mermaid">
  graph TD
      A[Start] --> B[Process]
      B --> C[End]
  </div>
- Plain Mermaid text inside the div — no other tags, no escaping, no backticks.
- Add one short `<p>` immediately before each diagram that finishes its own sentence and explains what the diagram shows. Never split a sentence across the diagram.
- CRITICAL Mermaid syntax rules (Mermaid.js compatibility):
  - ASCII arrows ONLY: `-->` (never Unicode arrows like → or ⇒)
  - Node IDs alphanumeric/underscore only; labels in brackets: `A[Label]` or `A("Label with spaces")`
  - Decision nodes: `B{{Decision}}`; edge labels: `B -->|Yes| C`
  - Flowcharts: `graph TD` or `graph LR`; other types: sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, pie
  - Avoid `<`, `>`, parentheses and special characters inside labels; keep the diagram simple and valid.

{figures_block}**Illustrations (generated)** — these notes should be VISUAL, not walls of text. Include 1-2 images per slide:
- If a source figure above already illustrates this slide, use it and you usually don't need a generated one.
- Otherwise include at least ONE generated illustration that depicts the core concept of THIS slide (a labelled diagram of the mechanism, a visual example, a real-world scene). Only skip it when the slide is a tiny list/definition where an image would add nothing.
- Emit EXACTLY: `<img data-img-prompt="vivid, specific English description of an educational illustration for this topic" src="placeholder.png" alt="short description" style="max-width:100%;border-radius:8px;">`
- The pipeline generates the real image from data-img-prompt; NEVER use external URLs or the same description twice.
- The data-img-prompt must ALWAYS be written in English (even when the content language is different) and describe subject, setting, and style; make each image specific to this slide's topic.
- Do not use a generated image for something a Mermaid diagram or table expresses better.

**Code** — ONLY if the topic itself is about programming, software, or another code-based skill. NEVER include code blocks for non-technical topics.
- Emit code EXACTLY as: `<pre data-language="python"><code class="language-python">...code...</code></pre>` (use the correct language name).
- Inside code, escape `&` as `&amp;`, `<` as `&lt;`, `>` as `&gt;`.
- Preserve real indentation and newlines exactly as in an IDE; code must be complete and runnable.

**Important**: Return ONLY the HTML content. Start directly with `<h1>`.
"""

    @staticmethod
    def build_assessment_prompt(text_prompt: str, title: str, language: str = "English") -> str:
        """
        Build assessment generation prompt matching media-service PROMPT_TO_QUESTIONS template.
        """
        return f"""**Objective** : {text_prompt}
**Topic** : {title}
**Language**: Generate ALL questions, options, answers, and explanations in {language}. Do NOT use English if a different language is specified.
                
**Instructions**:
1. Continuation Handling:
   - Content Should be related to Topic
   - Strictly avoid duplicate content from existing questions
                
2. Content Requirements:
   - Generate all content from the text prompt
   - For questions that genuinely need a visual (diagrams, shapes, graphs, circuits, maps, experimental setups, etc.), you MAY include an image using ONLY this exact format:
     <!-- DS_TAG_IMG_START --><img data-img-prompt="VIVID_ENGLISH_DESCRIPTION" src="placeholder.png" alt="description" style="max-width:100%;border-radius:8px;margin:8px 0;"><!-- DS_TAG_IMG_END -->
   - The data-img-prompt must be a vivid, specific English description — the image pipeline will generate the actual image
   - NEVER use external URLs (https://example.com, https://..., etc.) as src — ALWAYS use src="placeholder.png"
   - For simple shapes, equations, or diagrams, prefer inline SVG over an img tag
   - Only add images when they are truly essential to understand or answer the question — do not add decorative images

3. Question Type Handling:
   - MCQS/MCQM: 4 options with clear single/multiple answers
   - ONE_WORD/LONG_ANSWER:
     * Omit 'options' field
     * Provide detailed 'ans' and 'exp'
   - Set difficulty based on cognitive complexity
                
4. Metadata Requirements:
   - Tags: 5 specific tags per question
   - Subjects: Minimum 1 relevant subject
   - Classes: Include secondary relevant classes if applicable
                
**Output Format**:
                
{{
    "questions": [
        {{
            "question_number": "number",
            "question": {{
                "type": "HTML",
                "content": "string" // Text, inline SVG, or img with data-img-prompt (NEVER external URLs)
            }},
            "options": [
                {{
                    "type": "HTML",
                    "preview_id": "string", // generate sequential id for each option like "1", "2", "3", "4"
                    "content": "string" // Plain text or inline SVG — no external URLs
                }}
            ],
            "correct_options": ["1"], // preview_id of correct option or list of correct options
            "ans": "string",
            "exp": "string",
            "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER",  //Strictly Include question_type
            "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
            "level": "easy | medium | hard"
        }}
    ],
    "title": "string", // Suitable title for the question paper
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"], // multiple chapter and topic names for question paper
    "difficulty": "easy | medium | hard",
    "is_process_completed": true,
    "subjects": ["subject1", "subject2", "subject3", "subject4", "subject5"], // multiple subject names for question paper
    "classes": ["class 1", "class 2"] // can be of multiple class
}}
                
**Critical Rules**:
- If textPrompt is insufficient for questions, generate at least 5 questions from the topic
- Strictly validate JSON syntax
- Ensure question numbers are sequential without gaps
- Never repeat question stems or options
- NEVER use external/real/fake image URLs — only src="placeholder.png" with data-img-prompt attribute
- Always wrap img tags in <!-- DS_TAG_IMG_START --> ... <!-- DS_TAG_IMG_END --> comments
"""


    @staticmethod
    def build_code_prompt(text_prompt: str, title: str, video_topic: str, language: str = "English") -> str:
        """
        Build code generation prompt for video+code slides.
        Generates code examples that complement the video content.
        """
        return f"""**Task**: Generate educational code examples as Markdown

**Language**: Generate ALL explanations and comments in {language}. Do NOT use English if a different language is specified.

**Topic**: {title}
**Video Topic**: {video_topic}

**Content Requirements**:
{text_prompt}

**Output Format**:
- Generate code examples in Markdown format
- Use proper code blocks with syntax highlighting: ` ```language `
- Include multiple code examples if the topic requires it
- Keep code examples SHORT, CLEAR, and PRACTICAL (aim for 20-50 lines per example)
- Structure with clear headings and explanations

**Code Requirements (CRITICAL — every code block MUST be runnable)**:
- Every code block must be **syntactically correct and complete** — a learner should be able to copy-paste it and run it without errors
- Include ALL necessary imports/includes at the top of each code block
- Do NOT use placeholder code like `pass`, `...`, `# TODO`, or `# your code here`
- Every function/class must have a real, working implementation
- Add a runnable entry point: `if __name__ == "__main__":` for Python, `main()` for Go/Java, top-level calls for JavaScript/TypeScript
- Include **sample output** as a comment at the end of each code block (e.g., `# Output: Hello, World!`)
- Use best practices, clean code principles, and proper error handling
- Include inline comments explaining key concepts
- Make code examples directly relevant to the video topic

**Code Block Format**:
````markdown
## Example Title

Brief explanation of what this code does.

```python
import math

def calculate_area(radius: float) -> float:
    \"\"\"Calculate the area of a circle.\"\"\"
    return math.pi * radius ** 2

if __name__ == "__main__":
    area = calculate_area(5.0)
    print(f"Area of circle with radius 5: {{area:.2f}}")
    # Output: Area of circle with radius 5: 78.54
```

Explanation of the code output or key concepts.
````

**Content Style**:
- Write in a clear, student-friendly tone
- Explain what the code does and why
- Connect code examples to the video content
- Use practical, real-world examples
- Keep explanations concise but informative

**Important**: Return ONLY the Markdown content with code blocks. No explanations outside the markdown, no code block wrappers around the entire response, just the markdown content with code examples.
"""

    @staticmethod
    def build_homework_prompt(text_prompt: str, title: str, language: str = "English") -> str:
        """
        Build prompt for homework slides. Hands-on and applied — the task type
        adapts to the chapter's subject (coding ONLY for technical chapters).
        """
        return f"""**Task**: Generate the ASSIGNMENT (homework) for a chapter. It must be hands-on and applied — something the student actively DOES, not recall-style Q&A.

**Language**: Generate ALL content in {language}. Do NOT use English if a different language is specified.

**Topic / Chapter**: {title}

**Context**:
{text_prompt}

**FIRST, choose the task type from the chapter's subject matter**:
- If (and ONLY if) the chapter teaches programming, software tools, or another code-based technical skill → create ONE coding task: a mini project, an implementation task, a setup/configuration task, or a debugging task.
- For every other subject (humanities, sciences, business, language, academic skills, arts, etc.) → create ONE practical non-coding task, for example:
  - Analyze a realistic case, document, or dataset provided inside the assignment
  - Create a deliverable (e.g. a properly formatted reference list, an essay outline, a lesson plan, a labeled diagram, a comparison sheet)
  - Perform a structured exercise on provided materials (e.g. "correct the errors in these 5 examples", "classify the following items and justify each")
  - Solve realistic scenario problems step by step
- NEVER force a coding task onto a non-technical chapter, and never invent a programming angle for a non-programming topic.

**Content requirements**:
- Do NOT create simple "what is X?" or short-answer conceptual questions.
- Exactly ONE task, with: a clear title, brief context, concrete instructions, the materials to work on (embed them in the assignment — e.g. the sample text, data, or starter code), and the expected outcome or acceptance criteria.
- The task must be doable using ONLY what this chapter covered.

**Output format (STRICT — this HTML is parsed by a block editor)**:
- HTML only. No markdown syntax anywhere, no commentary outside the HTML.
- The content MUST start with the main heading `<h1>Assignment</h1>`.
- Use `<h2>` for the task title, `<p>` for instructions, `<ul>`/`<ol>` for steps and criteria, `<blockquote>` for provided materials or examples.

**Code formatting (ONLY when the task is a coding task)**:
- Emit code EXACTLY as: `<pre data-language="python"><code class="language-python">...code...</code></pre>` (use the correct language name).
- Inside code, escape `&` as `&amp;`, `<` as `&lt;`, `>` as `&gt;`.
- Preserve correct indentation with spaces, exactly as in an IDE; never flatten or minify.
- Include ALL necessary imports; starter code must be syntactically valid — mark student sections with a clear `# TODO: implement this` comment.

**Important**: Return ONLY the HTML content. Start with <h1>Assignment</h1>."""

    @staticmethod
    def build_solution_prompt(text_prompt: str, title: str, homework_content: str | None = None, language: str = "English") -> str:
        """
        Build prompt for solution slides. For the homework: provide HINT first, then Solution.
        If homework_content is provided, the solution must match this exact homework task.
        """
        if homework_content:
            context_block = f"""**The exact homework task from the previous slide (you MUST solve this and only this):**
{homework_content}

**Chapter context** (for reference): {text_prompt}
"""
        else:
            context_block = f"""**Context** (homework was based on this):
{text_prompt}
"""
        return f"""**Task**: Generate the SOLUTION for the homework from the previous slide. The solution MUST have two parts: (1) HINT first, (2) Solution after.

**Language**: Generate ALL content in {language}. Do NOT use English if a different language is specified.

**Topic / Chapter**: {title}

{context_block}

**Structure** (exactly one homework task per chapter):
1. **Hint** (first):
   - One or more hints that guide the student without giving the full answer (e.g. "Start by identifying the author and year.", "Check the order of arguments in the API.")
   - Keep hints short and actionable.
2. **Solution** (after the hint):
   - Full, correct solution matching the task type: complete code (ONLY if the homework was a coding task), a complete worked deliverable (for creation/analysis tasks), or full step-by-step working (for exercises and scenario problems).
   - For non-coding tasks show the finished result the student should have produced (e.g. the corrected examples, the completed reference list, the full analysis) — not just a description of it.
   - For coding or setup tasks, include any necessary files/commands and expected output or verification steps.

**Output format (STRICT — this HTML is parsed by a block editor)**:
- HTML only. No markdown syntax anywhere, no commentary outside the HTML.
- The content MUST start with the main heading `<h1>Assignment Solutions</h1>`.
- Use exactly two subsection headings: "Hint" (first), then "Solution" (second). Do not use "Exact solution" or "Exact Solution"—use "Solution" only.
- Use `<ol>` or `<p>` for step-by-step working, `<blockquote>` for the worked deliverable where it reads better.

**Code formatting (ONLY when the homework was a coding task)**:
- Emit code EXACTLY as: `<pre data-language="python"><code class="language-python">...code...</code></pre>` (use the correct language name).
- Inside code, escape `&` as `&amp;`, `<` as `&lt;`, `>` as `&gt;`.
- Preserve correct indentation with spaces, exactly as in an IDE; never flatten or minify.
- Solution code must be **complete and runnable** — all imports, a main entry point, and expected output as a comment; no `pass` or `...` placeholders.

**Important**: Return ONLY the HTML content. Always put the HINT before the Solution. Use the heading "Solution", not "Exact Solution". Start with <h1>Assignment Solutions</h1>."""


__all__ = ["ContentGenerationPrompts"]

