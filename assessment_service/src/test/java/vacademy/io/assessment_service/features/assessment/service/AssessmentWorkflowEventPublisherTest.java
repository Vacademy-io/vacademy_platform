package vacademy.io.assessment_service.features.assessment.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentUserRegistration;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.learner_assessment.enums.AssessmentAttemptEnum;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Behavioural tests for the assessment trigger emits.
 *
 * <p>These lock in decisions that are invisible in the type system and were each got wrong
 * once during development — the kind a future edit can silently undo:
 * <ul>
 *   <li>learner-scoped events fan out ONE emit per learner, not one per assessment (an
 *       assessment-level emit would make a reminder unusable, since the engine's SpEL cannot
 *       iterate a list to find the recipient);</li>
 *   <li>{@code attemptsRemaining} is the allowance NET of attempts already taken, not the raw
 *       allowance;</li>
 *   <li>{@code minutesToStart} is this assessment's countdown, not the sweep's look-ahead
 *       window;</li>
 *   <li>a trigger failure never propagates into the assessment flow that caused it.</li>
 * </ul>
 *
 * <p>The real {@link AssessmentTriggerContextBuilder} is used rather than a mock, so these
 * also assert the context an admin actually receives.
 */
class AssessmentWorkflowEventPublisherTest {

    private AssessmentWorkflowEventPublisher publisher;
    private WorkflowTriggerClient client;
    private SectionRepository sectionRepository;

    private static final String INSTITUTE = "inst-1";
    private static final String ASSESSMENT_ID = "asmt-1";

    @BeforeEach
    void setUp() {
        client = mock(WorkflowTriggerClient.class);
        sectionRepository = mock(SectionRepository.class);
        publisher = new AssessmentWorkflowEventPublisher();
        publisher.workflowTriggerClient = client;
        publisher.contextBuilder = new AssessmentTriggerContextBuilder();
        publisher.sectionRepository = sectionRepository;
    }

    // ------------------------------------------------------------------ fixtures

    private Assessment assessment() {
        Assessment assessment = new Assessment();
        assessment.setId(ASSESSMENT_ID);
        assessment.setName("Physics Unit Test");
        assessment.setAssessmentType("EXAM");
        assessment.setStatus("PUBLISHED");
        assessment.setDuration(60);
        assessment.setBatchRegistrations(new HashSet<>());
        return assessment;
    }

    private AssessmentUserRegistration registration(String id, String userId, Assessment assessment) {
        AssessmentUserRegistration registration = new AssessmentUserRegistration();
        registration.setId(id);
        registration.setUserId(userId);
        registration.setInstituteId(INSTITUTE);
        registration.setAssessment(assessment);
        registration.setParticipantName("Learner " + userId);
        registration.setUserEmail(userId + "@example.com");
        registration.setStudentAttempts(new HashSet<>());
        return registration;
    }

    private StudentAttempt attempt(String id, AssessmentUserRegistration registration) {
        StudentAttempt attempt = new StudentAttempt();
        attempt.setId(id);
        attempt.setRegistration(registration);
        attempt.setStatus(AssessmentAttemptEnum.ENDED.name());
        attempt.setAttemptNumber(1);
        return attempt;
    }

    private Section section(String id, Double totalMarks) {
        Section section = new Section();
        section.setId(id);
        section.setTotalMarks(totalMarks);
        return section;
    }

