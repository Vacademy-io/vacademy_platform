"""Question-generation prompts — ported verbatim from media_service
ConstantAiTemplate (getHtmlToQuestionTemplate, getTextToQuestionTemplate,
getImageGenerationInstruction). Literal JSON braces doubled for str.format.
"""
from __future__ import annotations

IMAGE_GENERATION_INSTRUCTION = """
- **Image Generation**:
  If a part of the question or option specifically requires a visual aid (diagram, figure, scene) that is NOT already present:
  Include a special div in the 'content' field:
  `<div class="image_to_generate">PROMPT: Detailed description of the image to generate</div>`
  This prompt will be used to generate an image using AI.
"""


_HTML_TO_QUESTIONS = """HTML raw data :  {htmlData}

        Prompt:
        Convert the given HTML file containing questions into the following JSON format:
        - Preserve all DS_TAGs in HTML content in comments
        {imageInstruction}

        JSON format :

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
                                 "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER",
                                 "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
                                 "level": "easy | medium | hard"
                             }}
                         ],
                         "title": "string" // Suitable title for the question paper,
                         "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"] // multiple chapter and topic names for question paper,
                         "difficulty": "easy | medium | hard",
                         "subjects": ["subject1", "subject2", "subject3", "subject4", "subject5"] // multiple subject names for question paper like maths or thermodynamics or physics etc ,
                         "classes": ["class 1" , "class 2" ] // can be of multiple class - | class 3 | class 4 | class 5 | class 6 | class 7 | class 8 | class 9 | class 10 | class 11 | class 12 | engineering | medical | commerce | law
                     }}

        For LONG_ANSWER, and ONE_WORD question types:
        - Leave 'correct_options' empty but fill 'ans' and 'exp'
        - Omit 'options' field entirely

        Also keep the DS_TAGS field intact in html
        And do not try to calculate right ans, only add if available in input

        IMPORTANT: {userPrompt}
"""


_TEXT_TO_QUESTIONS = """**Objective** : Generate {numberOfQuestions} {typeOfQuestion} questions for {classLevel} students about {topics} in {language}, maintaining strict JSON format and content preservation.
**Source Material**:
{textPrompt}

**Instructions**:
1. Continuation Handling:
   - Existing Questions: {existingQuestions}
   - {continuationInstruction}
   - Strictly avoid duplicate content from existing questions

2. Content Requirements:
   - Preserve ALL DS_TAGs in HTML comments
   - Include relevant images from source material
   - Questions must directly relate to {topics}
   - Maintain {classLevel} appropriate language
   {imageInstruction}

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
                         "title": "string" // Suitable title for the question paper ,
                          "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"] // multiple chapter and topic names for question paper,
                         "difficulty": "easy | medium | hard",
                         "is_process_completed": false
                         "subjects": ["subject1", "subject2", "subject3", "subject4", "subject5"] // multiple subject names for question paper like maths or thermodynamics or physics etc ,
                         "classes": ["class 1" , "class 2" ] // can be of multiple class - | class 3 | class 4 | class 5 | class 6 | class 7 | class 8 | class 9 | class 10 | class 11 | class 12 | engineering | medical | commerce | law
                     }}

       **Critical Rules**:
                                       - If textPrompt is insufficient for {numberOfQuestions} questions, try to extract first 10 questions
                                       - If existing questions >= {numberOfQuestions}, mark is_process_completed: true
                                       - Never modify DS_TAG comments
                                       - Maintain original HTML structure from source
                                       - Strictly validate JSON syntax
                                       - Ensure question numbers are sequential without gaps
                                       - Never repeat question stems or options
"""


