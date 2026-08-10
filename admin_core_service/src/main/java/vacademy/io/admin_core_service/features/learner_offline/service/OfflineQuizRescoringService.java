package vacademy.io.admin_core_service.features.learner_offline.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_tracking.dto.QuestionSlideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.QuizSideActivityLogDTO;
import vacademy.io.admin_core_service.features.slide.entity.QuestionSlide;
import vacademy.io.admin_core_service.features.slide.entity.QuizSlideQuestion;
import vacademy.io.admin_core_service.features.slide.entity.Slide;
import vacademy.io.admin_core_service.features.slide.repository.QuestionSlideRepository;
import vacademy.io.admin_core_service.features.slide.repository.QuizSlideQuestionRepository;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Server-side re-scoring for offline QUESTION/QUIZ replay (offline plan,
 * Part A4 step 5). Quiz scoring is otherwise fully client-side (the answer
 * key ships in auto_evaluation_json so the online quiz viewer can grade
 * instantly) -- that trust model breaks for offline replay, where a modified
 * app binary or an edited local SQLite row could claim any responseStatus.
 * This recomputes correctness from auto_evaluation_json and overwrites the
 * client-claimed value before dispatch; a difference is recorded as an
 * OfflineSyncDiscrepancy for admin review.
 *
 * <p>Format note (see SlideService.remapOptionIdsInJson): quiz_slide_question
 * and question_slide both store auto_evaluation_json as the flat
 * {@code {"correctAnswers": ["optionId", ...]}} shape -- NOT the nested
 * {@code MCQEvaluationDTO} shape used by video_slide_question. Only that flat
 * shape is parsed here. Non-MCQ question types (free text, etc.) or a
 * response_json this service can't confidently parse are dispatched as-is
 * with no discrepancy row, per plan.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OfflineQuizRescoringService {

    private static final String CORRECT = "CORRECT";
    private static final String WRONG = "WRONG";

    private final QuizSlideQuestionRepository quizSlideQuestionRepository;
    private final QuestionSlideRepository questionSlideRepository;
    private final SlideRepository slideRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** One row per discrepancy field found; empty if nothing was off (or nothing was checkable). */
    public List<OfflineDiscrepancyRecord> rescoreQuiz(List<QuizSideActivityLogDTO> quizSides) {
        if (quizSides == null || quizSides.isEmpty()) {
            return List.of();
        }
        List<OfflineDiscrepancyRecord> discrepancies = new java.util.ArrayList<>();
        for (QuizSideActivityLogDTO item : quizSides) {
            if (item == null || item.getQuestionId() == null) {
                continue;
            }
            QuizSlideQuestion question = quizSlideQuestionRepository.findById(item.getQuestionId()).orElse(null);
            if (question == null) {
                continue;
            }
            rescoreOne(item.getQuestionId(), question.getAutoEvaluationJson(), item.getResponseJson(),
                    item.getResponseStatus(), item::setResponseStatus, discrepancies);
        }
        return discrepancies;
    }

    /** QUESTION slides carry a single response per slide; slideId resolves via Slide.sourceId. */
    public List<OfflineDiscrepancyRecord> rescoreQuestion(String slideId,
            List<QuestionSlideActivityLogDTO> questionSlides) {
        if (questionSlides == null || questionSlides.isEmpty() || slideId == null) {
            return List.of();
        }
        Slide slide = slideRepository.findById(slideId).orElse(null);
        if (slide == null || slide.getSourceId() == null) {
            return List.of();
        }
        QuestionSlide question = questionSlideRepository.findById(slide.getSourceId()).orElse(null);
        if (question == null) {
            return List.of();
        }
        List<OfflineDiscrepancyRecord> discrepancies = new java.util.ArrayList<>();
        for (QuestionSlideActivityLogDTO item : questionSlides) {
            if (item == null) {
                continue;
            }
            rescoreOne(slide.getSourceId(), question.getAutoEvaluationJson(), item.getResponseJson(),
                    item.getResponseStatus(), item::setResponseStatus, discrepancies);
        }
        return discrepancies;
    }

    private void rescoreOne(String questionId, String autoEvaluationJson, String responseJson,
            String clientResponseStatus, java.util.function.Consumer<String> statusSetter,
            List<OfflineDiscrepancyRecord> discrepancies) {
        Set<String> correctAnswers = extractCorrectAnswers(autoEvaluationJson);
        Set<String> selected = extractSelectedOptionIds(responseJson);
        if (correctAnswers == null || selected == null) {
            // Non-MCQ / unparseable: dispatch as-is, no discrepancy (per plan).
            return;
        }
        String serverStatus = correctAnswers.equals(selected) ? CORRECT : WRONG;
        if (clientResponseStatus == null || !normalizeStatus(clientResponseStatus).equals(serverStatus)) {
            discrepancies.add(new OfflineDiscrepancyRecord(questionId, "response_status", clientResponseStatus,
                    serverStatus));
        }
        statusSetter.accept(serverStatus);
    }

    private String normalizeStatus(String status) {
        String upper = status.trim().toUpperCase();
        return "CORRECT".equals(upper) ? CORRECT : WRONG;
    }

    @SuppressWarnings("unchecked")
    private Set<String> extractCorrectAnswers(String autoEvaluationJson) {
        if (autoEvaluationJson == null || autoEvaluationJson.isBlank()) {
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(autoEvaluationJson);
            JsonNode correctAnswers = root.get("correctAnswers");
            if (correctAnswers == null || !correctAnswers.isArray()) {
                return null;
            }
            Set<String> result = new HashSet<>();
            correctAnswers.forEach(n -> result.add(n.asText()));
            return result;
        } catch (Exception e) {
            log.warn("offline-sync: could not parse auto_evaluation_json for re-scoring: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Accepts the modern {@code {"selectedOptions":[{"id":...}]}} shape and the
     * older {@code {"selectedOptions":[{"id":...}]}} / {@code {"answer":[...]}}
     * fallbacks the quiz viewer also writes (see quiz-viewer.tsx reload path).
     * Returns null (unparseable) rather than an empty set when nothing matches,
     * so the caller skips re-scoring instead of treating "no selection" as wrong.
     */
    private Set<String> extractSelectedOptionIds(String responseJson) {
        if (responseJson == null || responseJson.isBlank()) {
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(responseJson);
            JsonNode options = root.has("selectedOptions") ? root.get("selectedOptions")
                    : root.has("selected_option_ids") ? root.get("selected_option_ids")
                    : root.has("optionIds") ? root.get("optionIds") : null;
            if (options == null || !options.isArray()) {
                return null;
            }
            Set<String> result = new HashSet<>();
            for (JsonNode n : options) {
                if (n.isObject() && n.has("id")) {
                    result.add(n.get("id").asText());
                } else if (n.isTextual() || n.isNumber()) {
                    result.add(n.asText());
                } else {
                    return null; // unrecognized shape inside the array
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("offline-sync: could not parse response_json for re-scoring: {}", e.getMessage());
            return null;
        }
    }

    public record OfflineDiscrepancyRecord(String questionId, String field, String clientValue, String serverValue) {
    }
}
