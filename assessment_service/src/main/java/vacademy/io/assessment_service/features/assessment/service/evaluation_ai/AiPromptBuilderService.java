package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.CriteriaRubricDto;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.question_core.entity.Question;

import java.util.List;

/**
 * Service for building AI prompts for evaluation and extraction
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AiPromptBuilderService {

        private final ObjectMapper objectMapper;
        private final EvaluationUtilityService evaluationUtilityService;

        /**
         * Create evaluation prompt for AI grading
         */
        public String createEvaluationPrompt(String question, String answerSheet, String criteria,
                        String questionContext) {

                // Extract max marks from criteria JSON
                double maxMarks = 10.0; // default
                try {
                        CriteriaRubricDto rubric = objectMapper.readValue(criteria, CriteriaRubricDto.class);
                        if (rubric.getMaxMarks() != null) {
                                maxMarks = rubric.getMaxMarks();
                        }
                } catch (Exception e) {
                        log.warn("Could not parse criteria JSON to extract max marks, using default: {}",
                                        e.getMessage());
                }

                return String.format(
                                """
                                                You are an AI assistant tasked with evaluating a student's answer from their Markdown and LaTeX answer sheet.

                                                The answer sheet below contains Markdown content with LaTeX equations - you MUST search through it carefully to find the answer.
                                                **IMPORTANT**: The answer sheet may contain spelling mistakes, handwriting OCR errors, or typos. Focus on the INTENT and MEANING of the answer, not perfect spelling.

                                                **Question:**
                                                %s

                                                %s

                                                **Evaluation Criteria (JSON):**
                                                %s

                                                **Student's Markdown Answer Sheet:**
                                                [[%s]]

                                                **CRITICAL MARKING CONSTRAINTS:**
                                                - The MAXIMUM marks you can award for this question is: %.1f
                                                - Your total "marks_awarded" MUST NOT exceed %.1f under any circumstances.
                                                - Even for exceptional answers, you cannot award more than %.1f marks.
                                                - The criteria may allow for bonus marks, but the final total cannot exceed the question's max marks.

                                                **Type-Specific Evaluation Instructions:**

                                                **For MCQ/Multiple Choice Questions:**
                                                - If options are provided above, check if student selected the correct option POSITION
                                                - Student may write "1", "a", "i", "option 1", etc. - FOCUS ON THE POSITION NUMBER
                                                - Award FULL MARKS if the position/number matches the correct answer, EVEN IF option text is misspelled
                                                - Examples: If correct answer is option 2, accept: "2", "B", "b", "ii", "option 2", "opshun too"

                                                **For ONE_WORD/Short Answer Questions:**
                                                - Expect concise, brief answers
                                                - Accept close variants and spelling errors if meaning is clear
                                                - Match against correct answer if provided in auto_evaluation_json

                                                **For LONG_ANSWER/Descriptive Questions:**
                                                - Evaluate conceptual understanding and depth
                                                - Consider structure, examples, and explanation quality
                                                - Spelling errors should NOT reduce marks significantly

                                                **General Instructions:**
                                                1. **IGNORE spelling errors and OCR mistakes** - Focus on the conceptual understanding, not spelling accuracy.
                                                2. **CAREFULLY search** through the Markdown answer sheet above to find the answer to this specific question.
                                                3. The answer sheet may contain answers to multiple questions - locate the one relevant to this question.
                                                4. Extract the answer text/content from the Markdown.
                                                5. **Handle LaTeX equations**: Pay special attention to $...$ and $$...$$ expressions for mathematical answers.
                                                6. **Process images**: If you see [IMAGE: description - url] markers, consider them as part of the answer (diagrams/figures).
                                                7. If you cannot find ANY answer in the Markdown for this question, only then mark as "NOT_ATTEMPTED".
                                                8. Evaluate the answer based on the criteria provided.
                                                9. Assign marks for each criterion, but ensure the TOTAL does not exceed %.1f marks.
                                                10. Provide specific feedback based on what the student wrote.

                                                **IMPORTANT:**
                                                - **DO NOT PENALIZE for handwriting OCR errors or spelling mistakes**
                                                - **For MCQs: Match option POSITION (number) not exact text**
                                                - The Markdown may contain LaTeX for mathematical expressions - evaluate these correctly.
                                                - Look for any text, bullet points, paragraphs, or formatted content that answers the question.
                                                - Images may represent diagrams or graphs that are part of the answer.
                                                - Only mark as "NOT_ATTEMPTED" if the Markdown truly contains no relevant answer.
                                                - **FINAL CHECK**: Verify that marks_awarded ≤ %.1f

                                                **Output Format (JSON):**
                                                {
                                                  "marks_awarded": 5.0,
                                                  "extracted_answer": "The actual answer text extracted from the Markdown...",
                                                  "feedback": "Evaluation feedback based on the criteria...",
                                                  "criteria_breakdown": [
                                                    { "criteria_name": "Concept", "marks": 2.0, "reason": "Specific reason based on the answer" }
                                                  ]
                                                }
                                                """,
                                question, questionContext, criteria, answerSheet, maxMarks, maxMarks, maxMarks,
                                maxMarks, maxMarks);
        }

        /**
         * Create answer extraction prompt for single question
         */
        public String createAnswerExtractionPrompt(String questionText, String questionId, String htmlAnswerSheet) {

                log.info("Markdown content being processed for extraction for question {}: length={}, content preview={}",
                                questionId,
                                htmlAnswerSheet.length(),
                                htmlAnswerSheet.length() > 1000 ? htmlAnswerSheet.substring(0, 1000)
                                                : htmlAnswerSheet);

                // Escape double quotes in content to prevent JSON breaking
                String escapedContent = htmlAnswerSheet.trim().replace("\"", "\\\"");

                return String.format(
                                """
                                                You are an AI assistant tasked with extracting the answer for a specific question from a student's Markdown answer sheet.

                                                DO NOT evaluate the answer or assign any marks.
                                                Your ONLY task is to find and extract the answer written by the student for this specific question.

                                                **Question ID:** %s

                                                **Question Text:**
                                                [[%s]]

                                                **Student's Markdown Answer Sheet:**
                                                [[%s]]

                                                **Extraction Instructions:**
                                                1. **FIND QUESTION NUMBER FIRST** - Look for "Q1", "Q2", "Question 1", "1)", "1.", etc. written by student near the answer.
                                                2. **Match by question number** - Students may answer questions in ANY order, not sequentially.
                                                3. **Look for readable TEXT** - paragraphs, sentences, bullet points, lists with actual words.
                                                4. **Handle Markdown formatting** - Preserve **bold**, *italic*, lists (-, *, 1.), and other Markdown syntax.
                                                5. **Process LaTeX equations** - Keep $...$ and $$...$$ expressions intact for mathematical content.
                                                6. **Handle images** - If you see [IMAGE: description - url] markers, these represent diagrams/figures and should be included.
                                                7. **Match to question** - Find text that logically answers or relates to the question above.
                                                8. **Extract relevant content** - Pull out all text that contains the answer, even if scattered.
                                                9. **Format properly** - Maintain Markdown formatting (*bold*, _italic_, lists, etc.).
                                                10. **IGNORE spelling errors** - Do not try to correct handwriting OCR errors or typos, preserve as written.

                                                **Important:**
                                                - **The student may write answers in different order than the assessment** - use question numbers to match.
                                                - Search the ENTIRE Markdown content thoroughly.
                                                - Capture the question number/label (Q1, Q2, etc.) student wrote in the "student_question_number" field.
                                                - Preserve LaTeX mathematical expressions exactly.
                                                - Return ONLY valid JSON in the exact structure below.

                                                **Output Format (JSON):**
                                                {
                                                  "question_id": "%s",
                                                  "question_text": "[[The question text...]]",
                                                  "answer_html": "[[The extracted and formatted Markdown content...]]",
                                                  "status": "ATTEMPTED" or "NOT_ATTEMPTED",
                                                  "student_question_number": "The question number/label student wrote (e.g., 'Q1', '1)', '2.', etc.) or null if not found"
                                                }
                                                """,
                                questionId, questionText, escapedContent, questionId);
        }

        /**
         * Create batch extraction prompt for all questions
         */
        public String createBatchExtractionPrompt(List<QuestionWiseMarks> marksList, String studentPdfContent) {
                // Build question list for prompt
                StringBuilder questionsList = new StringBuilder();
                int qNum = 1;
                for (QuestionWiseMarks marks : marksList) {
                        String questionText = evaluationUtilityService
                                        .cleanHtml(evaluationUtilityService.extractQuestionText(marks.getQuestion()));
                        questionsList.append(String.format("%d. **Question ID: %s**\n   %s\n\n",
                                        qNum++, marks.getQuestion().getId(), questionText));
                }

                // Escape double quotes in content to prevent JSON breaking
                String escapedContent = studentPdfContent.trim().replace("\"", "\\\"");

                return String.format(
                                """
                                                You are an AI assistant tasked with extracting answers for ALL questions from a student's Markdown answer sheet.

                                                **Questions to Extract:**
                                                %s

                                                **Student's Markdown Answer Sheet:**
                                                [[%s]]

                                                **Extraction Instructions:**
                                                1. **FIND QUESTION NUMBER FIRST** - Look for "Q1", "Q2", "Question 1", "1)", "1.", etc. written by student.
                                                2. **Extract answer for EACH question** - Match by question number or content relevance.
                                                3. **Handle out-of-order answers** - Students may answer in any sequence.
                                                4. **IGNORE spelling errors** - Preserve as written, don't correct.
                                                5. **Preserve LaTeX** - Keep $...$ and $$...$$ expressions intact.
                                                6. **Mark NOT_ATTEMPTED** if no readable content found for a question.

                                                **Output Format (JSON array):**
                                                {
                                                  "answers": [
                                                    {
                                                      "question_id": "question-uuid-1",
                                                      "question_text": "...",
                                                      "answer_html": "extracted answer content",
                                                      "status": "ATTEMPTED",
                                                      "student_question_number": "Q1"
                                                    },
                                                    {
                                                      "question_id": "question-uuid-2",
                                                      "question_text": "...",
                                                      "answer_html": "extracted answer content",
                                                      "status": "ATTEMPTED",
                                                      "student_question_number": "Q2"
                                                    }
                                                  ]
                                                }
                                                """,
                                questionsList.toString(), escapedContent);
        }

        /**
         * Build comprehensive question context including options and correct answer
         */
        public String buildQuestionContext(Question question) {
                StringBuilder context = new StringBuilder();

                // Add question type
                context.append("**Question Type:** ").append(question.getQuestionType()).append("\n\n");

                // Add options if available
                if (question.getOptions() != null && !question.getOptions().isEmpty()) {
                        context.append("**Available Options:**\n");
                        int optionIndex = 1;
                        for (var option : question.getOptions()) {
                                String optionText = "";
                                if (option.getText() != null && option.getText().getContent() != null) {
                                        optionText = evaluationUtilityService.cleanHtml(option.getText().getContent());
                                }
                                // Provide multiple format hints: a/b/c, 1/2/3, i/ii/iii
                                char letter = (char) ('A' + optionIndex - 1);
                                String romanNumeral = toRomanNumeral(optionIndex);
                                context.append(String.format("%d) [Also: %c, %s] %s\n",
                                                optionIndex, letter, romanNumeral, optionText));
                                optionIndex++;
                        }
                        context.append("\n");
                }

                // Add correct answer from auto_evaluation_json
                if (question.getAutoEvaluationJson() != null && !question.getAutoEvaluationJson().isEmpty()) {
                        try {
                                context.append("**Correct Answer (auto_evaluation_json):**\n");
                                JsonNode autoEval = objectMapper.readTree(question.getAutoEvaluationJson());
                                context.append(objectMapper.writerWithDefaultPrettyPrinter()
                                                .writeValueAsString(autoEval)).append("\n\n");
                        } catch (Exception e) {
                                log.warn("Failed to parse auto_evaluation_json for question {}: {}",
                                                question.getId(), e.getMessage());
                        }
                }

                return context.toString();
        }

        /**
         * Convert number to Roman numeral (1-20)
         */
        private String toRomanNumeral(int num) {
                String[] romanNumerals = { "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
                                "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx" };
                if (num >= 1 && num <= 20) {
                        return romanNumerals[num - 1];
                }
                return String.valueOf(num);
        }
}
