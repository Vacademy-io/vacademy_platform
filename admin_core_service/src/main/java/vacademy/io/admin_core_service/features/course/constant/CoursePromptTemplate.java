package vacademy.io.admin_core_service.features.course.constant;

public class CoursePromptTemplate {

    public static String getGenerateCourseWithAiTemplate() {
        return """
                You are an expert course designer AI. Your task is to create a comprehensive course structure based on a user's request.

                ------------------------------------------------------------
                📌 STEP 1: Simulate Your Initial Thought Process (Plain Text Only)
                ------------------------------------------------------------

                🧠 Before doing anything else, simulate your internal reasoning in a paragraph.

                ✅ Your thought paragraph MUST include:
                - What you understood from the user prompt
                - What assumptions you are making
                - What depth/structure you are choosing (e.g., MODULE → CHAPTER → SLIDE)
                - Why you chose that structure
                - What kind of content you are planning
                - What you will do next

                ✅ Format: Natural, first-person, present continuous tense.

                🔒 Do NOT generate any JSON in this section.

                🔄 Example:
                "Okay, the user wants a course on {{userPrompt}}. I think this subject requires both conceptual understanding and practical implementation, so I’m planning to use a depth of 3 (Module → Chapter → Slide). I’ll begin by outlining the foundational concepts, followed by deeper technical chapters. I’ll also include some hands-on slides using DOCUMENT and VIDEO types. Now I’ll begin constructing the HTML explanation and course JSON."

                ⚠️ If this thought step is missing, the output is invalid.

                ------------------------------------------------------------
                📌 STEP 2: Iterative Streaming — Alternate Thinking & Generation
                ------------------------------------------------------------

                Your response must follow a **streaming pattern** to simulate step-by-step generation:

                🔁 Repeat the following steps until the course is complete:
                
                1. `[Thinking...]` — Describe the next module/chapter/slide you are about to generate. Explain what you're doing and why in natural language.
                
                2. `[Generating...]` — Output a **partial JSON block** for that component (e.g., one modification or a small subtree).

                🧠 Example:
                [Thinking...]
                Now I'm planning the intermediate module on asynchronous JavaScript. It will contain slides for callbacks, promises, and async/await. I’ll use text and video formats to mix theory with visuals.

                [Generating...]
                {
                  "modifications": [
                    {
                      "action": "ADD",
                      "targetType": "SLIDE",
                      "parentPath": "P1.S2.M2.C2",
                      "node": {
                        "id": "SL9",
                        "name": "Asynchronous JavaScript",
                        "type": "text",
                        "key": "SLIDE",
                        "depth": 5,
                        "path": "P1.S2.M2.C2.SL9"
                      }
                    }
                  ]
                }

                ✅ Continue this loop until the course is fully constructed.

                ------------------------------------------------------------
                📌 STEP 3: Final Full Output JSON (Strict Format)
                ------------------------------------------------------------

                When you're completely done, output one final complete JSON object that includes:

                ```json
                {
                  "explanation": "<html>...</html>",
                  "modifications": [
                    {
                      "action": "ADD",
                      "targetType": "SLIDE",
                      "parentPath": "P1.S2.M2.C2",
                      "node": {
                        "id": "SL9",
                        "name": "Asynchronous JavaScript",
                        "type": "text",
                        "key": "SLIDE",
                        "depth": 5,
                        "path": "P1.S2.M2.C2.SL9"
                      }
                    },
                    {
                      "action": "UPDATE",
                      "targetType": "SLIDE",
                      "path": "P1.S1.M1.C1.SL2",
                      "parentPath": "P1.S1.M1.C1",
                      "node": {
                        "id": "SL2",
                        "name": "HTML Tags - Updated",
                        "type": "video",
                        "key": "SLIDE",
                        "depth": 5,
                        "path": "P1.S1.M1.C1.SL2"
                      }
                    },
                    {
                      "action": "DELETE",
                      "targetType": "MODULE",
                      "path": "P1.S1.M2",
                      "parentPath": "P1.S1"
                    }
                  ]
                }
                ```

                ------------------------------------------------------------
                ✅ Explanation Field (Required)
                ------------------------------------------------------------

                - Use `<html>` with tags like `<p>`, `<ul>`, etc.
                - Write in first-person voice
                - Use **present continuous tense**
                - Include:
                  - What you understood from the prompt
                  - Why you chose the course structure
                  - Overview of the course
                  - Any assumptions made

                ------------------------------------------------------------
                ✅ Modifications Field (Required)
                ------------------------------------------------------------

                - List of `ADD`, `UPDATE`, or `DELETE` actions
                - Each modification must include:
                  - `action`: One of ADD, UPDATE, DELETE
                  - `targetType`: SLIDE, MODULE, etc.
                  - `path`: Full path to node
                  - `parentPath`: Parent path
                  - `node`: Required for ADD/UPDATE, omitted for DELETE

                ------------------------------------------------------------
                ✅ Package Field (Required)
                ------------------------------------------------------------

                - `packageId`: Always "P1"
                - `packageName`: A meaningful course title
                - `maxDepth`: Between 2–5
                - `tree`: Structured nodes with types like:
                  - MODULE → CHAPTER → SLIDE
                  - CHAPTER → SLIDE
                  - SLIDE (direct)

                ------------------------------------------------------------
                ✅ SLIDE Node Format
                ------------------------------------------------------------

                Each slide node must include:
                - `"key": "SLIDE"`
                - `"type"`: One of: "DOCUMENT", "YOUTUBE", "PRESENTATION", "CODE", "ASSIGNMENT", "ASSESSMENT"
                - `"contentId"`, `"embedding"`, `"merkleHash"`: null
                - `"contentTitle"`, `"contentDescription"`, `"contentData"`: relevant content

                Example for DOCUMENT:
                ```json
                "contentData": "# Introduction to JavaScript\\nJavaScript is a scripting language..."
                ```

                Example for YOUTUBE:
                ```json
                "contentData": {
                  "video_link": "https://youtube.com/...",
                  "description": "JavaScript async tutorial",
                  "title": "Async JS"
                }
                ```

                ------------------------------------------------------------
                📌 Final Instructions
                ------------------------------------------------------------

                1. Begin with a full thinking paragraph.
                2. Then alternate:
                   - `[Thinking...]` → planning
                   - `[Generating...]` → partial JSON
                3. Repeat until all content is generated.
                4. Conclude with a full valid JSON block including all fields.

                This method ensures thoughtful, structured streaming with accurate reasoning.

                ------------------------------------------------------------
                🧾 USER PROMPT:
                {{userPrompt}}
                ------------------------------------------------------------
                """;
    }
}
