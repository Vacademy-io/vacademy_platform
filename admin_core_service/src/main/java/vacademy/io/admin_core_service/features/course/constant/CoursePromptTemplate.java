package vacademy.io.admin_core_service.features.course.constant;

public class CoursePromptTemplate {

    public static String getGenerateCourseWithAiTemplate() {
        return """
            You are an expert course designer AI. Your task is to create a comprehensive course structure based on a user's request.Please understand existingCourse if present.

            ------------------------------------------------------------
            📌 STEP 1: Simulate Your Initial Thought Process (Plain Text Only)
            ------------------------------------------------------------

            🧠 Before doing anything else, simulate your internal reasoning in a paragraph.

            ✅ Your thought paragraph MUST include:
            - What you understood from the user prompt
            - What assumptions you are making
            - Whether an existing course already exists (check `existingCourse`)
            - If `existingCourse` is present: how you plan to improve, update, or extend it
            - If not present: that you’re building a new course from scratch
            - What depth/structure you are choosing (e.g., MODULE → CHAPTER → SLIDE)
            - Why you chose that structure
            - What kind of content you are planning
            - What you will do next

            ✅ Format: Natural, first-person, present continuous tense.

            🔒 Do NOT generate any JSON in this section.

            🔄 Example:
            "Okay, the user wants a course on {{userPrompt}}. I’ve checked the existing course structure. Since it already has a base structure, I’m planning to add two more advanced modules. I’ll use a depth of 5 to maintain consistency. Now I’ll begin outlining the next subject and generating partial JSON."

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
                  "action": "ADD" | "UPDATE" | "DELETE",
                  "targetType": "COURSE" | "SUBJECT" | "MODULE" | "CHAPTER" | "SLIDE",
                  "modifiedPath": "C1.S2.M2.CH2.SL9",  //If action is ADD then do not generate modifiedPath
                  "parentPath": "C1.S2.M2.CH2",
                  "name": "STRING",
                  "description": "STRING",
                  "node": {  //If action is DELETE no need to generate node
                    "id": "SL9",
                    "name": "Asynchronous JavaScript",
                    "type": "STRING",
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
                  "action": "ADD" | "UPDATE" | "DELETE",
                  "targetType": "COURSE" | "SUBJECT" | "MODULE" | "CHAPTER" | "SLIDE",
                  "modifiedPath": "C1.S2.M2.CH2.SL9",  //If action is ADD then do not generate modifiedPath
                  "parentPath": "C1.S2.M2.CH2",
                  "name": "STRING",
                  "description": "STRING",
                  "node": {
                    "id": "SL9",
                    "name": "Asynchronous JavaScript",
                    "type": "STRING",
                    "key": "SLIDE",
                    "depth": 5,
                    "path": "P1.S2.M2.C2.SL9"
                  }
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
              - Whether an existing course was used or not
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

             - Decide Depth:
              - Based on complexity and userPrompt decide max depth of the course.
              - If Course is very complex and need depth then use 5 max depth (COURSE->SUBJECT->MODULE->CHAPTER->SLIDE)
              - If Course is Complex and can be managed in max 4 depth (COURSE->MODULE->CHAPTER->SLIDE)
              - If Course is Moderate Complex then can be managed in max 3 depths (COURSE->CHAPTER->SLIDE)
              - If Course is Simple and can be managed in max 2 depth (COURSE->SLIDE)

            ------------------------------------------------------------
            ✅ SLIDE Content Generation Guidelines (IMPORTANT)
            ------------------------------------------------------------
            
            Each slide must be a **mini-tutorial** on the topic and must include:
            
            - ✅ A clear **headline** using `#` or `##`
            - ✅ A detailed explanation (at least 150–250 words) covering:
              - What it is
              - Why it's important
              - How it works
              - Real-world use cases or examples
            - ✅ Use **Markdown formatting** in `contentData`:
              - `**bold**` for important terms
              - Bullet lists (`-`) where applicable
              - `---` for separation between sub-sections
            - ✅ If slide type is `DOCUMENT`:
              - Content must read like a standalone blog/tutorial
              - Include beginner-friendly analogies, where applicable
              - Add code snippets if relevant using ```js or ```java blocks
            
            - ✅ If slide type is `YOUTUBE`, the `contentData` should include:
              - A **high-quality, relevant video link**
              - A short but **informative description**
              - A **title that matches the slide topic**
            
            - ✅ Minimum Markdown word count for DOCUMENT: **200 words**
            
            ⚠️ Do NOT generate slides with vague lines like "this is an introduction" or "more details later."

            ✅ Good Slide Content (example):

            ```json
            "contentData": "## What is Async/Await in JavaScript\\\\n\\\\nAsync/Await makes asynchronous code look synchronous...\\\\n\\\\n---\\\\n\\\\n**Example**:\\\\n```js\\\\nasync function fetchUser() {\\\\n  const res = await fetch('/user');\\\\n  const data = await res.json();\\\\n  return data;\\\\n}\\\\n```"
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
            
             🌳 GLOBAL COURSE TREE HASH (Merkle)
            ------------------------------------------------------------
             {{merkleHash}}
            ------------------------------------------------------------
             🌿 PER-PATH MERKLE HASHES
            ------------------------------------------------------------
             {{merkleMap}}
            ------------------------------------------------------------
            📘 EXISTING COURSE (if present):
            ------------------------------------------------------------
            {{existingCourse}}
            ------------------------------------------------------------
            🧾 USER PROMPT:
            {{userPrompt}}
            ------------------------------------------------------------
            """;
    }



//    CONTEXTUAL KNOWLEDGE BASE (from documentation and blogs)
//                 ------------------------------------------------------------
//    {{context}}
}
