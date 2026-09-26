package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.WritingIntegrityDto;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;
import vacademy.io.assessment_service.features.assessment.entity.AiQuestionEvaluation;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentUserRegistration;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.repository.AiEvaluationProcessRepository;
import vacademy.io.assessment_service.features.assessment.repository.AiQuestionEvaluationRepository;
import vacademy.io.assessment_service.features.assessment.repository.QuestionAssessmentSectionMappingRepository;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.repository.QuestionWiseMarksRepository;
import vacademy.io.assessment_service.features.question_core.entity.Question;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The writing-integrity panel reports evidence and raises flags only on clear
 * signs; an ordinary answer, or one from an app that sent no signals, carries none.
 */
class WritingIntegrityServiceTest {

        private static final String ESSAY = "Trees give us oxygen and absorb carbon dioxide which keeps the air "
                        + "clean for everyone living in cities and villages across the whole country today";

        private final ObjectMapper json = new ObjectMapper();
        private AiEvaluationProcessRepository processes;
        private AiQuestionEvaluationRepository evaluations;
        private QuestionWiseMarksRepository marks;
        private WritingIntegrityService service;

        @BeforeEach
        void setUp() {
                processes = mock(AiEvaluationProcessRepository.class);
                evaluations = mock(AiQuestionEvaluationRepository.class);
                marks = mock(QuestionWiseMarksRepository.class);
                QuestionAssessmentSectionMappingRepository mappings = mock(QuestionAssessmentSectionMappingRepository.class);
                TypedAnswerEvaluation typed = new TypedAnswerEvaluation(
                                new EvaluationUtilityService(json, mappings), mappings, marks, json);
                service = new WritingIntegrityService(processes, evaluations, marks, typed, json);
        }

        private JsonNode node(String raw) throws Exception {
                return json.readTree(raw);
        }

