package vacademy.io.admin_core_service.features.learner_offline.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_tracking.dto.QuestionSlideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.QuizSideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.util.AutoEvaluationScorer;
import vacademy.io.admin_core_service.features.slide.entity.Option;
import vacademy.io.admin_core_service.features.slide.entity.QuestionSlide;
import vacademy.io.admin_core_service.features.slide.entity.QuizSlideQuestion;
import vacademy.io.admin_core_service.features.slide.entity.Slide;
import vacademy.io.admin_core_service.features.slide.entity.QuizSlideQuestionOption;
import vacademy.io.admin_core_service.features.slide.repository.QuestionSlideRepository;
import vacademy.io.admin_core_service.features.slide.repository.QuizSlideQuestionOptionRepository;
import vacademy.io.admin_core_service.features.slide.repository.QuizSlideQuestionRepository;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;

import java.util.List;
import java.util.function.Supplier;

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
 * <p>The comparison itself lives in {@link AutoEvaluationScorer}, shared with the
 * online submit path so offline replay and a live submission grade identically.
 * Non-MCQ question types (free text, etc.) or a response_json the scorer can't
 * confidently parse are dispatched as-is with no discrepancy row, per plan.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OfflineQuizRescoringService {

    private final QuizSlideQuestionRepository quizSlideQuestionRepository;
    private final QuizSlideQuestionOptionRepository quizSlideQuestionOptionRepository;
    private final QuestionSlideRepository questionSlideRepository;
    private final SlideRepository slideRepository;
    private final AutoEvaluationScorer autoEvaluationScorer;

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
                    item.getResponseStatus(), item::setResponseStatus,
                    () -> quizSlideQuestionOptionRepository.findByQuizSlideQuestionId(question.getId())
                            .stream().map(QuizSlideQuestionOption::getId).toList(),
                    discrepancies);
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
        // findByIdWithText, not findById: the option list is needed below for
        // index-based answer keys and is lazy on the entity.
        QuestionSlide question = questionSlideRepository.findByIdWithText(slide.getSourceId()).orElse(null);
        if (question == null) {
            return List.of();
        }
        List<OfflineDiscrepancyRecord> discrepancies = new java.util.ArrayList<>();
        for (QuestionSlideActivityLogDTO item : questionSlides) {
            if (item == null) {
                continue;
            }
            rescoreOne(slide.getSourceId(), question.getAutoEvaluationJson(), item.getResponseJson(),
                    item.getResponseStatus(), item::setResponseStatus,
                    () -> question.getOptions() == null ? List.<String>of()
                            : question.getOptions().stream().map(Option::getId).toList(),
                    discrepancies);
        }
        return discrepancies;
    }

    private void rescoreOne(String questionId, String autoEvaluationJson, String responseJson,
            String clientResponseStatus, java.util.function.Consumer<String> statusSetter,
            Supplier<List<String>> optionIdsInOrder, List<OfflineDiscrepancyRecord> discrepancies) {
        AutoEvaluationScorer.Verdict verdict = autoEvaluationScorer.evaluate(autoEvaluationJson, responseJson,
                optionIdsInOrder);
        if (verdict == AutoEvaluationScorer.Verdict.UNKNOWN) {
            // Non-MCQ / unparseable: dispatch as-is, no discrepancy (per plan).
            return;
        }
        String serverStatus = verdict.name();
        if (clientResponseStatus == null || !clientResponseStatus.trim().toUpperCase().equals(serverStatus)) {
            discrepancies.add(new OfflineDiscrepancyRecord(questionId, "response_status", clientResponseStatus,
                    serverStatus));
        }
        statusSetter.accept(serverStatus);
    }

    public record OfflineDiscrepancyRecord(String questionId, String field, String clientValue, String serverValue) {
    }
}