    /** All contexts emitted, in order. */
    private List<Map<String, Object>> capturedContexts() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> ctx = ArgumentCaptor.forClass(Map.class);
        verify(client, org.mockito.Mockito.atLeastOnce())
                .triggerEvent(anyString(), anyString(), anyString(), ctx.capture());
        return ctx.getAllValues();
    }

    private List<String> capturedEventNames() {
        ArgumentCaptor<String> name = ArgumentCaptor.forClass(String.class);
        verify(client, org.mockito.Mockito.atLeastOnce())
                .triggerEvent(name.capture(), anyString(), anyString(), any());
        return name.getAllValues();
    }

    // ------------------------------------------------------------------ ASSESSMENT_END

    @Test
    void assessmentEnd_carriesTheEndSourceItWasGiven() {
        Assessment assessment = assessment();
        publisher.publishAssessmentEnd(attempt("att-1", registration("reg-1", "user-1", assessment)), "TIME_EXPIRED");

        assertThat(capturedEventNames()).containsExactly("ASSESSMENT_END");
        assertThat(capturedContexts().get(0))
                .containsEntry("endSource", "TIME_EXPIRED")
                .containsEntry("attemptId", "att-1")
                .containsEntry("userId", "user-1");
    }

    @Test
    void assessmentEnd_isSkippedWhenTheAttemptHasNoResolvableInstitute() {
        Assessment assessment = assessment();
        AssessmentUserRegistration registration = registration("reg-1", "user-1", assessment);
        registration.setInstituteId(null);

        publisher.publishAssessmentEnd(attempt("att-1", registration), "SUBMITTED");

        // No institute means no workflow can be matched — emitting would be noise.
        verify(client, times(0)).triggerEvent(anyString(), anyString(), anyString(), any());
    }

    @Test
    void aTriggerFailureNeverPropagatesToTheAssessmentFlow() {
        doThrow(new RuntimeException("admin-core unreachable"))
                .when(client).triggerEvent(anyString(), anyString(), anyString(), any());

        Assessment assessment = assessment();
        // Must not throw — the caller is mid-submission.
        publisher.publishAssessmentEnd(attempt("att-1", registration("reg-1", "user-1", assessment)), "SUBMITTED");
    }

    // ------------------------------------------------------------------ RESULT_RELEASED

    @Test
    void resultReleased_computesPercentageFromTheAssessmentsSectionMarks() {
        Assessment assessment = assessment();
        when(sectionRepository.findByAssessmentIdAndStatusNotIn(anyString(), anyList()))
                .thenReturn(List.of(section("s1", 30.0), section("s2", 20.0)));

        StudentAttempt attempt = attempt("att-1", registration("reg-1", "user-1", assessment));
        attempt.setResultMarks(25.0);

        publisher.publishResultReleased(attempt, null, null);

        assertThat(capturedContexts().get(0))
                .containsEntry("marks", 25.0)
                .containsEntry("totalMarks", 50.0)
                .containsEntry("percentage", 50.0);
    }

    @Test
    void resultReleasedBatch_emitsOncePerLearner() {
        Assessment assessment = assessment();
        when(sectionRepository.findByAssessmentIdAndStatusNotIn(anyString(), anyList()))
                .thenReturn(List.of(section("s1", 10.0)));

        List<StudentAttempt> attempts = List.of(
                attempt("att-1", registration("reg-1", "user-1", assessment)),
                attempt("att-2", registration("reg-2", "user-2", assessment)),
                attempt("att-3", registration("reg-3", "user-3", assessment)));

        publisher.publishResultReleased(attempts);

        assertThat(capturedContexts()).hasSize(3);
        assertThat(capturedContexts()).extracting(c -> c.get("userId"))
                .containsExactly("user-1", "user-2", "user-3");
    }

    @Test
    void resultReleasedBatch_resolvesSectionMarksOncePerAssessmentNotPerLearner() {
        Assessment assessment = assessment();
        when(sectionRepository.findByAssessmentIdAndStatusNotIn(anyString(), anyList()))
                .thenReturn(List.of(section("s1", 10.0)));

        publisher.publishResultReleased(List.of(
                attempt("att-1", registration("reg-1", "user-1", assessment)),
                attempt("att-2", registration("reg-2", "user-2", assessment)),
                attempt("att-3", registration("reg-3", "user-3", assessment))));

        verify(sectionRepository, times(1)).findByAssessmentIdAndStatusNotIn(anyString(), anyList());
    }

    @Test
    void resultReleasedBatch_doesNotRequeryWhenAnAssessmentHasNoSections() {
        Assessment assessment = assessment();
        // Null total is a legitimate answer; it must still be cached, or the batch degrades
        // into one section query per learner.
        when(sectionRepository.findByAssessmentIdAndStatusNotIn(anyString(), anyList()))
                .thenReturn(List.of());

        publisher.publishResultReleased(List.of(
                attempt("att-1", registration("reg-1", "user-1", assessment)),
                attempt("att-2", registration("reg-2", "user-2", assessment))));

        verify(sectionRepository, times(1)).findByAssessmentIdAndStatusNotIn(anyString(), anyList());
    }

    // ------------------------------------------------------------------ REMINDER

    @Test
    void reminder_emitsOncePerRegisteredLearner() {
        Assessment assessment = assessment();
        assessment.setBoundStartTime(new Date(System.currentTimeMillis() + 10 * 60_000L));

        publisher.publishReminderBeforeStart(assessment, List.of(
                registration("reg-1", "user-1", assessment),
                registration("reg-2", "user-2", assessment)), 30);

        // Per learner, not per assessment: the engine's SpEL cannot iterate a cohort.
        assertThat(capturedEventNames())
                .containsExactly("ASSESSMENT_REMINDER_BEFORE_START", "ASSESSMENT_REMINDER_BEFORE_START");
        assertThat(capturedContexts()).extracting(c -> c.get("studentEmail"))
                .containsExactly("user-1@example.com", "user-2@example.com");
    }

    @Test
    void reminder_minutesToStartIsTheCountdownNotTheSweepWindow() {
        Assessment assessment = assessment();
        assessment.setBoundStartTime(new Date(System.currentTimeMillis() + 3 * 60_000L));

        // Sweep window is 30 minutes, but this assessment opens in 3.
        publisher.publishReminderBeforeStart(assessment,
                List.of(registration("reg-1", "user-1", assessment)), 30);

        Map<String, Object> ctx = capturedContexts().get(0);
        assertThat((Integer) ctx.get("minutesToStart")).isBetween(2, 3);
        assertThat(ctx).containsEntry("reminderWindowMinutes", 30);
    }

    @Test
    void reminder_neverReportsANegativeCountdownForAnAssessmentJustPastItsStart() {
        Assessment assessment = assessment();
        assessment.setBoundStartTime(new Date(System.currentTimeMillis() - 5 * 60_000L));

        publisher.publishReminderBeforeStart(assessment,
                List.of(registration("reg-1", "user-1", assessment)), 30);

        assertThat(capturedContexts().get(0)).containsEntry("minutesToStart", 0);
    }

    @Test
    void reminder_skipsRegistrationsWithNoInstituteButStillEmitsForTheRest() {
        Assessment assessment = assessment();
        assessment.setBoundStartTime(new Date(System.currentTimeMillis() + 10 * 60_000L));
        AssessmentUserRegistration orphan = registration("reg-0", "user-0", assessment);
        orphan.setInstituteId(null);

        publisher.publishReminderBeforeStart(assessment,
                List.of(orphan, registration("reg-1", "user-1", assessment)), 30);

        assertThat(capturedContexts()).hasSize(1);
        assertThat(capturedContexts().get(0)).containsEntry("userId", "user-1");
    }

    // ------------------------------------------------------------------ REATTEMPT_GRANTED

    @Test
    void reattemptGranted_reportsAttemptsRemainingNetOfAttemptsAlreadyTaken() {
        Assessment assessment = assessment();
        AssessmentUserRegistration registration = registration("reg-1", "user-1", assessment);
        // Allowance of 4 (3 original + 1 just granted), 2 attempts already used.
        registration.setReattemptCount(4);
        registration.setStudentAttempts(new HashSet<>(List.of(
                attempt("att-1", registration), attempt("att-2", registration))));

        publisher.publishReattemptGranted(List.of(registration), assessment, 1, "admin-9");

        Map<String, Object> ctx = capturedContexts().get(0);
        assertThat(ctx)
                .containsEntry("attemptsGranted", 1)
                .containsEntry("attemptsAllowed", 4)   // the raw allowance
                .containsEntry("attemptsRemaining", 2) // allowance MINUS attempts taken
                .containsEntry("grantedBy", "admin-9");
    }

    @Test
    void reattemptGranted_neverReportsNegativeRemainingWhenAttemptsExceedTheAllowance() {
        Assessment assessment = assessment();
        AssessmentUserRegistration registration = registration("reg-1", "user-1", assessment);
        registration.setReattemptCount(1);
        registration.setStudentAttempts(new HashSet<>(List.of(
                attempt("att-1", registration), attempt("att-2", registration))));

        publisher.publishReattemptGranted(List.of(registration), assessment, 1, "admin-9");

        assertThat(capturedContexts().get(0)).containsEntry("attemptsRemaining", 0);
    }

    @Test
    void reattemptGranted_omitsRemainingWhenNoAllowanceIsSet() {
        Assessment assessment = assessment();
        AssessmentUserRegistration registration = registration("reg-1", "user-1", assessment);
        registration.setReattemptCount(null);

        publisher.publishReattemptGranted(List.of(registration), assessment, 2, "admin-9");

        assertThat(capturedContexts().get(0))
                .containsEntry("attemptsGranted", 2)
                .doesNotContainKey("attemptsAllowed")
                .doesNotContainKey("attemptsRemaining");
    }

    @Test
    void reattemptGranted_emitsOncePerLearner() {
        Assessment assessment = assessment();
        publisher.publishReattemptGranted(new ArrayList<>(List.of(
                registration("reg-1", "user-1", assessment),
                registration("reg-2", "user-2", assessment))), assessment, 1, "admin-9");

        assertThat(capturedContexts()).hasSize(2);
    }

    // ------------------------------------------------------------------ event names

    @Test
    void eventNamesMatchTheAdminCoreEnumExactly() {
        // A typo here is invisible at compile time and produces a trigger that silently
        // never matches any configured workflow.
        assertThat(AssessmentWorkflowEventPublisher.ASSESSMENT_CREATE).isEqualTo("ASSESSMENT_CREATE");
        assertThat(AssessmentWorkflowEventPublisher.ASSESSMENT_PUBLISHED).isEqualTo("ASSESSMENT_PUBLISHED");
        assertThat(AssessmentWorkflowEventPublisher.ASSESSMENT_START).isEqualTo("ASSESSMENT_START");
        assertThat(AssessmentWorkflowEventPublisher.ASSESSMENT_END).isEqualTo("ASSESSMENT_END");
        assertThat(AssessmentWorkflowEventPublisher.ASSESSMENT_FORM_SUBMISSION).isEqualTo("ASSESSMENT_FORM_SUBMISSION");
        assertThat(AssessmentWorkflowEventPublisher.ASSESSMENT_RESULT_RELEASED).isEqualTo("ASSESSMENT_RESULT_RELEASED");
        assertThat(AssessmentWorkflowEventPublisher.ASSESSMENT_REMINDER_BEFORE_START).isEqualTo("ASSESSMENT_REMINDER_BEFORE_START");
        assertThat(AssessmentWorkflowEventPublisher.ASSESSMENT_REATTEMPT_GRANTED).isEqualTo("ASSESSMENT_REATTEMPT_GRANTED");
    }
}