_SORT_TOPIC_WISE = """                HTML raw data :  {htmlData}
                Already extracted question numbers: {extractedQuestionNumber}

                Prompt:
                Extract all questions from pdf and map all the extracted questions with respective topic and strictly follow Json Format:
                 - Strictly follow this: Do not repeat same question number in two or more topics
                 - If 'Already extracted question Number' is empty, start fresh from the beginning of the HTML.
                 - If it is not empty, continue generating from where the last question left off based on the existing data and avoid duplicate Questions.
                 - Do not extract any questions if already extracted all questions and set is_process_completed true.
                 - Preserve all DS_TAGs in HTML content in comments
                 {imageInstruction}

                JSON format :

                        {{
                            "questions": [
                                {{
                                    "question_number": "number",
                                    "question": {{ "type": "HTML", "content": "string" }},
                                    "options": [
                                        {{ "type": "HTML", "preview_id": "string", "content": "string" }}
                                    ],
                                    "correct_options": ["1"],
                                    "ans": "string",
                                    "exp": "string",
                                    "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER",
                                    "tags": ["tag1", "tag2"], // must include topic name
                                    "level": "easy | medium | hard"
                                }}
                            ],
                            "title": "string",
                            "tags": ["tag1", "tag2"],
                            "difficulty": "easy | medium | hard",
                            "subjects": ["subject1"],
                            "classes": ["class 9"],
                            "is_process_completed": false,
                            "topicQuestionMap":[
                                                  {{
                                                   "topic" : "String"
                                                   "questionNumbers": [number]
                                                  }}
                                               ]
                        }}

                For LONG_ANSWER, and ONE_WORD question types:
                - Leave 'correct_options' empty but fill 'ans' and 'exp'
                - Omit 'options' field entirely

                Tagging Rules:
                - Every question must include its topic in the "tags" field.
                - Questions belonging to the same topic must have identical "tags".

                Also keep the DS_TAGS field intact in HTML.
                Do not try to calculate correct answers — only include if already available in the input.
"""


_EXTRACT_TOPIC = """============================================================
TEACHER'S REQUEST (read this FIRST and follow it EXACTLY):
Required Topics :  {requiredTopics}

The teacher wants questions matching these specific topics / pages / question numbers. You MUST honor the count, type, difficulty, and language they specified if present in the topic description. Do NOT pull questions from outside the required scope.
============================================================

HTML raw data :  {htmlData}

Already extracted question Number = {allQuestionNumbers}

        Prompt:
        Extract ONLY questions that match the Required Topics above into the following JSON format:
        - If 'Already extracted question Number' is empty, start fresh from the beginning of the HTML.
        - Do not generate any questions if already generated all questions from Required Topics and set is_process_completed true.
        - Preserve all DS_TAGs in HTML content in comments
        - If the teacher specified a question count, type, difficulty, or language in the Required Topics description, you MUST honor it on every question you produce.
        {imageInstruction}

        JSON format :

                {{
                         "questions": [
                             {{
                                 "question_number": "number",
                                 "question": {{ "type": "HTML", "content": "string" }},
                                 "options": [
                                     {{ "type": "HTML", "preview_id": "string", "content": "string" }}
                                 ],
                                 "correct_options": ["1"],
                                 "ans": "string",
                                 "exp": "string",
                                 "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER ",
                                 "tags": ["tag1", "tag2"],
                                 "level": "easy | medium | hard"
                             }}
                         ],
                         "title": "string",
                         "tags": ["tag1", "tag2"],
                         "is_process_completed": false,
                         "difficulty": "easy | medium | hard",
                         "subjects": ["subject1"],
                         "classes": ["class 9"]
                     }}

        For LONG_ANSWER, and ONE_WORD question types:
        - Leave 'correct_options' empty but fill 'ans' and 'exp'
        - Omit 'options' field entirely

        Also keep the DS_TAGS field intact in html
        And do not try to calculate right ans, only add if available in input
        Give the complete result to all possible questions
"""


