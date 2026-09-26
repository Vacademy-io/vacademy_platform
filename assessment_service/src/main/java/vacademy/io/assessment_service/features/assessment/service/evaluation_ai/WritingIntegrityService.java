package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.WritingIntegrityDto;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;
import vacademy.io.assessment_service.features.assessment.entity.AiQuestionEvaluation;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.repository.AiEvaluationProcessRepository;
import vacademy.io.assessment_service.features.assessment.repository.AiQuestionEvaluationRepository;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.repository.QuestionWiseMarksRepository;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * The teacher's "Writing integrity" panel for a typed answer: how it was written
 * (from the learner app's counts), how fast, how close it is to another learner's
 * answer, and the AI grader's machine-text hint.
 *
 * No detector can prove an answer was copied or machine-written, so this reports
 * evidence and conservative flags for the teacher to look at. It never changes
 * a mark and nothing here reaches the learner.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WritingIntegrityService {

    /** Composing 80+ words faster than this, over the whole time on the question, is not typing from your head. */
    static final double FAST_WPM = 60.0;
    static final int MIN_WORDS_FOR_PACE = 80;
    /** Share of the shorter answer's 5-word runs that also appear in the other one. */
    static final double HIGH_SIMILARITY = 0.6;
    static final int SHINGLE_WORDS = 5;
    static final int MIN_WORDS_FOR_SIMILARITY = 20;
    /** A long answer typed with almost no backspace reads as copied from somewhere. */
    static final int MIN_KEYSTROKES_FOR_CORRECTIONS = 200;
    static final double FEW_CORRECTIONS_RATIO = 0.01;
    /**
     * Only judged on character-by-character typing: swipe and voice keyboards put a
     * whole word in one event and rarely need a backspace, which is not copying.
     */
    static final double MAX_CHARS_PER_KEYSTROKE_FOR_CORRECTIONS = 1.5;

    private final AiEvaluationProcessRepository processRepository;
    private final AiQuestionEvaluationRepository questionEvaluationRepository;
    private final QuestionWiseMarksRepository questionWiseMarksRepository;
    private final TypedAnswerEvaluation typedAnswerEvaluation;
    private final ObjectMapper objectMapper;

    public List<WritingIntegrityDto> forProcess(String processId) {
        AiEvaluationProcess process = processRepository.findById(processId).orElse(null);
        if (process == null || process.getStudentAttempt() == null) return List.of();
        StudentAttempt attempt = process.getStudentAttempt();
        Assessment assessment = process.getAssessment() != null ? process.getAssessment()
                : attempt.getRegistration() != null ? attempt.getRegistration().getAssessment() : null;
        // An uploaded copy has no typing to report on.
        if (assessment == null || !typedAnswerEvaluation.isTypedAttempt(attempt, assessment)) return List.of();

        JsonNode allSignals = readTree(attempt.getAttemptData()).path("writingSignals");
        String ownRegistration = attempt.getRegistration() != null ? attempt.getRegistration().getId() : null;

        List<WritingIntegrityDto> out = new ArrayList<>();
        for (AiQuestionEvaluation row : questionEvaluationRepository
                .findByEvaluationProcessIdOrderByQuestionNumberAsc(processId)) {
            if (!TypedAnswerEvaluation.isAiGraded(row.getQuestion())) continue;
            String questionId = row.getQuestion().getId();
            QuestionWiseMarks marks = questionWiseMarksRepository
                    .findByStudentAttemptIdAndQuestionId(attempt.getId(), questionId).orElse(null);
            String answer = plainText(typedAnswerEvaluation.typedAnswer(marks));
            JsonNode signals = allSignals.path(questionId);
            JsonNode aiStyle = readTree(row.getEvaluationResultJson()).path("ai_style");
            out.add(build(questionId, row.getQuestionNumber(), answer,
                    marks != null ? marks.getTimeTakenInSeconds() : null,
                    signals.isObject() ? signals : null,
                    aiStyle.isObject() ? aiStyle : null,
                    closestPeer(assessment.getId(), questionId, ownRegistration, answer)));
        }
        return out;
    }

    record Peer(String participantName, double similarity) {
    }

    WritingIntegrityDto build(String questionId, Integer questionNumber, String answer, Long timeTakenSeconds,
                              JsonNode signals, JsonNode aiStyle, Peer peer) {
        int words = words(answer).size();
        Double wpm = null;
        double minutes = timeTakenSeconds != null && timeTakenSeconds > 0 ? timeTakenSeconds / 60.0
                : signals != null && signals.path("activeMs").asLong(0) > 0 ? signals.path("activeMs").asLong() / 60000.0
                : 0;
        if (minutes > 0 && words > 0) {
            wpm = Math.round(words / minutes * 10) / 10.0;
        }

        List<String> flags = new ArrayList<>();
        if (wpm != null && words >= MIN_WORDS_FOR_PACE && wpm > FAST_WPM) flags.add("FAST_WRITING");
        if (signals != null) {
            if (signals.path("largeInserts").asInt(0) > 0) flags.add("LARGE_INSERTS");
            if (signals.path("blockedInjections").asInt(0) > 0) flags.add("PASTE_ATTEMPTS");
            if (signals.path("focusLosses").asInt(0) > 0) flags.add("LEFT_WINDOW");
            int keystrokes = signals.path("keystrokes").asInt(0);
            boolean charByChar = keystrokes > 0
                    && signals.path("typedChars").asDouble(0) / keystrokes <= MAX_CHARS_PER_KEYSTROKE_FOR_CORRECTIONS;
            if (words >= MIN_WORDS_FOR_PACE && keystrokes >= MIN_KEYSTROKES_FOR_CORRECTIONS && charByChar
                    && signals.path("deletions").asInt(0) < keystrokes * FEW_CORRECTIONS_RATIO) {
                flags.add("FEW_CORRECTIONS");
            }
        }
        if (peer != null && peer.similarity() >= HIGH_SIMILARITY) flags.add("HIGH_SIMILARITY");
        String aiLevel = aiStyle != null ? aiStyle.path("level").asText(null) : null;
        if ("high".equals(aiLevel)) flags.add("AI_STYLE_HIGH");

        return WritingIntegrityDto.builder()
                .questionId(questionId)
                .questionNumber(questionNumber)
                .words(words)
                .timeTakenSeconds(timeTakenSeconds)
                .wordsPerMinute(wpm)
                .signalsAvailable(signals != null)
                .signals(signals)
                .similarParticipant(peer != null ? peer.participantName() : null)
                .similarityPercent(peer != null ? Math.round(peer.similarity() * 1000) / 10.0 : null)
                .aiStyleLevel(aiLevel)
                .aiStyleReason(aiStyle != null ? aiStyle.path("reason").asText(null) : null)
                .flags(flags)
                .build();
    }

    /** The other learner whose answer overlaps this one most, or null when none share a 5-word run. */
    Peer closestPeer(String assessmentId, String questionId, String ownRegistrationId, String answer) {
        Set<String> mine = shingles(answer);
        if (mine.isEmpty()) return null;
        Peer best = null;
        for (QuestionWiseMarksRepository.PeerAnswerRow row : questionWiseMarksRepository
                .findEndedAnswersForQuestion(assessmentId, questionId)) {
            if (row.getRegistrationId() != null && row.getRegistrationId().equals(ownRegistrationId)) continue;
            double similarity = overlap(mine, shingles(plainText(answerIn(row.getResponseJson()))));
            if (similarity > 0 && (best == null || similarity > best.similarity())) {
                best = new Peer(row.getParticipantName(), similarity);
            }
        }
        return best;
    }

    static double overlap(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) return 0;
        Set<String> smaller = a.size() <= b.size() ? a : b;
        Set<String> larger = smaller == a ? b : a;
        long shared = smaller.stream().filter(larger::contains).count();
        return (double) shared / smaller.size();
    }

    static Set<String> shingles(String text) {
        List<String> words = words(text);
        Set<String> out = new HashSet<>();
        if (words.size() < MIN_WORDS_FOR_SIMILARITY) return out;
        for (int i = 0; i + SHINGLE_WORDS <= words.size(); i++) {
            out.add(String.join(" ", words.subList(i, i + SHINGLE_WORDS)));
        }
        return out;
    }

    static List<String> words(String text) {
        List<String> out = new ArrayList<>();
        if (text == null) return out;
        for (String w : text.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+")) {
            if (!w.isEmpty()) out.add(w);
        }
        return out;
    }

    static String plainText(String html) {
        if (html == null) return "";
        return html.replaceAll("<[^>]+>", " ").replace("&nbsp;", " ").replaceAll("\\s+", " ").trim();
    }

    private String answerIn(String responseJson) {
        JsonNode answer = readTree(responseJson).path("responseData").path("answer");
        return answer.isValueNode() && !answer.isNull() ? answer.asText() : null;
    }

    private JsonNode readTree(String json) {
        if (json == null || json.isBlank()) return objectMapper.missingNode();
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return objectMapper.missingNode();
        }
    }
}