        private static String words(int n) {
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < n; i++) sb.append("word").append(i).append(' ');
                return sb.toString().trim();
        }

        @Test
        void anOrdinaryAnswerRaisesNoFlags() throws Exception {
                WritingIntegrityDto dto = service.build("q1", 1, words(150), 600L,
                                node("{\"keystrokes\":900,\"deletions\":60,\"largeInserts\":0,"
                                                + "\"blockedInjections\":0,\"focusLosses\":0}"),
                                node("{\"level\":\"low\",\"reason\":\"own voice\"}"), null);
                assertThat(dto.getWords()).isEqualTo(150);
                assertThat(dto.getWordsPerMinute()).isEqualTo(15.0);
                assertThat(dto.isSignalsAvailable()).isTrue();
                assertThat(dto.getFlags()).isEmpty();
        }

        @Test
        void clearSignsAreFlagged() throws Exception {
                WritingIntegrityDto dto = service.build("q1", 1, words(250), 180L,
                                node("{\"keystrokes\":1200,\"typedChars\":1250,\"deletions\":3,\"largeInserts\":2,"
                                                + "\"blockedInjections\":1,\"focusLosses\":2}"),
                                node("{\"level\":\"high\",\"reason\":\"generic\"}"),
                                new WritingIntegrityService.Peer("Rahul", 0.78));
                assertThat(dto.getFlags()).containsExactly("FAST_WRITING", "LARGE_INSERTS", "PASTE_ATTEMPTS",
                                "LEFT_WINDOW", "FEW_CORRECTIONS", "HIGH_SIMILARITY", "AI_STYLE_HIGH");
                assertThat(dto.getSimilarParticipant()).isEqualTo("Rahul");
                assertThat(dto.getSimilarityPercent()).isEqualTo(78.0);
        }

        @Test
        void swipeOrVoiceTypingWithFewBackspacesIsNotFlagged() throws Exception {
                // 250 words, one word per input event, 1 correction: a mobile keyboard, not copying.
                WritingIntegrityDto dto = service.build("q1", 1, words(250), 900L,
                                node("{\"keystrokes\":250,\"typedChars\":1500,\"deletions\":1}"), null, null);
                assertThat(dto.getFlags()).doesNotContain("FEW_CORRECTIONS");
        }

        @Test
        void anAnswerFromAnOlderAppShowsNoSignalsAndNoSignalFlags() {
                WritingIntegrityDto dto = service.build("q1", 1, words(100), 900L, null, null, null);
                assertThat(dto.isSignalsAvailable()).isFalse();
                assertThat(dto.getFlags()).isEmpty();
        }

        @Test
        void similarityIsTheSharedShareOfTheShorterAnswer() {
                var essay = WritingIntegrityService.shingles(ESSAY);
                var copied = WritingIntegrityService.shingles("Intro line here. " + ESSAY + " and a new ending line");
                var other = WritingIntegrityService.shingles(words(40));
                assertThat(WritingIntegrityService.overlap(essay, copied)).isEqualTo(1.0);
                assertThat(WritingIntegrityService.overlap(essay, other)).isZero();
                assertThat(WritingIntegrityService.shingles("too short to compare")).isEmpty();
        }

        @Test
        void aProcessReportsItsTypedWrittenAnswersWithTheClosestOtherLearner() {
                Assessment assessment = new Assessment();
                assessment.setId("a1");
                assessment.setEvaluationType("AUTO");
                AssessmentUserRegistration registration = new AssessmentUserRegistration();
                registration.setId("reg-me");
                registration.setAssessment(assessment);
                StudentAttempt attempt = new StudentAttempt();
                attempt.setId("att-1");
                attempt.setRegistration(registration);
                attempt.setAttemptData("{\"sections\":[],\"writingSignals\":{\"q1\":{\"keystrokes\":300,\"deletions\":20}}}");
                AiEvaluationProcess process = new AiEvaluationProcess();
                process.setId("p1");
                process.setStudentAttempt(attempt);
                process.setAssessment(assessment);
                when(processes.findById("p1")).thenReturn(Optional.of(process));

                Question q = new Question();
                q.setId("q1");
                q.setQuestionType("LONG_ANSWER");
                Question mcq = new Question();
                mcq.setId("mcq");
                mcq.setQuestionType("MCQS");
                when(evaluations.findByEvaluationProcessIdOrderByQuestionNumberAsc("p1")).thenReturn(List.of(
                                AiQuestionEvaluation.builder().question(q).questionNumber(1)
                                                .evaluationResultJson("{\"ai_style\":{\"level\":\"medium\",\"reason\":\"x\"}}").build(),
                                AiQuestionEvaluation.builder().question(mcq).questionNumber(2).build()));
                String response = "{\"responseData\":{\"type\":\"LONG_ANSWER\",\"answer\":\"" + ESSAY + "\"}}";
                when(marks.findByStudentAttemptIdAndQuestionId("att-1", "q1")).thenReturn(Optional.of(
                                QuestionWiseMarks.builder().responseJson(response).timeTakenInSeconds(300L).build()));
                QuestionWiseMarksRepository.PeerAnswerRow me = peer("reg-me", "Me", response);
                QuestionWiseMarksRepository.PeerAnswerRow rahul = peer("reg-2", "Rahul", response);
                when(marks.findEndedAnswersForQuestion("a1", "q1")).thenReturn(List.of(me, rahul));

                List<WritingIntegrityDto> result = service.forProcess("p1");

                assertThat(result).hasSize(1);
                WritingIntegrityDto dto = result.get(0);
                assertThat(dto.getQuestionId()).isEqualTo("q1");
                assertThat(dto.getSimilarParticipant()).isEqualTo("Rahul");
                assertThat(dto.getAiStyleLevel()).isEqualTo("medium");
                assertThat(dto.getSignals().path("keystrokes").asInt()).isEqualTo(300);
                assertThat(dto.getFlags()).containsExactly("HIGH_SIMILARITY");
        }

        @Test
        void anUploadedCopyHasNothingToReport() {
                Assessment assessment = new Assessment();
                assessment.setId("a1");
                StudentAttempt attempt = new StudentAttempt();
                attempt.setId("att-1");
                attempt.setAttemptData("{\"fileId\":\"f1\"}");
                AiEvaluationProcess process = new AiEvaluationProcess();
                process.setStudentAttempt(attempt);
                process.setAssessment(assessment);
                when(processes.findById("p1")).thenReturn(Optional.of(process));
                assertThat(service.forProcess("p1")).isEmpty();
        }

        private static QuestionWiseMarksRepository.PeerAnswerRow peer(String registrationId, String name, String response) {
                return new QuestionWiseMarksRepository.PeerAnswerRow() {
                        public String getAttemptId() {
                                return "att-" + registrationId;
                        }

                        public String getRegistrationId() {
                                return registrationId;
                        }

                        public String getParticipantName() {
                                return name;
                        }

                        public String getResponseJson() {
                                return response;
                        }
                };
        }
}
