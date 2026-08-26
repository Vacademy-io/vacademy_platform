package vacademy.io.admin_core_service.features.learner_access;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.learner_access.dto.LearnerAccessChangeRequestDTO;
import vacademy.io.admin_core_service.features.learner_access.dto.LearnerAccessChangeResponseDTO;
import vacademy.io.admin_core_service.features.learner_access.entity.LearnerAccessLog;
import vacademy.io.admin_core_service.features.learner_access.enums.LearnerAccessActionEnum;
import vacademy.io.admin_core_service.features.learner_access.repository.LearnerAccessLogRepository;
import vacademy.io.admin_core_service.features.learner_access.service.LearnerAccessService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Calendar;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LearnerAccessServiceTest {

    private static final String INSTITUTE_ID = "inst-1";
    private static final String USER_ID = "user-1";
    private static final String PACKAGE_SESSION_ID = "ps-1";
    private static final long DAY_MS = 24L * 60 * 60 * 1000;

    @Mock
    private StudentSessionRepository studentSessionRepository;

    @Mock
    private InstituteStudentRepository instituteStudentRepository;

    @Mock
    private LearnerAccessLogRepository learnerAccessLogRepository;

    @InjectMocks
    private LearnerAccessService learnerAccessService;

    private StudentSessionInstituteGroupMapping mapping;

    @BeforeEach
    void setUp() {
        PackageSession packageSession = new PackageSession();
        packageSession.setId(PACKAGE_SESSION_ID);

        mapping = new StudentSessionInstituteGroupMapping();
        mapping.setId("mapping-1");
        mapping.setUserId(USER_ID);
        mapping.setPackageSession(packageSession);
        mapping.setStatus(LearnerSessionStatusEnum.ACTIVE.name());
        mapping.setEnrolledDate(daysFromNow(-10));
        mapping.setExpiryDate(daysFromNow(20));
    }

    private static Date daysFromNow(int days) {
        Calendar calendar = Calendar.getInstance();
        calendar.add(Calendar.DAY_OF_YEAR, days);
        return calendar.getTime();
    }

    private LearnerAccessChangeRequestDTO.LearnerAccessChangeRequestDTOBuilder baseRequest() {
        return LearnerAccessChangeRequestDTO.builder()
                .instituteId(INSTITUTE_ID)
                .userIds(List.of(USER_ID))
                .packageSessionIds(List.of(PACKAGE_SESSION_ID));
    }

    private void stubLookup() {
        when(studentSessionRepository.findForAccessChange(anyString(), anyList(), anyList(), anyList()))
                .thenReturn(List.of(mapping));
        when(instituteStudentRepository.findByUserIdIn(anyList())).thenReturn(List.of());
    }

    @Test
    @DisplayName("extend_by_days pushes an active learner's expiry out by exactly that many days")
    void extendsActiveLearner() {
        stubLookup();
        Date before = mapping.getExpiryDate();

        LearnerAccessChangeResponseDTO response = learnerAccessService.changeAccess(
                baseRequest().extendByDays(30).build(), null);

        assertEquals(1, response.getSummary().getUpdated());
        assertEquals(LearnerAccessActionEnum.EXTEND.name(), response.getResults().get(0).getAction());
        assertEquals(30, response.getResults().get(0).getDaysDelta());
        assertEquals(30, Math.round((double) (mapping.getExpiryDate().getTime() - before.getTime()) / DAY_MS));
    }

    @Test
    @DisplayName("an expired learner extended by N days gets N usable days, counted from today")
    void extendsExpiredLearnerFromToday() {
        mapping.setExpiryDate(daysFromNow(-90));
        mapping.setStatus(LearnerSessionStatusEnum.INACTIVE.name());
        stubLookup();

        learnerAccessService.changeAccess(baseRequest().extendByDays(30).build(), null);

        long daysLeft = Math.round(
                (double) (mapping.getExpiryDate().getTime() - System.currentTimeMillis()) / DAY_MS);
        assertEquals(30, daysLeft, "expired learners must not be extended into the past");
        assertEquals(LearnerSessionStatusEnum.ACTIVE.name(), mapping.getStatus(),
                "an extension that lands in the future should lift the learner out of INACTIVE");
    }

    @Test
    @DisplayName("extend_from_today=false keeps the historical semantics of stacking on a stale expiry")
    void extendsExpiredLearnerFromStaleExpiry() {
        Date staleExpiry = daysFromNow(-90);
        mapping.setExpiryDate(staleExpiry);
        stubLookup();

        learnerAccessService.changeAccess(
                baseRequest().extendByDays(30).extendFromToday(false).build(), null);

        assertEquals(30, Math.round(
                (double) (mapping.getExpiryDate().getTime() - staleExpiry.getTime()) / DAY_MS));
        assertTrue(mapping.getExpiryDate().before(new Date()),
                "stacking on a 90-day-old expiry should still leave it in the past");
    }

    @Test
    @DisplayName("a learner with unlimited access is skipped rather than silently given a finite window")
    void skipsUnlimitedLearnerOnExtend() {
        mapping.setExpiryDate(null);
        stubLookup();

        LearnerAccessChangeResponseDTO response = learnerAccessService.changeAccess(
                baseRequest().extendByDays(30).build(), null);

        assertEquals(0, response.getSummary().getUpdated());
        assertEquals(1, response.getSummary().getSkipped());
        assertNull(mapping.getExpiryDate());
        verify(learnerAccessLogRepository, never()).saveAll(anyList());
    }

    @Test
    @DisplayName("access_days_from_enrollment recomputes from the enrollment date, not from today")
    void setsDaysFromEnrollment() {
        stubLookup();
        Date enrolled = mapping.getEnrolledDate();

        learnerAccessService.changeAccess(
                baseRequest().accessDaysFromEnrollment(60).build(), null);

        assertEquals(60, Math.round(
                (double) (mapping.getExpiryDate().getTime() - enrolled.getTime()) / DAY_MS));
    }

    @Test
    @DisplayName("make_unlimited clears the expiry and logs MAKE_UNLIMITED with no day delta")
    void makesUnlimited() {
        stubLookup();

        LearnerAccessChangeResponseDTO response = learnerAccessService.changeAccess(
                baseRequest().makeUnlimited(true).build(), null);

        assertNull(mapping.getExpiryDate());
        assertEquals(LearnerAccessActionEnum.MAKE_UNLIMITED.name(),
                response.getResults().get(0).getAction());
        assertNull(response.getResults().get(0).getDaysDelta(),
                "the distance to unlimited is not a number of days");
        assertNull(response.getResults().get(0).getRemainingDays());
    }

    @Test
    @DisplayName("moving expiry into the past is logged as REVOKE, not REDUCE")
    void classifiesPastExpiryAsRevoke() {
        stubLookup();

        LearnerAccessChangeResponseDTO response = learnerAccessService.changeAccess(
                baseRequest().newExpiryDate(daysFromNow(-1)).build(), null);

        assertEquals(LearnerAccessActionEnum.REVOKE.name(), response.getResults().get(0).getAction());
        assertEquals(0, response.getResults().get(0).getRemainingDays());
    }

    @Test
    @DisplayName("a dry run reports the outcome without touching the mapping or the log")
    void dryRunWritesNothing() {
        stubLookup();
        Date before = mapping.getExpiryDate();

        LearnerAccessChangeResponseDTO response = learnerAccessService.changeAccess(
                baseRequest().extendByDays(30).dryRun(true).build(), null);

        assertTrue(response.isDryRun());
        assertEquals(1, response.getSummary().getUpdated());
        assertEquals(before, mapping.getExpiryDate());
        verify(studentSessionRepository, never()).saveAll(anyList());
        verify(learnerAccessLogRepository, never()).saveAll(anyList());
    }

    @Test
    @DisplayName("every applied change writes exactly one audit row carrying before, after and actor")
    void writesAuditRow() {
        stubLookup();

        learnerAccessService.changeAccess(
                baseRequest().extendByDays(15).reason("Compensating for reschedule").build(), null);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<LearnerAccessLog>> captor = ArgumentCaptor.forClass(List.class);
        verify(learnerAccessLogRepository, times(1)).saveAll(captor.capture());

        List<LearnerAccessLog> logs = captor.getValue();
        assertEquals(1, logs.size());
        LearnerAccessLog row = logs.get(0);
        assertEquals(INSTITUTE_ID, row.getInstituteId());
        assertEquals(USER_ID, row.getUserId());
        assertEquals(PACKAGE_SESSION_ID, row.getPackageSessionId());
        assertEquals(LearnerAccessActionEnum.EXTEND.name(), row.getAction());
        assertEquals(15, row.getDaysDelta());
        assertEquals(15, row.getAccessDays());
        assertNotNull(row.getPreviousExpiryDate());
        assertNotNull(row.getNewExpiryDate());
        assertEquals("Compensating for reschedule", row.getReason());
    }

    @Test
    @DisplayName("a learner already ACTIVE in a batch never gets a second ACTIVE row from reactivation")
    void doesNotCreateASecondActiveEnrollment() {
        PackageSession sameSession = new PackageSession();
        sameSession.setId(PACKAGE_SESSION_ID);

        // The learner already holds a live enrollment in this batch...
        StudentSessionInstituteGroupMapping active = new StudentSessionInstituteGroupMapping();
        active.setId("mapping-active");
        active.setUserId(USER_ID);
        active.setPackageSession(sameSession);
        active.setStatus(LearnerSessionStatusEnum.ACTIVE.name());
        active.setEnrolledDate(daysFromNow(-30));
        active.setExpiryDate(daysFromNow(10));

        // ...alongside a stale INACTIVE row for the same batch.
        mapping.setId("mapping-stale");
        mapping.setStatus(LearnerSessionStatusEnum.INACTIVE.name());
        mapping.setExpiryDate(daysFromNow(-5));

        when(studentSessionRepository.findForAccessChange(anyString(), anyList(), anyList(), anyList()))
                .thenReturn(List.of(active, mapping));
        when(instituteStudentRepository.findByUserIdIn(anyList())).thenReturn(List.of());

        learnerAccessService.changeAccess(baseRequest().extendByDays(30).build(), null);

        assertEquals(LearnerSessionStatusEnum.ACTIVE.name(), active.getStatus());
        assertEquals(LearnerSessionStatusEnum.INACTIVE.name(), mapping.getStatus(),
                "the stale row must keep its status — two ACTIVE rows for one batch breaks "
                        + "every roster and can trip uq_dest_pkg_inst_user_status");
        assertTrue(mapping.getExpiryDate().after(new Date()),
                "its access window is still extended, only the status promotion is withheld");
    }

    @Test
    @DisplayName("combining two change modes is rejected — the outcome would be ambiguous")
    void rejectsAmbiguousRequest() {
        VacademyException e = assertThrows(VacademyException.class, () ->
                learnerAccessService.changeAccess(
                        baseRequest().extendByDays(30).makeUnlimited(true).build(), null));
        assertTrue(e.getMessage().contains("exactly one"));
    }

    @Test
    @DisplayName("a request with no change mode at all is rejected rather than silently doing nothing")
    void rejectsEmptyRequest() {
        assertThrows(VacademyException.class, () ->
                learnerAccessService.changeAccess(baseRequest().build(), null));
    }

    @Test
    @DisplayName("recordGrant ignores a no-op so the timeline never shows a change that did not happen")
    void recordGrantSkipsNoOp() {
        Date expiry = daysFromNow(30);
        mapping.setExpiryDate(expiry);

        learnerAccessService.recordGrant(
                vacademy.io.admin_core_service.features.learner_access.enums
                        .LearnerAccessSourceEnum.ENROLLMENT,
                INSTITUTE_ID, mapping, expiry, 30, null, null, null, "Enrollment", null, null);

        verify(learnerAccessLogRepository, never()).save(any());
    }

    @Test
    @DisplayName("recordGrant logs a first-ever expiry as GRANT")
    void recordGrantLogsFirstGrant() {
        learnerAccessService.recordGrant(
                vacademy.io.admin_core_service.features.learner_access.enums
                        .LearnerAccessSourceEnum.ENROLLMENT,
                INSTITUTE_ID, mapping, null, 365, "plan-1", "pp-1", "ei-1", "Enrolled via Annual",
                null, null);

        ArgumentCaptor<LearnerAccessLog> captor = ArgumentCaptor.forClass(LearnerAccessLog.class);
        verify(learnerAccessLogRepository).save(captor.capture());

        LearnerAccessLog row = captor.getValue();
        assertEquals(LearnerAccessActionEnum.GRANT.name(), row.getAction());
        assertEquals(365, row.getAccessDays());
        assertEquals("pp-1", row.getPaymentPlanId());
        assertEquals("ei-1", row.getEnrollInviteId());
        assertNull(row.getDaysDelta(), "there is no delta from 'no expiry' to a date");
    }
}
