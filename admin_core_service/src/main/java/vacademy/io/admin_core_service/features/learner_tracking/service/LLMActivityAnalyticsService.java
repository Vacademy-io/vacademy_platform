package vacademy.io.admin_core_service.features.learner_tracking.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_tracking.dto.AssignmentSlideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.QuestionSlideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.QuizSideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.slide.entity.Option;
import vacademy.io.admin_core_service.features.slide.entity.QuestionSlide;
import vacademy.io.admin_core_service.features.slide.entity.QuizSlideQuestion;
import vacademy.io.admin_core_service.features.slide.entity.QuizSlideQuestionOption;
import vacademy.io.admin_core_service.features.slide.entity.Slide;
import vacademy.io.admin_core_service.features.slide.repository.QuestionSlideRepository;
import vacademy.io.admin_core_service.features.slide.repository.QuizSlideQuestionOptionRepository;
import vacademy.io.admin_core_service.features.slide.repository.QuizSlideQuestionRepository;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

/**
 * Comprehensive service for LLM-based activity analytics lifecycle.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LLMActivityAnalyticsService {

        private final ActivityLogRepository activityLogRepository;
        private final QuizSlideQuestionRepository quizSlideQuestionRepository;
        private final QuizSlideQuestionOptionRepository quizSlideQuestionOptionRepository;
        private final QuestionSlideRepository questionSlideRepository;
        private final SlideRepository slideRepository;
        private final ObjectMapper objectMapper;

        // ====================================================================================
        // PHASE 1: RAW DATA CAPTURE METHODS
        // ====================================================================================

        /**
         * Save raw quiz submission data for LLM analysis
         */
        public void saveQuizRawData(
                        ActivityLog originalActivityLog,
                        List<QuizSideActivityLogDTO> quizData,
                        String slideId,
                        String chapterId,
                        String packageSessionId,
                        String subjectId) {
                try {
                        log.info("[LLM] Saving quiz raw data for activity: {}, slide: {}",
                                        originalActivityLog.getId(), slideId);

                        Map<String, Object> rawJson = buildQuizRawJson(
                                        originalActivityLog,
                                        quizData,
                                        slideId,
                                        chapterId,
                                        packageSessionId,
                                        subjectId);

                        saveRawActivityLog("llm_quiz", originalActivityLog, rawJson);

                        log.info("[LLM] Successfully saved quiz raw data");
                } catch (Exception e) {
                        log.error("[LLM] Error saving quiz raw data for activity: {}",
                                        originalActivityLog.getId(), e);
                        // Don't throw - just log and continue
                }
        }

        /**
         * Save raw question submission data for LLM analysis
         */
        public void saveQuestionRawData(
                        ActivityLog originalActivityLog,
                        List<QuestionSlideActivityLogDTO> questionData,
                        String slideId,
                        String chapterId,
                        String packageSessionId,
                        String subjectId) {
                try {
                        log.info("[LLM] Saving question raw data for activity: {}, slide: {}, questionData size: {}",
                                        originalActivityLog.getId(), slideId,
                                        questionData != null ? questionData.size() : 0);

                        if (questionData != null && !questionData.isEmpty()) {
                                log.debug("[LLM] Question data details: {}", questionData);
                        }

                        Map<String, Object> rawJson = buildQuestionRawJson(
                                        originalActivityLog,
                                        questionData,
                                        slideId,
                                        chapterId,
                                        packageSessionId,
                                        subjectId);

                        saveRawActivityLog("llm_question", originalActivityLog, rawJson);

                        log.info("[LLM] Successfully saved question raw data");
                } catch (Exception e) {
                        log.error("[LLM] Error saving question raw data for activity: {}",
                                        originalActivityLog.getId(), e);
                }
        }

        /**
         * Save raw assignment submission data for LLM analysis
         */
        public void saveAssignmentRawData(
                        ActivityLog originalActivityLog,
                        List<AssignmentSlideActivityLogDTO> assignmentData,
                        String slideId,
                        String chapterId,
                        String packageSessionId,
                        String subjectId) {
                try {
                        log.info("[LLM] Saving assignment raw data for activity: {}, slide: {}",
                                        originalActivityLog.getId(), slideId);

                        Map<String, Object> rawJson = buildAssignmentRawJson(
                                        originalActivityLog,
                                        assignmentData,
                                        slideId,
                                        chapterId,
                                        packageSessionId,
                                        subjectId);

                        saveRawActivityLog("llm_assignment", originalActivityLog, rawJson);

                        log.info("[LLM] Successfully saved assignment raw data");
                } catch (Exception e) {
                        log.error("[LLM] Error saving assignment raw data for activity: {}",
                                        originalActivityLog.getId(), e);
                }
        }

        /**
         * Save raw assessment submission data for LLM analysis
         * This version is called directly from assessment_service via REST API
         * 
         * @param assessmentData Complete assessment submission data from
         *                       assessment_service
         */
        public void saveAssessmentRawDataFromExternal(Map<String, Object> assessmentData) {
                saveAssessmentRawData(assessmentData);
        }

        /**
         * Save raw assessment submission data for LLM analysis
         * This version is called directly from assessment_service via REST API
         * The data is already enriched and formatted by assessment_service
         * 
         * @param assessmentData Complete enriched assessment submission data from
         *                       assessment_service
         */
        public void saveAssessmentRawData(Map<String, Object> assessmentData) {
                try {
                        log.info("[LLM] Saving assessment raw data from assessment_service");

                        // Data is already enriched and properly formatted by assessment_service
                        // Just extract what we need and save directly
                        saveRawActivityLogForAssessment(assessmentData, assessmentData);

                        log.info("[LLM] Successfully saved assessment raw data");
                } catch (Exception e) {
                        log.error("[LLM] Error saving assessment raw data from service", e);
                        throw new RuntimeException("Failed to save assessment raw data", e);
                }
        }

        // ====================================================================================
        // PRIVATE HELPER METHODS
        // ====================================================================================

        /**
         * Build raw JSON for quiz submission following refined_rawjson.txt format
         */
        private Map<String, Object> buildQuizRawJson(
                        ActivityLog activityLog,
                        List<QuizSideActivityLogDTO> quizData,
                        String slideId,
                        String chapterId,
                        String packageSessionId,
                        String subjectId) {
                Map<String, Object> json = new LinkedHashMap<>();

                json.put("activity_type", "quiz_submission");
                json.put("timestamp", Instant.now().toString());

                // Content metadata
                Map<String, Object> content = new LinkedHashMap<>();
                content.put("slide_id", slideId);
                content.put("slide_type", "QUIZ");
                content.put("chapter_id", chapterId);
                content.put("package_session_id", packageSessionId);
                content.put("subject_id", subjectId);
                content.put("total_questions", quizData.size());

                // Fetch slide name
                Optional<Slide> slideOpt = slideRepository.findById(slideId);
                if (slideOpt.isPresent()) {
                        content.put("slide_name", slideOpt.get().getTitle());
                }

                json.put("content", content);

                // Session timing
                Map<String, Object> session = new LinkedHashMap<>();
                if (activityLog.getStartTime() != null) {
                        session.put("start_time", activityLog.getStartTime().toInstant().toString());
                }
                if (activityLog.getEndTime() != null) {
                        session.put("end_time", activityLog.getEndTime().toInstant().toString());
                }
                if (activityLog.getStartTime() != null && activityLog.getEndTime() != null) {
                        long durationSeconds = (activityLog.getEndTime().getTime()
                                        - activityLog.getStartTime().getTime()) / 1000;
                        session.put("duration_seconds", durationSeconds);
                }
                json.put("session", session);

                // Build questions array
                List<Map<String, Object>> questions = new ArrayList<>();
                int totalScore = 0;
                int maxScore = 0;
                int correct = 0;
                int incorrect = 0;

                for (int i = 0; i < quizData.size(); i++) {
                        QuizSideActivityLogDTO quizItem = quizData.get(i);
                        Map<String, Object> questionData = buildQuizQuestionData(quizItem, i + 1);
                        questions.add(questionData);

                        // Aggregate summary data
                        if (questionData.containsKey("student_answer")) {
                                @SuppressWarnings("unchecked")
                                Map<String, Object> studentAnswer = (Map<String, Object>) questionData
                                                .get("student_answer");
                                if (Boolean.TRUE.equals(studentAnswer.get("is_correct"))) {
                                        correct++;
                                } else {
                                        incorrect++;
                                }
                                Object marksEarned = studentAnswer.get("marks_earned");
                                if (marksEarned instanceof Number) {
                                        totalScore += ((Number) marksEarned).intValue();
                                }
                        }
                        Object marks = questionData.get("marks");
                        if (marks instanceof Number) {
                                maxScore += ((Number) marks).intValue();
                        }
                }
                json.put("questions", questions);

                // Summary
                Map<String, Object> summary = new LinkedHashMap<>();
                summary.put("total_score", totalScore);
                summary.put("max_score", maxScore);
                summary.put("percentage", maxScore > 0 ? (totalScore * 100.0 / maxScore) : 0.0);
                summary.put("questions_attempted", quizData.size());
                summary.put("correct", correct);
                summary.put("incorrect", incorrect);
                summary.put("skipped", 0);
                json.put("summary", summary);

                return json;
        }

        /**
         * Build individual question data for quiz
         * Optimized for LLM processing - includes text content instead of just IDs
         */
        @SuppressWarnings("unchecked")
        private Map<String, Object> buildQuizQuestionData(QuizSideActivityLogDTO quizItem, int order) {
                Map<String, Object> questionData = new LinkedHashMap<>();

                try {
                        log.debug("[LLM] Processing quiz item - questionId: {}, responseStatus: {}",
                                        quizItem.getQuestionId(), quizItem.getResponseStatus());

                        // Fetch question details from repository
                        Optional<QuizSlideQuestion> questionOpt = quizSlideQuestionRepository
                                        .findById(quizItem.getQuestionId());

                        if (questionOpt.isEmpty()) {
                                log.warn("[LLM] Question not found: {}", quizItem.getQuestionId());
                                return questionData;
                        }

                        QuizSlideQuestion question = questionOpt.get();

                        questionData.put("question_id", question.getId());
                        questionData.put("order", order);
                        questionData.put("question_type", question.getQuestionType());
                        questionData.put("response_type", question.getQuestionResponseType());
                        questionData.put("evaluation_type", question.getEvaluationType());

                        // Add question text content (for LLM readability)
                        if (question.getText() != null) {
                                Map<String, Object> questionText = new LinkedHashMap<>();
                                questionText.put("type", question.getText().getType());
                                questionText.put("content", question.getText().getContent());
                                questionData.put("question_text", questionText);
                        }

                        // Add parent text if exists
                        if (question.getParentRichText() != null) {
                                Map<String, Object> parentText = new LinkedHashMap<>();
                                parentText.put("type", question.getParentRichText().getType());
                                parentText.put("content", question.getParentRichText().getContent());
                                questionData.put("parent_text", parentText);
                        }

                        // Add explanation text if exists
                        if (question.getExplanationText() != null) {
                                Map<String, Object> explanationText = new LinkedHashMap<>();
                                explanationText.put("type", question.getExplanationText().getType());
                                explanationText.put("content", question.getExplanationText().getContent());
                                questionData.put("explanation_text", explanationText);
                        }

                        // Store auto_evaluation_json directly without parsing
                        if (question.getAutoEvaluationJson() != null
                                        && !question.getAutoEvaluationJson().trim().isEmpty()) {
                                try {
                                        Object autoEvalObj = objectMapper.readValue(question.getAutoEvaluationJson(),
                                                        Object.class);
                                        questionData.put("auto_evaluation", autoEvalObj);
                                } catch (JsonProcessingException e) {
                                        log.warn("[LLM] Invalid JSON in autoEvaluationJson for question: {}",
                                                        question.getId(), e);
                                        questionData.put("auto_evaluation", null);
                                }
                        } else {
                                questionData.put("auto_evaluation", null);
                        }

                        // Fetch options with text content
                        List<QuizSlideQuestionOption> options = quizSlideQuestionOptionRepository
                                        .findByQuizSlideQuestionId(question.getId());

                        // Build options array with text content (much better for LLM)
                        List<Map<String, Object>> optionsData = new ArrayList<>();
                        for (QuizSlideQuestionOption option : options) {
                                Map<String, Object> optionMap = new LinkedHashMap<>();
                                optionMap.put("option_id", option.getId());

                                // Add option text
                                if (option.getText() != null) {
                                        Map<String, Object> optionText = new LinkedHashMap<>();
                                        optionText.put("type", option.getText().getType());
                                        optionText.put("content", option.getText().getContent());
                                        optionMap.put("text", optionText);
                                }

                                // Add option explanation if exists
                                if (option.getExplanationText() != null) {
                                        Map<String, Object> optionExplanation = new LinkedHashMap<>();
                                        optionExplanation.put("type", option.getExplanationText().getType());
                                        optionExplanation.put("content", option.getExplanationText().getContent());
                                        optionMap.put("explanation", optionExplanation);
                                }

                                optionsData.add(optionMap);
                        }
                        questionData.put("options", optionsData);
                        questionData.put("options_count", options.size());

                        // Store student's response_json directly
                        if (quizItem.getResponseJson() != null && !quizItem.getResponseJson().trim().isEmpty()) {
                                try {
                                        Object responseObj = objectMapper.readValue(quizItem.getResponseJson(),
                                                        Object.class);

                                        Map<String, Object> studentAnswer = new LinkedHashMap<>();
                                        studentAnswer.put("response_data", responseObj);
                                        studentAnswer.put("is_correct", "CORRECT".equals(quizItem.getResponseStatus()));
                                        studentAnswer.put("response_status", quizItem.getResponseStatus());

                                        questionData.put("student_answer", studentAnswer);
                                } catch (JsonProcessingException e) {
                                        log.error("[LLM] Invalid JSON in responseJson for question: {}",
                                                        question.getId(), e);
                                        Map<String, Object> studentAnswer = new LinkedHashMap<>();
                                        studentAnswer.put("response_data", null);
                                        studentAnswer.put("is_correct", "CORRECT".equals(quizItem.getResponseStatus()));
                                        studentAnswer.put("response_status", quizItem.getResponseStatus());
                                        questionData.put("student_answer", studentAnswer);
                                }
                        } else {
                                Map<String, Object> studentAnswer = new LinkedHashMap<>();
                                studentAnswer.put("response_data", null);
                                studentAnswer.put("is_correct", "CORRECT".equals(quizItem.getResponseStatus()));
                                studentAnswer.put("response_status", quizItem.getResponseStatus());
                                questionData.put("student_answer", studentAnswer);
                        }

                } catch (Exception e) {
                        log.error("[LLM] Error building question data for: {}", quizItem.getQuestionId(), e);
                }

                return questionData;
        }

        /**
         * Build raw JSON for question submission
         */
        private Map<String, Object> buildQuestionRawJson(
                        ActivityLog activityLog,
                        List<QuestionSlideActivityLogDTO> questionData,
                        String slideId,
                        String chapterId,
                        String packageSessionId,
                        String subjectId) {
                Map<String, Object> json = new LinkedHashMap<>();

                try {
                        json.put("activity_type", "question_submission");
                        json.put("timestamp", Instant.now().toString());

                        // Content metadata
                        Map<String, Object> content = new LinkedHashMap<>();
                        content.put("slide_id", slideId);
                        content.put("slide_type", "QUESTION");
                        content.put("chapter_id", chapterId);
                        content.put("package_session_id", packageSessionId);
                        content.put("subject_id", subjectId);
                        json.put("content", content);

                        // Step 1: Fetch the Slide record to get the source_id
                        log.info("[LLM] Looking up Slide with ID: {}", slideId);
                        Optional<Slide> slideOpt = slideRepository.findById(slideId);

                        if (slideOpt.isEmpty()) {
                                log.error("[LLM] Slide NOT FOUND for slideId: {}", slideId);
                                json.put("error", "Slide not found with ID: " + slideId);
                                return json;
                        }

                        Slide slide = slideOpt.get();

                        // Add slide name to content now that we have the slide
                        content.put("slide_name", slide.getTitle());
                        String actualQuestionId = slide.getSourceId();

                        log.info("[LLM] Found Slide: id={}, sourceId={}, sourceType={}",
                                        slide.getId(), actualQuestionId, slide.getSourceType());

                        if (actualQuestionId == null) {
                                log.error("[LLM] Slide has null sourceId for slideId: {}", slideId);
                                json.put("error", "Slide has null sourceId");
                                return json;
                        }

                        // Step 2: Fetch question slide details with all text data eagerly loaded
                        log.info("[LLM] Looking up QuestionSlide with sourceId: {}", actualQuestionId);
                        Optional<QuestionSlide> questionSlideOpt = questionSlideRepository
                                        .findByIdWithText(actualQuestionId);

                        if (questionSlideOpt.isEmpty()) {
                                log.error("[LLM] QuestionSlide NOT FOUND for slideId: {}, actualQuestionId: {}",
                                                slideId, actualQuestionId);
                                json.put("error", "QuestionSlide not found with ID: " + actualQuestionId);
                                return json;
                        }

                        QuestionSlide questionSlide = questionSlideOpt.get();
                        log.info("[LLM] Successfully found QuestionSlide: id={}, type={}, responseType={}, hasText={}, hasOptions={}",
                                        questionSlide.getId(),
                                        questionSlide.getQuestionType(),
                                        questionSlide.getQuestionResponseType(),
                                        questionSlide.getTextData() != null,
                                        questionSlide.getOptions() != null && !questionSlide.getOptions().isEmpty());

                        // Build question details with text content (LLM-friendly)
                        Map<String, Object> questionDetails = new LinkedHashMap<>();
                        questionDetails.put("question_type", questionSlide.getQuestionType());
                        questionDetails.put("response_type", questionSlide.getQuestionResponseType());
                        questionDetails.put("evaluation_type", questionSlide.getEvaluationType());
                        questionDetails.put("points", questionSlide.getPoints());
                        questionDetails.put("time_limit_mins", questionSlide.getDefaultQuestionTimeMins());
                        questionDetails.put("re_attempt_count", questionSlide.getReAttemptCount());

                        // Add question text
                        if (questionSlide.getTextData() != null) {
                                Map<String, Object> questionText = new LinkedHashMap<>();
                                questionText.put("type", questionSlide.getTextData().getType());
                                questionText.put("content", questionSlide.getTextData().getContent());
                                questionDetails.put("question_text", questionText);
                        }

                        // Add parent text if exists
                        if (questionSlide.getParentRichText() != null) {
                                Map<String, Object> parentText = new LinkedHashMap<>();
                                parentText.put("type", questionSlide.getParentRichText().getType());
                                parentText.put("content", questionSlide.getParentRichText().getContent());
                                questionDetails.put("parent_text", parentText);
                        }

                        // Add explanation text if exists
                        if (questionSlide.getExplanationTextData() != null) {
                                Map<String, Object> explanationText = new LinkedHashMap<>();
                                explanationText.put("type", questionSlide.getExplanationTextData().getType());
                                explanationText.put("content", questionSlide.getExplanationTextData().getContent());
                                questionDetails.put("explanation_text", explanationText);
                        }

                        // Add auto evaluation data
                        if (questionSlide.getAutoEvaluationJson() != null
                                        && !questionSlide.getAutoEvaluationJson().trim().isEmpty()) {
                                try {
                                        Object autoEvalObj = objectMapper
                                                        .readValue(questionSlide.getAutoEvaluationJson(), Object.class);
                                        questionDetails.put("auto_evaluation", autoEvalObj);
                                } catch (JsonProcessingException e) {
                                        log.warn("[LLM] Invalid JSON in autoEvaluationJson for question slide: {}",
                                                        slideId, e);
                                        questionDetails.put("auto_evaluation", null);
                                }
                        } else {
                                questionDetails.put("auto_evaluation", null);
                        }

                        // Add options if they exist (for MCQ type questions)
                        if (questionSlide.getOptions() != null && !questionSlide.getOptions().isEmpty()) {
                                List<Map<String, Object>> optionsData = new ArrayList<>();
                                for (Option option : questionSlide.getOptions()) {
                                        Map<String, Object> optionMap = new LinkedHashMap<>();
                                        optionMap.put("option_id", option.getId());

                                        // Add option text
                                        if (option.getText() != null) {
                                                Map<String, Object> optionText = new LinkedHashMap<>();
                                                optionText.put("type", option.getText().getType());
                                                optionText.put("content", option.getText().getContent());
                                                optionMap.put("text", optionText);
                                        }

                                        // Add option explanation if exists
                                        if (option.getExplanationTextData() != null) {
                                                Map<String, Object> optionExplanation = new LinkedHashMap<>();
                                                optionExplanation.put("type",
                                                                option.getExplanationTextData().getType());
                                                optionExplanation.put("content",
                                                                option.getExplanationTextData().getContent());
                                                optionMap.put("explanation", optionExplanation);
                                        }

                                        optionsData.add(optionMap);
                                }
                                questionDetails.put("options", optionsData);
                                questionDetails.put("options_count", optionsData.size());
                        }

                        json.put("question", questionDetails);

                        // Add student's attempts/responses
                        if (questionData != null && !questionData.isEmpty()) {
                                log.info("[LLM] Processing {} question attempts", questionData.size());
                                List<Map<String, Object>> attempts = new ArrayList<>();
                                for (QuestionSlideActivityLogDTO attempt : questionData) {
                                        Map<String, Object> attemptData = new LinkedHashMap<>();
                                        attemptData.put("attempt_number", attempt.getAttemptNumber());
                                        attemptData.put("marks", attempt.getMarks());
                                        attemptData.put("response_status", attempt.getResponseStatus());

                                        // Store response_json directly
                                        if (attempt.getResponseJson() != null
                                                        && !attempt.getResponseJson().trim().isEmpty()) {
                                                try {
                                                        Object responseObj = objectMapper.readValue(
                                                                        attempt.getResponseJson(), Object.class);
                                                        attemptData.put("response_data", responseObj);
                                                } catch (JsonProcessingException e) {
                                                        log.error("[LLM] Invalid JSON in responseJson for attempt: {}",
                                                                        attempt.getId(), e);
                                                        attemptData.put("response_data", null);
                                                }
                                        } else {
                                                attemptData.put("response_data", null);
                                        }

                                        attempts.add(attemptData);
                                }
                                json.put("attempts", attempts);
                                json.put("total_attempts", attempts.size());
                        } else {
                                log.warn("[LLM] No question data/attempts provided");
                        }

                        log.info("[LLM] Successfully built question raw JSON with {} fields", json.size());

                } catch (Exception e) {
                        log.error("[LLM] Error building question raw JSON for slideId: {}", slideId, e);
                        json.put("error", "Failed to build question JSON: " + e.getMessage());
                }

                return json;
        }

        /**
         * Build raw JSON for assignment submission
         */
        private Map<String, Object> buildAssignmentRawJson(
                        ActivityLog activityLog,
                        List<AssignmentSlideActivityLogDTO> assignmentData,
                        String slideId,
                        String chapterId,
                        String packageSessionId,
                        String subjectId) {
                Map<String, Object> json = new LinkedHashMap<>();

                json.put("activity_type", "assignment_submission");
                json.put("timestamp", Instant.now().toString());

                // Content metadata
                Map<String, Object> content = new LinkedHashMap<>();
                content.put("slide_id", slideId);
                content.put("slide_type", "ASSIGNMENT");
                content.put("chapter_id", chapterId);
                content.put("package_session_id", packageSessionId);
                content.put("subject_id", subjectId);

                // Fetch slide name
                Optional<Slide> slideOpt = slideRepository.findById(slideId);
                if (slideOpt.isPresent()) {
                        content.put("slide_name", slideOpt.get().getTitle());
                }

                json.put("content", content);

                return json;
        }

        /**
         * Save raw activity log specifically for assessment (no original activity log
         * reference)
         * For assessments: source_id = assessment_id
         * Data is already fully enriched by assessment_service
         */
        private void saveRawActivityLogForAssessment(
                        Map<String, Object> rawJson,
                        Map<String, Object> assessmentData) {
                try {
                        String jsonString = objectMapper.writeValueAsString(rawJson);

                        // Extract data from enriched structure
                        String userId = extractUserId(assessmentData);
                        String assessmentId = extractAssessmentId(assessmentData);
                        String attemptId = extractAttemptId(assessmentData);

                        ActivityLog llmActivityLog = new ActivityLog();
                        llmActivityLog.setId(UUID.randomUUID().toString());
                        llmActivityLog.setSourceId(assessmentId); // Link to assessment ID
                        llmActivityLog.setSourceType("llm_assessment");
                        llmActivityLog.setUserId(userId);
                        // No slide_id for assessments

                        // Set timestamps from assessment data
                        setTimestampsFromEnrichedData(llmActivityLog, assessmentData);

                        llmActivityLog.setStatus("raw");
                        llmActivityLog.setRawJson(jsonString);

                        activityLogRepository.save(llmActivityLog);

                        log.info("[LLM] Saved assessment activity log: id={}, assessmentId={}, attemptId={}, jsonLength={}",
                                        llmActivityLog.getId(), assessmentId, attemptId, jsonString.length());

                } catch (JsonProcessingException e) {
                        log.error("[LLM] Error serializing assessment raw JSON", e);
                        throw new RuntimeException("Failed to serialize assessment raw JSON", e);
                } catch (Exception e) {
                        log.error("[LLM] Error saving assessment activity log", e);
                        throw new RuntimeException("Failed to save assessment activity log", e);
                }
        }

        /**
         * Extract user ID from enriched assessment data
         */
        @SuppressWarnings("unchecked")
        private String extractUserId(Map<String, Object> assessmentData) {
                // Try new structure first (attempt.user_id)
                if (assessmentData.containsKey("attempt")) {
                        Map<String, Object> attempt = (Map<String, Object>) assessmentData.get("attempt");
                        if (attempt != null && attempt.containsKey("user_id")) {
                                return (String) attempt.get("user_id");
                        }
                }
                // Fallback to old structure
                return (String) assessmentData.get("userId");
        }

        /**
         * Extract assessment ID from enriched assessment data
         */
        @SuppressWarnings("unchecked")
        private String extractAssessmentId(Map<String, Object> assessmentData) {
                // Try new structure first (assessment.id)
                if (assessmentData.containsKey("assessment")) {
                        Map<String, Object> assessment = (Map<String, Object>) assessmentData.get("assessment");
                        if (assessment != null && assessment.containsKey("id")) {
                                return (String) assessment.get("id");
                        }
                }
                // Fallback to old structure
                return (String) assessmentData.get("assessmentId");
        }

        /**
         * Extract attempt ID from enriched assessment data
         */
        @SuppressWarnings("unchecked")
        private String extractAttemptId(Map<String, Object> assessmentData) {
                // Try new structure first (attempt.id)
                if (assessmentData.containsKey("attempt")) {
                        Map<String, Object> attempt = (Map<String, Object>) assessmentData.get("attempt");
                        if (attempt != null && attempt.containsKey("id")) {
                                return (String) attempt.get("id");
                        }
                }
                // Fallback to old structure
                return (String) assessmentData.get("attemptId");
        }

        /**
         * Set timestamps from enriched assessment data
         */
        @SuppressWarnings("unchecked")
        private void setTimestampsFromEnrichedData(ActivityLog log, Map<String, Object> assessmentData) {
                try {
                        // Try new structure first (attempt.start_time, attempt.end_time)
                        if (assessmentData.containsKey("attempt")) {
                                Map<String, Object> attempt = (Map<String, Object>) assessmentData.get("attempt");
                                if (attempt != null) {
                                        Object startTime = attempt.get("start_time");
                                        Object endTime = attempt.get("end_time");

                                        if (startTime != null) {
                                                log.setStartTime(Timestamp.from(Instant.parse(startTime.toString())));
                                        }
                                        if (endTime != null) {
                                                log.setEndTime(Timestamp.from(Instant.parse(endTime.toString())));
                                        }
                                        return;
                                }
                        }

                        // Fallback to old structure
                        Object startTime = assessmentData.get("startTime");
                        Object endTime = assessmentData.get("endTime");

                        if (startTime != null) {
                                log.setStartTime(Timestamp.from(Instant.parse(startTime.toString())));
                        }
                        if (endTime != null) {
                                log.setEndTime(Timestamp.from(Instant.parse(endTime.toString())));
                        }
                } catch (Exception e) {
                        this.log.warn("[LLM] Error parsing timestamps from assessment data", e);
                }
        }

        /**
         * Save raw activity log to database
         * For slides: source_id = slide_id
         */
        private void saveRawActivityLog(
                        String sourceType,
                        ActivityLog originalActivityLog,
                        Map<String, Object> rawJson) {
                try {
                        String jsonString = objectMapper.writeValueAsString(rawJson);

                        ActivityLog llmActivityLog = new ActivityLog();
                        llmActivityLog.setId(UUID.randomUUID().toString());
                        llmActivityLog.setSourceId(originalActivityLog.getSlideId()); // Link to slide ID (not activity
                                                                                      // log ID)
                        llmActivityLog.setSourceType(sourceType);
                        llmActivityLog.setUserId(originalActivityLog.getUserId());
                        llmActivityLog.setSlideId(originalActivityLog.getSlideId());
                        llmActivityLog.setStartTime(originalActivityLog.getStartTime());
                        llmActivityLog.setEndTime(originalActivityLog.getEndTime());
                        llmActivityLog.setStatus("raw");
                        llmActivityLog.setRawJson(jsonString);

                        activityLogRepository.save(llmActivityLog);

                        log.info("[LLM] Saved raw activity log: id={}, sourceType={}, sourceId={}, jsonLength={}",
                                        llmActivityLog.getId(), sourceType, llmActivityLog.getSourceId(),
                                        jsonString.length());

                } catch (JsonProcessingException e) {
                        log.error("[LLM] Error serializing raw JSON", e);
                        throw new RuntimeException("Failed to serialize raw JSON", e);
                }
        }
}
