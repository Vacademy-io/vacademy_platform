from __future__ import annotations


class ContentGenerationPrompts:
    """
    Prompt templates for content generation (documents and assessments).
    Matches the pattern from media-service ConstantAiTemplate.
    """

    @staticmethod
    def build_document_prompt(text_prompt: str, title: str, include_diagrams: bool = False) -> str:
        """
        Build document generation prompt.
        - If include_diagrams is True, generates markdown with Mermaid diagrams
        - Otherwise, generates HTML format (default behavior)
        """
        # Check if prompt contains diagram-related keywords
        diagram_keywords = ["include diagrams", "include diagram", "with diagrams", "with diagram", 
                           "add diagrams", "add diagram", "diagrams", "mermaid"]
        prompt_lower = text_prompt.lower()
        should_include_diagrams = include_diagrams or any(keyword in prompt_lower for keyword in diagram_keywords)
        
        if should_include_diagrams:
            return f"""**Task**: Generate educational content as Markdown with Mermaid diagrams

**Topic**: {title}

**Content Requirements**:
{text_prompt}

**Output Format**:
- Generate the content in Markdown format (.md)
- Keep content SHORT, CRISP, and ENGAGING for students (aim for 50-100 words)
- Use proper Markdown syntax:
  - Headings: `#`, `##`, `###`
  - Bold: `**text**`, Italic: `*text*`
  - Lists: `-` for unordered, `1.` for ordered
  - Code blocks: ` ```language ` for syntax highlighting
  - Inline code: `` `code` ``
- Structure the content with clear headings and concise paragraphs
- Make it engaging and easy to understand for learners

**Mermaid Diagrams**:
- Include Mermaid diagrams where they help explain concepts visually
- Generate Mermaid diagrams using standard markdown code blocks for client-side Mermaid.js rendering
- Use the following format for Mermaid diagrams:
  ````markdown
  ```mermaid
  graph TD
      A[Start] --> B[Process]
      B --> C[End]
  ```
  ````
- **Frontend Rendering**: The frontend uses Mermaid.js to automatically detect and render ` ```mermaid ` code blocks client-side
- Common Mermaid diagram types:
  - Flowcharts: `graph TD` (top-down) or `graph LR` (left-right)
  - Sequence diagrams: `sequenceDiagram`
  - Class diagrams: `classDiagram`
  - State diagrams: `stateDiagram-v2`
  - ER diagrams: `erDiagram`
  - Gantt charts: `gantt`
  - Pie charts: `pie`
- **CRITICAL Mermaid Syntax Rules** (for Mermaid.js compatibility):
  - Use ASCII arrows ONLY: `-->` (NOT Unicode arrows like → or ⇒)
  - Node IDs must be alphanumeric only: `A`, `Node1`, `Process_1` (NO spaces, NO special chars except underscore)
  - Labels must be in brackets: `A[Label]` or `A("Label with spaces")`
  - Keep diagram syntax simple, clean, and valid
  - Avoid nested parentheses in node IDs (use quotes for labels with special chars)
  - For flowcharts, use: `graph TD` (top-down) or `graph LR` (left-right)
  - Each line should be properly formatted (no trailing spaces)
  - Example valid syntax:
    ````markdown
    ```mermaid
    graph TD
        A[Start] --> B{{Decision}}
        B -->|Yes| C[Action 1]
        B -->|No| D[Action 2]
    ```
    ````
  - For decision nodes (diamond shape), use curly braces: `B{{Decision}}`
  - For process nodes (rectangles), use square brackets: `A[Process]`
  - For start/end nodes (rounded rectangles), use parentheses: `Start(("Start"))`
- Only include diagrams that enhance understanding of the topic
- Place diagrams strategically within the content where they add value
- Each diagram should be self-contained with a clear purpose
- Add a brief description before each diagram explaining what it shows
- Ensure diagrams are properly formatted and can be rendered by Mermaid.js without errors

**Content Style**:
- Write in a clear, student-friendly tone
- Use examples and analogies to make concepts relatable
- Break complex topics into digestible sections
- Use bullet points and lists for clarity
- Keep paragraphs short (2-3 sentences max)

**Important**: Return ONLY the Markdown content with embedded Mermaid diagrams. No explanations, no code block wrappers around the entire response, just the markdown content.
"""
        else:
            return f"""**Task**: Generate educational content as HTML

**Topic**: {title}

**Content Requirements**:
{text_prompt}

**Output Format**:
- Generate the content in HTML format
- Use proper HTML tags like `<p>`, `<h1>`, `<h2>`, `<h3>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>`, etc.
- Structure the content with appropriate headings and paragraphs
- Make it well-formatted and readable
- Include examples and explanations where appropriate

**Important**: Return ONLY the HTML content, no markdown, no explanations, just the HTML.
"""

    @staticmethod
    def build_assessment_prompt(text_prompt: str, title: str) -> str:
        """
        Build assessment generation prompt matching media-service PROMPT_TO_QUESTIONS template.
        """
        return f"""**Objective** : {text_prompt}
**Topic** : {title}
                
**Instructions**:
1. Continuation Handling:
   - Content Should be related to Topic
   - Strictly avoid duplicate content from existing questions
                
2. Content Requirements:
   - Preserve ALL DS_TAGs in HTML comments
   - Include relevant images from Objective
                
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
                "content": "string" // Include img tags if present
            }},
            "options": [
                {{
                    "type": "HTML",
                    "preview_id": "string", // generate sequential id for each option like "1", "2", "3", "4"
                    "content": "string" // Include img tags if present
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
- If textPrompt is insufficient for questions, try to extract first 5 questions
- Never modify DS_TAG comments
- Maintain original HTML structure from source
- Strictly validate JSON syntax
- Ensure question numbers are sequential without gaps
- Never repeat question stems or options
"""


    @staticmethod
    def build_code_prompt(text_prompt: str, title: str, video_topic: str) -> str:
        """
        Build code generation prompt for video+code slides.
        Generates code examples that complement the video content.
        """
        return f"""**Task**: Generate educational code examples as Markdown

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

**Code Requirements**:
- Generate working, executable code examples
- Include comments explaining key concepts
- Use best practices and clean code principles
- Make code examples relevant to the video topic
- Include both simple and slightly advanced examples if appropriate
- Add brief explanations before each code block

**Code Block Format**:
````markdown
## Example Title

Brief explanation of what this code does.

```python
# Your code here
def example():
    pass
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


__all__ = ["ContentGenerationPrompts"]

