package vacademy.io.assessment_service.features.learner_assessment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.question_core.entity.Option;
import vacademy.io.assessment_service.features.question_core.entity.Question;
import vacademy.io.assessment_service.features.question_core.repository.OptionRepository;
import vacademy.io.assessment_service.features.question_core.repository.QuestionRepository;

import java.util.*;

/**
 * Service to enrich assessment data with actual text content instead of just
 * IDs
 * This makes the data more useful for LLM processing
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AssessmentDataEnrichmentService {

    private final QuestionRepository questionRepository;
    private final OptionRepository optionRepository;
    private final SectionRepository sectionRepository;
    private final ObjectMapper objectMapper;

    /**
     * Build enriched assessment data with full text content for LLM analysis
     */
    public Map<String, Object> buildEnrichedAssessmentData(
            StudentAttempt studentAttempt,
            String assessmentId,
            String assessmentName,
            String assessmentType,
            Integer durationMinutes,
            Integer totalMarks) {

        Map<String, Object> enrichedData = new HashMap<>();

        try {
            // Activity type and timestamp (for LLM processing alignment)
            enrichedData.put("activity_type", "assessment_attempt");
            enrichedData.put("timestamp",
                    studentAttempt.getSubmitTime() != null ? studentAttempt.getSubmitTime().toInstant().toString()
                            : java.time.Instant.now().toString());

            // Assessment metadata
            Map<String, Object> assessment = new HashMap<>();
            assessment.put("id", assessmentId);
            assessment.put("name", assessmentName);
            assessment.put("type", assessmentType);
            assessment.put("total_marks", totalMarks != null ? totalMarks : 0);
            assessment.put("duration_minutes", durationMinutes != null ? durationMinutes : 0);
            enrichedData.put("assessment", assessment);

            // Attempt metadata
            Map<String, Object> attempt = new HashMap<>();
            attempt.put("id", studentAttempt.getId());
            attempt.put("number", studentAttempt.getAttemptNumber());
            attempt.put("user_id", studentAttempt.getRegistration().getUserId());
            attempt.put("start_time",
                    studentAttempt.getStartTime() != null ? studentAttempt.getStartTime().toInstant().toString()
                            : null);
            attempt.put("end_time",
                    studentAttempt.getSubmitTime() != null ? studentAttempt.getSubmitTime().toInstant().toString()
                            : null);
            attempt.put("submit_time",
                    studentAttempt.getSubmitTime() != null ? studentAttempt.getSubmitTime().toInstant().toString()
                            : null);
            attempt.put("duration_seconds", studentAttempt.getTotalTimeInSeconds());
            attempt.put("time_limit_seconds", durationMinutes != null ? durationMinutes * 60 : 0);
            enrichedData.put("attempt", attempt);

            enrichedData.put("attempt", attempt);

            // Summary/Results
            Map<String, Object> summary = new HashMap<>();
            summary.put("total_score", studentAttempt.getResultMarks());
            summary.put("max_score", totalMarks != null ? totalMarks : 0);
            summary.put("scored_marks", studentAttempt.getResultMarks());
            summary.put("total_marks", studentAttempt.getTotalMarks());
            summary.put("result_status", studentAttempt.getResultStatus());
            summary.put("percentage",
                    totalMarks != null && totalMarks > 0 ? (studentAttempt.getResultMarks() / totalMarks) * 100 : 0);
            enrichedData.put("summary", summary);

            // Parse submit data and enrich with actual content
            String submitDataJson = studentAttempt.getSubmitData() != null ? studentAttempt.getSubmitData()
                    : studentAttempt.getAttemptData();

            if (submitDataJson != null) {
                List<Map<String, Object>> enrichedSections = enrichSubmitData(submitDataJson, assessmentId);
                enrichedData.put("sections", enrichedSections);
            }

        } catch (Exception e) {
            log.error("Error enriching assessment data", e);
            enrichedData.put("enrichmentError", e.getMessage());
        }

        return enrichedData;
    }

    /**
     * Parse submit data JSON and enrich with question/option text content
     */
    private List<Map<String, Object>> enrichSubmitData(String submitDataJson, String assessmentId) {
        List<Map<String, Object>> enrichedSections = new ArrayList<>();

        try {
            JsonNode submitData = objectMapper.readTree(submitDataJson);
            JsonNode sectionsNode = submitData.get("sections");

            if (sectionsNode == null || !sectionsNode.isArray()) {
                return enrichedSections;
            }

            // Get all section IDs first
            Set<String> sectionIds = new HashSet<>();
            sectionsNode.forEach(sectionNode -> {
                String sectionId = sectionNode.get("sectionId").asText();
                sectionIds.add(sectionId);
            });

            // Fetch all sections at once
            Map<String, Section> sectionMap = new HashMap<>();
            if (!sectionIds.isEmpty()) {
                Iterable<Section> sectionsIterable = sectionRepository.findAllById(sectionIds);
                sectionsIterable.forEach(section -> sectionMap.put(section.getId(), section));
            }

            // Process each section
            for (JsonNode sectionNode : sectionsNode) {
                Map<String, Object> enrichedSection = enrichSection(sectionNode, sectionMap);
                enrichedSections.add(enrichedSection);
            }

        } catch (Exception e) {
            log.error("[DataEnrichment] Error parsing submit data", e);
        }

        return enrichedSections;
    }

    /**
     * Enrich a single section with metadata and questions
     */
    private Map<String, Object> enrichSection(JsonNode sectionNode, Map<String, Section> sectionMap) {
        Map<String, Object> enrichedSection = new HashMap<>();

        try {
            String sectionId = sectionNode.get("sectionId").asText();
            enrichedSection.put("sectionId", sectionId);

            // Get section metadata from database
            Section section = sectionMap.get(sectionId);
            if (section != null) {
                enrichedSection.put("sectionName", section.getName());
                enrichedSection.put("sectionType", section.getSectionType());
                enrichedSection.put("totalMarks", section.getTotalMarks());
                enrichedSection.put("cutOffMarks", section.getCutOffMarks());
                enrichedSection.put("marksPerQuestion", section.getMarksPerQuestion());

                if (section.getDescription() != null) {
                    enrichedSection.put("description", section.getDescription().getContent());
                }
            }

            // Time metadata
            enrichedSection.put("sectionDurationLeftInSeconds",
                    sectionNode.has("sectionDurationLeftInSeconds")
                            ? sectionNode.get("sectionDurationLeftInSeconds").asInt()
                            : 0);
            enrichedSection.put("timeElapsedInSeconds",
                    sectionNode.has("timeElapsedInSeconds") ? sectionNode.get("timeElapsedInSeconds").asInt() : 0);

            // Process questions
            JsonNode questionsNode = sectionNode.get("questions");
            if (questionsNode != null && questionsNode.isArray()) {
                List<Map<String, Object>> enrichedQuestions = enrichQuestions(questionsNode);
                enrichedSection.put("questions", enrichedQuestions);
            }

        } catch (Exception e) {
            log.error("[DataEnrichment] Error enriching section", e);
            enrichedSection.put("error", e.getMessage());
        }

        return enrichedSection;
    }

    /**
     * Enrich questions with full text content
     */
    private List<Map<String, Object>> enrichQuestions(JsonNode questionsNode) {
        List<Map<String, Object>> enrichedQuestions = new ArrayList<>();

        try {
            // Collect all question IDs
            Set<String> questionIds = new HashSet<>();
            questionsNode.forEach(qNode -> {
                String questionId = qNode.get("questionId").asText();
                questionIds.add(questionId);
            });

            // Fetch all questions at once
            Map<String, Question> questionMap = new HashMap<>();
            if (!questionIds.isEmpty()) {
                Iterable<Question> questionsIterable = questionRepository.findAllById(questionIds);
                questionsIterable.forEach(q -> questionMap.put(q.getId(), q));
            }

            // Process each question
            for (JsonNode questionNode : questionsNode) {
                Map<String, Object> enrichedQuestion = enrichQuestion(questionNode, questionMap);
                enrichedQuestions.add(enrichedQuestion);
            }

        } catch (Exception e) {
            log.error("[DataEnrichment] Error enriching questions", e);
        }

        return enrichedQuestions;
    }

    /**
     * Enrich a single question with full text and options
     */
    private Map<String, Object> enrichQuestion(JsonNode questionNode, Map<String, Question> questionMap) {
        Map<String, Object> enrichedQuestion = new HashMap<>();

        try {
            String questionId = questionNode.get("questionId").asText();
            enrichedQuestion.put("questionId", questionId);

            // Get question from database
            Question question = questionMap.get(questionId);
            if (question != null) {
                // Question metadata
                enrichedQuestion.put("questionType", question.getQuestionType());
                enrichedQuestion.put("questionResponseType", question.getQuestionResponseType());
                enrichedQuestion.put("difficulty", question.getDifficulty());
                enrichedQuestion.put("evaluationType", question.getEvaluationType());

                // Question text content
                if (question.getTextData() != null) {
                    enrichedQuestion.put("questionText", question.getTextData().getContent());
                    enrichedQuestion.put("questionTextType", question.getTextData().getType());
                }

                // Parent text if exists
                if (question.getParentRichText() != null) {
                    enrichedQuestion.put("parentText", question.getParentRichText().getContent());
                }

                // Explanation text
                if (question.getExplanationTextData() != null) {
                    enrichedQuestion.put("explanationText", question.getExplanationTextData().getContent());
                }

                // Auto evaluation JSON (contains correct answers)
                enrichedQuestion.put("autoEvaluationJson", question.getAutoEvaluationJson());

                // Fetch and enrich options
                List<Map<String, Object>> enrichedOptions = enrichOptions(questionId);
                if (!enrichedOptions.isEmpty()) {
                    enrichedQuestion.put("options", enrichedOptions);
                }
            }

            // Student's response data
            JsonNode responseData = questionNode.get("responseData");
            if (responseData != null) {
                enrichedQuestion.put("studentResponse", objectMapper.writeValueAsString(responseData));

                // Add specific response fields
                if (responseData.has("type")) {
                    enrichedQuestion.put("responseType", responseData.get("type").asText());
                }
                if (responseData.has("optionIds")) {
                    enrichedQuestion.put("selectedOptionIds", responseData.get("optionIds"));
                }
                if (responseData.has("answer")) {
                    enrichedQuestion.put("studentAnswer", responseData.get("answer").asText());
                }
            }

            // Time taken
            enrichedQuestion.put("timeTakenInSeconds",
                    questionNode.has("timeTakenInSeconds") ? questionNode.get("timeTakenInSeconds").asInt() : 0);
            enrichedQuestion.put("isMarkedForReview",
                    questionNode.has("isMarkedForReview") &&
                            questionNode.get("isMarkedForReview").asBoolean());
            enrichedQuestion.put("isVisited",
                    questionNode.has("isVisited") &&
                            questionNode.get("isVisited").asBoolean());

        } catch (Exception e) {
            log.error("[DataEnrichment] Error enriching question: {}", questionNode.get("questionId"), e);
            enrichedQuestion.put("error", e.getMessage());
        }

        return enrichedQuestion;
    }

    /**
     * Fetch and enrich options for a question
     */
    private List<Map<String, Object>> enrichOptions(String questionId) {
        List<Map<String, Object>> enrichedOptions = new ArrayList<>();

        try {
            List<Option> options = optionRepository.findByQuestionId(questionId);

            for (Option option : options) {
                Map<String, Object> enrichedOption = new HashMap<>();
                enrichedOption.put("optionId", option.getId());

                // Option text content
                if (option.getText() != null) {
                    enrichedOption.put("optionText", option.getText().getContent());
                    enrichedOption.put("optionTextType", option.getText().getType());
                }

                // Explanation
                if (option.getExplanationTextData() != null) {
                    enrichedOption.put("explanationText", option.getExplanationTextData().getContent());
                }

                enrichedOption.put("mediaId", option.getMediaId());
                enrichedOptions.add(enrichedOption);
            }

        } catch (Exception e) {
            log.error("[DataEnrichment] Error enriching options for question: {}", questionId, e);
        }

        return enrichedOptions;
    }
}
