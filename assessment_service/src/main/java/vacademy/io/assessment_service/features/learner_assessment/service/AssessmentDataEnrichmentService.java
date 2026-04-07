package vacademy.io.assessment_service.features.learner_assessment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.assessment.service.HtmlBuilderService;
import vacademy.io.assessment_service.features.learner_assessment.dto.SectionComparisonDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.StudentComparisonDto;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.repository.QuestionWiseMarksRepository;
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
    private final QuestionWiseMarksRepository questionWiseMarksRepository;
    private final LearnerReportService learnerReportService;
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
            Integer totalMarks,
            String instituteId) {

        Map<String, Object> enrichedData = new HashMap<>();

        try {
            enrichedData.put("activity_type", "assessment_attempt");
            enrichedData.put("timestamp",
                    studentAttempt.getSubmitTime() != null ? studentAttempt.getSubmitTime().toInstant().toString()
                            : java.time.Instant.now().toString());

            // Assessment metadata (compact — no IDs AI doesn't need)
            Map<String, Object> assessment = new LinkedHashMap<>();
            assessment.put("name", assessmentName);
            assessment.put("type", assessmentType);
            assessment.put("total_marks", totalMarks != null ? totalMarks : 0);
            assessment.put("duration_minutes", durationMinutes != null ? durationMinutes : 0);
            enrichedData.put("assessment", assessment);

            // Attempt metadata
            Map<String, Object> attempt = new LinkedHashMap<>();
            attempt.put("user_id", studentAttempt.getRegistration().getUserId());
            attempt.put("start_time",
                    studentAttempt.getStartTime() != null ? studentAttempt.getStartTime().toInstant().toString() : null);
            attempt.put("submit_time",
                    studentAttempt.getSubmitTime() != null ? studentAttempt.getSubmitTime().toInstant().toString() : null);
            attempt.put("duration_seconds", studentAttempt.getTotalTimeInSeconds());
            attempt.put("time_limit_seconds", durationMinutes != null ? durationMinutes * 60 : 0);
            enrichedData.put("attempt", attempt);

            // Summary
            double maxScore = totalMarks != null ? totalMarks : 0;
            double scored = studentAttempt.getResultMarks() != null ? studentAttempt.getResultMarks() : 0;
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("scored_marks", scored);
            summary.put("total_marks", maxScore);
            summary.put("result_status", studentAttempt.getResultStatus());
            summary.put("percentage", maxScore > 0 ? Math.round((scored / maxScore) * 1000.0) / 10.0 : 0);
            enrichedData.put("summary", summary);

            // Comparison context (rank, percentile, class avg) — for AI comparative insights
            addComparisonContext(enrichedData, studentAttempt, assessmentId, instituteId);

            // Question-wise marks (status per question — CORRECT/INCORRECT/PARTIAL_CORRECT)
            Map<String, QuestionWiseMarks> qwmMap = buildQuestionWiseMarksMap(assessmentId, studentAttempt.getId());

            // Parse submit data and enrich with actual content + marks status
            String submitDataJson = studentAttempt.getSubmitData() != null ? studentAttempt.getSubmitData()
                    : studentAttempt.getAttemptData();

            if (submitDataJson != null) {
                List<Map<String, Object>> enrichedSections = enrichSubmitData(submitDataJson, assessmentId, qwmMap);
                enrichedData.put("sections", enrichedSections);
            }

        } catch (Exception e) {
            log.error("Error enriching assessment data", e);
            enrichedData.put("enrichmentError", e.getMessage());
        }

        return enrichedData;
    }

    /**
     * Add comparison context (rank, percentile, class stats) from buildComparisonData
     */
    private void addComparisonContext(Map<String, Object> enrichedData, StudentAttempt studentAttempt,
                                       String assessmentId, String instituteId) {
        try {
            String userId = studentAttempt.getRegistration().getUserId();
            StudentComparisonDto comparison = learnerReportService.buildComparisonData(
                    userId, assessmentId, studentAttempt.getId(), instituteId);

            if (comparison != null) {
                Map<String, Object> ctx = new LinkedHashMap<>();
                ctx.put("student_rank", comparison.getStudentRank());
                ctx.put("student_percentile", comparison.getStudentPercentile());
                ctx.put("total_participants", comparison.getTotalParticipants());
                ctx.put("class_average_marks", comparison.getAverageMarks());
                ctx.put("highest_marks", comparison.getHighestMarks());
                ctx.put("lowest_marks", comparison.getLowestMarks());
                ctx.put("student_accuracy", comparison.getStudentAccuracy());
                ctx.put("class_accuracy", comparison.getClassAccuracy());
                ctx.put("student_duration_seconds", comparison.getStudentDuration());
                ctx.put("average_duration_seconds", comparison.getAverageDuration());

                // Section-wise comparison
                if (comparison.getSectionWiseComparison() != null) {
                    List<Map<String, Object>> sectionCtx = new ArrayList<>();
                    for (SectionComparisonDto sc : comparison.getSectionWiseComparison()) {
                        Map<String, Object> s = new LinkedHashMap<>();
                        s.put("section_name", sc.getSectionName());
                        s.put("student_marks", sc.getStudentMarks());
                        s.put("section_total", sc.getSectionTotalMarks());
                        s.put("class_average", sc.getSectionAverageMarks());
                        s.put("class_highest", sc.getSectionHighestMarks());
                        s.put("student_accuracy", sc.getStudentAccuracy());
                        s.put("class_accuracy", sc.getClassAccuracy());
                        sectionCtx.add(s);
                    }
                    ctx.put("section_comparison", sectionCtx);
                }

                enrichedData.put("class_context", ctx);
            }
        } catch (Exception e) {
            log.warn("Failed to add comparison context for AI enrichment: {}", e.getMessage());
        }
    }

    /**
     * Build a map of questionId -> QuestionWiseMarks for quick lookup
     */
    private Map<String, QuestionWiseMarks> buildQuestionWiseMarksMap(String assessmentId, String attemptId) {
        Map<String, QuestionWiseMarks> map = new HashMap<>();
        try {
            List<QuestionWiseMarks> qwmList = questionWiseMarksRepository.findByStudentAttemptId(attemptId);
            for (QuestionWiseMarks qwm : qwmList) {
                if (qwm.getQuestion() != null) {
                    map.put(qwm.getQuestion().getId(), qwm);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to load question-wise marks: {}", e.getMessage());
        }
        return map;
    }

    /**
     * Parse submit data JSON and enrich with question/option text content
     */
    private List<Map<String, Object>> enrichSubmitData(String submitDataJson, String assessmentId,
                                                         Map<String, QuestionWiseMarks> qwmMap) {
        List<Map<String, Object>> enrichedSections = new ArrayList<>();

        try {
            JsonNode submitData = objectMapper.readTree(submitDataJson);
            JsonNode sectionsNode = submitData.get("sections");

            if (sectionsNode == null || !sectionsNode.isArray()) {
                return enrichedSections;
            }

            // Fetch all sections at once
            Set<String> sectionIds = new HashSet<>();
            sectionsNode.forEach(sectionNode -> sectionIds.add(sectionNode.get("sectionId").asText()));

            Map<String, Section> sectionMap = new HashMap<>();
            if (!sectionIds.isEmpty()) {
                sectionRepository.findAllById(sectionIds).forEach(section -> sectionMap.put(section.getId(), section));
            }

            for (JsonNode sectionNode : sectionsNode) {
                enrichedSections.add(enrichSection(sectionNode, sectionMap, qwmMap));
            }

        } catch (Exception e) {
            log.error("[DataEnrichment] Error parsing submit data", e);
        }

        return enrichedSections;
    }

    /**
     * Enrich a single section with metadata and questions
     */
    private Map<String, Object> enrichSection(JsonNode sectionNode, Map<String, Section> sectionMap,
                                                Map<String, QuestionWiseMarks> qwmMap) {
        Map<String, Object> enrichedSection = new LinkedHashMap<>();

        try {
            String sectionId = sectionNode.get("sectionId").asText();

            Section section = sectionMap.get(sectionId);
            if (section != null) {
                enrichedSection.put("section_name", section.getName());
                enrichedSection.put("total_marks", section.getTotalMarks());
                enrichedSection.put("cut_off_marks", section.getCutOffMarks());
                enrichedSection.put("marks_per_question", section.getMarksPerQuestion());
            }

            enrichedSection.put("time_elapsed_seconds",
                    sectionNode.has("timeElapsedInSeconds") ? sectionNode.get("timeElapsedInSeconds").asInt() : 0);

            JsonNode questionsNode = sectionNode.get("questions");
            if (questionsNode != null && questionsNode.isArray()) {
                enrichedSection.put("questions", enrichQuestions(questionsNode, qwmMap));
            }

        } catch (Exception e) {
            log.error("[DataEnrichment] Error enriching section", e);
        }

        return enrichedSection;
    }

    /**
     * Enrich questions with full text content
     */
    private List<Map<String, Object>> enrichQuestions(JsonNode questionsNode,
                                                       Map<String, QuestionWiseMarks> qwmMap) {
        List<Map<String, Object>> enrichedQuestions = new ArrayList<>();

        try {
            Set<String> questionIds = new HashSet<>();
            questionsNode.forEach(qNode -> questionIds.add(qNode.get("questionId").asText()));

            Map<String, Question> questionMap = new HashMap<>();
            if (!questionIds.isEmpty()) {
                questionRepository.findAllById(questionIds).forEach(q -> questionMap.put(q.getId(), q));
            }

            // Batch-fetch all options for these questions
            Map<String, List<Option>> optionsByQuestion = new HashMap<>();
            for (String qId : questionIds) {
                optionsByQuestion.put(qId, optionRepository.findByQuestionId(qId));
            }

            for (JsonNode questionNode : questionsNode) {
                String qId = questionNode.get("questionId").asText();
                enrichedQuestions.add(enrichQuestion(questionNode, questionMap, qwmMap, optionsByQuestion.getOrDefault(qId, List.of())));
            }

        } catch (Exception e) {
            log.error("[DataEnrichment] Error enriching questions", e);
        }

        return enrichedQuestions;
    }

    /**
     * Enrich a single question with full text and options
     */
    private Map<String, Object> enrichQuestion(JsonNode questionNode, Map<String, Question> questionMap,
                                                Map<String, QuestionWiseMarks> qwmMap, List<Option> options) {
        Map<String, Object> eq = new LinkedHashMap<>();

        try {
            String questionId = questionNode.get("questionId").asText();

            Question question = questionMap.get(questionId);
            if (question != null) {
                eq.put("question_type", question.getQuestionType());
                eq.put("difficulty", question.getDifficulty());

                // Plain text — strip HTML/KaTeX for AI readability
                if (question.getTextData() != null) {
                    eq.put("question_text", stripForAI(question.getTextData().getContent()));
                }
                if (question.getParentRichText() != null) {
                    eq.put("parent_text", stripForAI(question.getParentRichText().getContent()));
                }
                if (question.getExplanationTextData() != null) {
                    eq.put("explanation", stripForAI(question.getExplanationTextData().getContent()));
                }

                // Options as readable text (not IDs)
                if (!options.isEmpty()) {
                    List<Map<String, String>> optList = new ArrayList<>();
                    for (Option opt : options) {
                        Map<String, String> o = new LinkedHashMap<>();
                        o.put("label", opt.getText() != null ? stripForAI(opt.getText().getContent()) : "");
                        optList.add(o);
                    }
                    eq.put("options", optList);
                }
            }

            // Marks status from question_wise_marks
            QuestionWiseMarks qwm = qwmMap.get(questionId);
            if (qwm != null) {
                eq.put("status", qwm.getStatus()); // CORRECT, INCORRECT, PARTIAL_CORRECT, PENDING
                eq.put("marks_obtained", qwm.getMarks());
            }

            // Student's selected answer as readable text
            JsonNode responseData = questionNode.get("responseData");
            if (responseData != null && responseData.has("optionIds") && !options.isEmpty()) {
                List<String> selectedTexts = new ArrayList<>();
                Map<String, String> optionIdToText = new HashMap<>();
                for (Option opt : options) {
                    optionIdToText.put(opt.getId(), opt.getText() != null ? stripForAI(opt.getText().getContent()) : "");
                }
                for (JsonNode optId : responseData.get("optionIds")) {
                    String text = optionIdToText.get(optId.asText());
                    if (text != null) selectedTexts.add(text);
                }
                eq.put("student_answer", String.join(", ", selectedTexts));
            } else if (responseData != null && responseData.has("answer")) {
                eq.put("student_answer", responseData.get("answer").asText());
            }

            eq.put("time_taken_seconds",
                    questionNode.has("timeTakenInSeconds") ? questionNode.get("timeTakenInSeconds").asInt() : 0);
            eq.put("marked_for_review",
                    questionNode.has("isMarkedForReview") && questionNode.get("isMarkedForReview").asBoolean());

        } catch (Exception e) {
            log.error("[DataEnrichment] Error enriching question: {}", questionNode.get("questionId"), e);
        }

        return eq;
    }

    /**
     * Strip HTML/KaTeX markup from text to produce clean plain text for AI analysis.
     * Reuses HtmlBuilderService's proven stripping logic.
     */
    private String stripForAI(String content) {
        if (content == null || content.isEmpty()) return "";
        return HtmlBuilderService.stripHtmlTags(content);
    }
}
