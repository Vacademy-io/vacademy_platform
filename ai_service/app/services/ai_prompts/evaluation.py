"""Answer-evaluation prompts — ported verbatim from media_service
AiAnswerEvaluationService (extractAnsForEachQuestionPromptForDeepSeek +
generatePromptToEvaluateAnswer).

Both are built by string concatenation (NOT placeholder templates), so the
literal JSON braces in the instruction blocks are kept as-is (no doubling).

Two-step design:
  STEP 1 (extract): map each metadata question to the student's written answer
    from their converted-HTML answer sheet (no scoring). → SectionWiseAnsExtracted[]
  STEP 2 (evaluate): score the extracted answers against each question's
    markingJson rubric. → EvaluationResult
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List

# STEP 1 — verbatim instruction block from extractAnsForEachQuestionPromptForDeepSeek
_EXTRACT_INSTRUCTIONS = """You are an AI assistant tasked with extracting answers from a student's HTML answer sheet.

DO NOT evaluate the answers or assign any marks.
Your ONLY task is to map each question (provided in the assessment metadata) to the answer written by the student.
If the student has not written an answer for a question, mark it as "NOT_ATTEMPTED".

Instructions:
- Every question from the metadata must be included in the output.
- Group the results section-wise.
- Sort questions by their 'question_order'.
- For each question, return:
  - question_id
  - question_order
  - question_text (wrap inside [[ ]] to preserve formatting and HTML safely)
  - question_wise_ans_extracted: {
      answer_html (wrap inside [[ ]] to preserve formatting and HTML safely),
      status ("ATTEMPTED" or "NOT_ATTEMPTED")
    }

Important:
- ONLY return the extracted result as a valid JSON in the exact structure below.
- Do NOT include any explanation, extra text, or formatting outside of the JSON.
- Use double quotes for all JSON keys and string values.
- Ensure all special characters in HTML (like quotes) are escaped properly.
- Wrap HTML content and question text in double square brackets [[ ... ]] to prevent breaking the JSON format.

Additional Instructions for Answer Formatting:
 - **Correct any spelling errors** in the student's answers based on the context of the question. Ensure that the corrected text makes sense within the context of the question being answered.
 - **Format the answers properly**. If the student has written points or lists, ensure they are formatted using HTML bullet points (<ul>, <li>) or numbered lists (<ol>, <li>). Ensure paragraphs are wrapped in <p> tags where appropriate.
 - **Maintain the original intent and meaning** of the answer while making it more readable and structured. For example, if the student has provided an unordered list of points in a plain text form, convert it into a proper HTML list.

JSON Response Format:
[
  {
    "section_id": "<section_id>",
    "section_name": "<section_name>",
    "question_wise_ans_extracted": [
      {
        "question_id": "<question_id>",
        "question_order": <order>,
        "question_text": "<text>",
        "answer_html": "<html>",
        "status": "ATTEMPTED" or "NOT_ATTEMPTED"
      }
    ]
  }
]

Below is the assessment metadata (questions grouped by sections):
"""

# STEP 2 — verbatim instruction block from generatePromptToEvaluateAnswer
_EVALUATE_INSTRUCTIONS = """You are an AI assistant tasked with evaluating the student's answers using the provided metadata and answer sheet.

Instructions:
- For each question:
  - If the student answered, evaluate the answer based on the evaluation criteria provided in the AI evaluation question metadata. Each criterion has a name and a weight, which determines the marks for the answer.
  - For each criterion:
    - Assign marks based on the student's response.
    - The weight of the criterion determines how much the answer contributes to the total marks.
  - If the student skipped, mark as "NOT_ATTEMPTED" and assign 0 marks.
  - ⚠️ If no evaluation criteria (marking JSON) is provided for a question (i.e., the criteria list is empty or null):
    - In the feedback, clearly mention: "No evaluation criteria provided."
    - Assign 0 marks for such questions by default.

- For each question, provide:
  - Marks obtained
  - Total marks (based on all available criteria)
  - Feedback (short and clear)
  - Description (brief reasoning on why marks were awarded or deducted based on the evaluation criteria)
  - Verdict (e.g., "Correct", "Partially Correct", "Incorrect", "Not Attempted")

⚠️ Important:
- ONLY return a valid **JSON** response in the exact format described below.
- Do NOT include any explanation, summary, or formatting outside the JSON.
- Use double quotes for all JSON keys and string values.
- Escape any special characters properly if needed.

JSON Response Format:
{
  "total_marks_obtained": <double>,
  "total_marks": <double>,
  "overall_verdict": "<verdict>",
  "overall_description": "<short summary>",
  "section_wise_results": [
    {
      "section_id": "<section_id>",
      "section_name": "<section_name>",
      "marks_obtained": <double>,
      "total_marks": <double>,
      "verdict": "<section_verdict>",
      "question_wise_results": [
        {
          "question_id": "<question_id>",
          "question_order": <int>,
          "question_text": "<text>",
          "marks_obtained": <double>,
          "total_marks": <double>,
          "feedback": "<short comment>",
          "description": "<detailed reasoning based on evaluation criteria>",
          "verdict": "<Correct/Incorrect/Partially Correct/Not Attempted>"
        }
      ]
    }
  ]
}

Below is the metadata and student answers for evaluation:
"""

_MJX_RE = re.compile(r"<mjx-[^>]*>.*?</mjx-[^>]*>", re.DOTALL)


def build_extract_prompt(sections: List[Dict[str, Any]], html_answer_sheet: str) -> str:
    """STEP 1 prompt: instructions + section/question listing + the answer-sheet
    HTML. Mirrors extractAnsForEachQuestionPromptForDeepSeek exactly (incl. the
    [[ ]] wrapping, the \" escaping, and the mjx-tag strip)."""
    parts: List[str] = [_EXTRACT_INSTRUCTIONS]
    for section in sections or []:
        parts.append(f"Section Name: {section.get('name')}\n")
        parts.append(f"Section ID: {section.get('id')}\n")
        for question in section.get("questions", []) or []:
            reach = question.get("reachText") or {}
            content = (reach.get("content") or "").replace('"', '\\"')
            parts.append(f"- Question Order: {question.get('questionOrder')}\n")
            parts.append(f"  Question ID: {reach.get('id')}\n")
            parts.append(f"  Question Text: [[{content}]]\n")
        parts.append("\n")

    sheet = _MJX_RE.sub("", html_answer_sheet or "")
    parts.append("Below is the HTML answer sheet submitted by the student:\n\n")
    parts.append("[[")
    parts.append(sheet.strip().replace('"', '\\"'))
    parts.append("]]")
    return "".join(parts)


def build_evaluate_prompt(
    section_wise_extracted: List[Dict[str, Any]], metadata: Dict[str, Any]
) -> str:
    """STEP 2 prompt: instructions + the metadata JSON (questions + marking
    rubric) + the extracted student answers JSON. Mirrors
    generatePromptToEvaluateAnswer."""
    return (
        _EVALUATE_INSTRUCTIONS
        + "\nMetadata:\n"
        + json.dumps(metadata)
        + "\n\nStudent Answers:\n"
        + json.dumps(section_wise_extracted)
    )