_AUDIO_TO_QUESTIONS = """============================================================
TEACHER'S REQUIREMENTS (follow EXACTLY):
  • Number of questions: {numQuestions}  (produce exactly this many — no fewer, no more)
  • Difficulty: {difficulty}             (set this on every question's "level" AND the top-level "difficulty")
  • Language: {language}                 (ALL questions, options, answers, explanations in this language — do NOT default to English)
  • Additional teacher prompt: {optionalPrompt}
============================================================

Class Lecture raw data :  {classLecture}
Already extracted question Number = {allQuestionNumbers}


        Prompt:
        From the given audio lecture, generate engaging questions of the difficulty specified above, in the language specified above, in the count specified above. Convert into the following JSON format:
          - If 'Already extracted question Number' is empty, start fresh from the beginning of the HTML.
         - Stop and set is_process_completed: true once you have produced exactly {numQuestions} questions.
         - Preserve all DS_TAGs in HTML content in comments
         {imageInstruction}


        JSON format :

                {{
                         "questions": [
                             {{
                                 "question_number": "number",
                                 "question": {{ "type": "HTML", "content": "string" }},
                                 "options": [
                                     {{ "type": "HTML", "preview_id": "string", "content": "string" }}
                                 ],
                                 "correct_options": ["1"],
                                 "ans": "string",
                                 "exp": "string",
                                 "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER",
                                 "tags": ["tag1", "tag2"],
                                 "level": "easy | medium | hard"
                             }}
                         ],
                         "title": "string",
                         "tags": ["tag1", "tag2"],
                         "is_process_completed": false,
                         "difficulty": "easy | medium | hard",
                         "subjects": ["subject1"],
                         "classes": ["class 9"]
                     }}

        For LONG_ANSWER, and ONE_WORD question types:
        - Leave 'correct_options' empty but fill 'ans' and 'exp'
        - Omit 'options' field entirely
"""


def build_audio_prompt(
    *, class_lecture: str, num_questions: str, difficulty: str, language: str,
    optional_prompt: str, generate_image: bool, all_question_numbers: str = "",
) -> str:
    return _AUDIO_TO_QUESTIONS.format(
        classLecture=class_lecture,
        numQuestions=num_questions,
        difficulty=difficulty,
        language=language,
        optionalPrompt=optional_prompt,
        allQuestionNumbers=all_question_numbers,
        imageInstruction=IMAGE_GENERATION_INSTRUCTION if generate_image else "",
    )


def build_html_prompt(html_data: str, user_prompt: str, generate_image: bool) -> str:
    return _HTML_TO_QUESTIONS.format(
        htmlData=html_data,
        userPrompt=user_prompt,
        imageInstruction=IMAGE_GENERATION_INSTRUCTION if generate_image else "",
    )


def build_topic_wise_prompt(html_data: str, generate_image: bool, extracted_question_number: str = "") -> str:
    return _SORT_TOPIC_WISE.format(
        htmlData=html_data,
        extractedQuestionNumber=extracted_question_number,
        imageInstruction=IMAGE_GENERATION_INSTRUCTION if generate_image else "",
    )


def build_extract_topic_prompt(
    html_data: str, required_topics: str, generate_image: bool, all_question_numbers: str = ""
) -> str:
    return _EXTRACT_TOPIC.format(
        requiredTopics=required_topics,
        htmlData=html_data,
        allQuestionNumbers=all_question_numbers,
        imageInstruction=IMAGE_GENERATION_INSTRUCTION if generate_image else "",
    )


def build_text_prompt(
    *,
    text_prompt: str,
    number_of_questions: str,
    type_of_question: str,
    class_level: str,
    topics: str,
    language: str,
    existing_questions: str,
    continuation_instruction: str,
    generate_image: bool,
) -> str:
    return _TEXT_TO_QUESTIONS.format(
        textPrompt=text_prompt,
        numberOfQuestions=number_of_questions,
        typeOfQuestion=type_of_question,
        classLevel=class_level,
        topics=topics,
        language=language,
        existingQuestions=existing_questions,
        continuationInstruction=continuation_instruction,
        imageInstruction=IMAGE_GENERATION_INSTRUCTION if generate_image else "",
    )
