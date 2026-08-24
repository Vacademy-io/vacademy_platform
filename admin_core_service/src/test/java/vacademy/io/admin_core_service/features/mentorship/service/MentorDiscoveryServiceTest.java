package vacademy.io.admin_core_service.features.mentorship.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.mentorship.dto.AssignMentorRequest;
import vacademy.io.admin_core_service.features.mentorship.dto.AssignmentResultDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorDirectoryDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorRequestCreateDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorRequestDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorRequestDecisionDTO;
import vacademy.io.admin_core_service.features.mentorship.entity.Mentor;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorRequest;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorStudentAssignment;
import vacademy.io.admin_core_service.features.mentorship.enums.MentorRequestStatus;
import vacademy.io.admin_core_service.features.mentorship.enums.MentorStatus;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorRequestRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorStudentAssignmentRepository;
import vacademy.io.common.auth.dto.UserServiceDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The learner-initiated half of mentorship. Pinned behaviors: the directory only
 * ever exposes mentors an admin opted in, a learner can't spam or double-book a
 * mentor, and an approval produces exactly the same pairing an admin-made
 * assignment would — including refusing to push a full mentor over their cap.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MentorDiscoveryServiceTest {

    private static final String INSTITUTE = "inst-1";
    private static final String STUDENT = "student-1";

    @Mock private MentorRepository mentorRepository;
    @Mock private MentorRequestRepository requestRepository;
    @Mock private MentorStudentAssignmentRepository assignmentRepository;
    @Mock private MentorAssignmentService assignmentService;
    @Mock private MentorshipNotificationService notificationService;
    @Mock private AuthService authService;

    @InjectMocks private MentorDiscoveryService service;

    // ---------------------------------------------------------------- fixtures

    private static Mentor mentor(String id, String name, boolean discoverable, Integer cap, String tags) {
        return Mentor.builder()
                .id(id).instituteId(INSTITUTE).userId("user-" + id)
                .displayName(name).status(MentorStatus.ACTIVE.name())
                .isDiscoverable(discoverable).maxMentees(cap).expertiseTags(tags)
                .build();
    }

    private static CustomUserDetails caller() {
        UserServiceDTO dto = new UserServiceDTO();
        dto.setUserId(STUDENT);
        dto.setUsername(STUDENT);
        dto.setFullName("Test Learner");
        return new CustomUserDetails(dto);
    }

    private void directoryContains(Mentor... mentors) {
        when(mentorRepository.findByInstituteIdAndStatusNot(eq(INSTITUTE), anyString()))
                .thenReturn(List.of(mentors));
        when(assignmentRepository.findByInstituteIdAndStatus(eq(INSTITUTE), anyString())).thenReturn(List.of());
        when(assignmentRepository.findByInstituteIdAndStudentUserIdAndStatus(eq(INSTITUTE), eq(STUDENT), anyString()))
                .thenReturn(List.of());
        when(requestRepository.findByInstituteIdAndStudentUserIdOrderByCreatedAtDesc(eq(INSTITUTE), eq(STUDENT)))
                .thenReturn(List.of());
    }

    private void mentorLookupReturns(Mentor m) {
        when(mentorRepository.findByIdAndInstituteIdAndStatusNot(eq(m.getId()), eq(INSTITUTE), anyString()))
                .thenReturn(Optional.of(m));
    }

    @Nested
    @DisplayName("directory")
    class Directory {

        @Test
        @DisplayName("lists only mentors an admin opted into discovery")
        void onlyDiscoverableMentorsAreListed() {
            directoryContains(
                    mentor("m1", "Asha", true, null, "Physics"),
                    mentor("m2", "Hidden", false, null, "Physics"));

            List<MentorDirectoryDTO> result = service.directory(INSTITUTE, STUDENT, null);

            assertEquals(1, result.size());
            assertEquals("Asha", result.get(0).getName());
        }

        @Test
        @DisplayName("hides mentors who were deactivated but not deleted")
        void inactiveMentorsAreHidden() {
            Mentor paused = mentor("m1", "Paused", true, null, null);
            paused.setStatus(MentorStatus.INACTIVE.name());
            directoryContains(paused);

            assertTrue(service.directory(INSTITUTE, STUDENT, null).isEmpty());
        }

        @Test
        @DisplayName("never leaks the mentor's email, phone or platform user id")
        void directoryDtoCarriesNoContactDetails() {
            directoryContains(mentor("m1", "Asha", true, null, "Physics"));

            MentorDirectoryDTO dto = service.directory(INSTITUTE, STUDENT, null).get(0);

            // MentorDirectoryDTO has no contact fields at all — this asserts the learner
            // read stays on that DTO rather than drifting back to the admin MentorDTO.
            assertFalse(java.util.Arrays.stream(dto.getClass().getDeclaredFields())
                            .map(java.lang.reflect.Field::getName)
                            .anyMatch(f -> f.equals("email") || f.equals("mobileNumber") || f.equals("userId")),
                    "directory DTO must not expose mentor contact details");
        }

        @Test
        @DisplayName("search matches expertise tags, not just names")
        void searchMatchesExpertiseTags() {
            directoryContains(
                    mentor("m1", "Asha", true, null, "JEE Physics,Career guidance"),
                    mentor("m2", "Bhavya", true, null, "Biology"));

            List<MentorDirectoryDTO> result = service.directory(INSTITUTE, STUDENT, "career");

            assertEquals(1, result.size());
            assertEquals("Asha", result.get(0).getName());
            assertEquals(List.of("JEE Physics", "Career guidance"), result.get(0).getExpertiseTags());
        }

        @Test
        @DisplayName("mentors with room sort ahead of full ones")
        void mentorsWithRoomComeFirst() {
            when(mentorRepository.findByInstituteIdAndStatusNot(eq(INSTITUTE), anyString()))
                    .thenReturn(List.of(
                            mentor("full", "Aaa Full", true, 1, null),
                            mentor("open", "Zzz Open", true, 5, null)));
            when(assignmentRepository.findByInstituteIdAndStatus(eq(INSTITUTE), anyString())).thenReturn(List.of(
                    MentorStudentAssignment.builder().mentorId("full").studentUserId("other").build()));
            when(assignmentRepository.findByInstituteIdAndStudentUserIdAndStatus(eq(INSTITUTE), eq(STUDENT), anyString()))
                    .thenReturn(List.of());
            when(requestRepository.findByInstituteIdAndStudentUserIdOrderByCreatedAtDesc(eq(INSTITUTE), eq(STUDENT)))
                    .thenReturn(List.of());

            List<MentorDirectoryDTO> result = service.directory(INSTITUTE, STUDENT, null);

            // "Aaa Full" sorts first alphabetically but is full, so it must drop below.
            assertEquals("Zzz Open", result.get(0).getName());
            assertEquals(5, result.get(0).getAvailableSlots(), "no mentees yet, so the full cap is free");
            assertTrue(result.get(1).getAtCapacity());
            assertEquals(0, result.get(1).getAvailableSlots());
        }

        @Test
        @DisplayName("each card carries the caller's own relationship to that mentor")
        void cardsCarryCallerRelationship() {
            when(mentorRepository.findByInstituteIdAndStatusNot(eq(INSTITUTE), anyString()))
                    .thenReturn(List.of(
                            mentor("mine", "Mine", true, null, null),
                            mentor("asked", "Asked", true, null, null)));
            when(assignmentRepository.findByInstituteIdAndStatus(eq(INSTITUTE), anyString())).thenReturn(List.of());
            when(assignmentRepository.findByInstituteIdAndStudentUserIdAndStatus(eq(INSTITUTE), eq(STUDENT), anyString()))
                    .thenReturn(List.of(MentorStudentAssignment.builder()
                            .mentorId("mine").studentUserId(STUDENT).build()));
            when(requestRepository.findByInstituteIdAndStudentUserIdOrderByCreatedAtDesc(eq(INSTITUTE), eq(STUDENT)))
                    .thenReturn(List.of(MentorRequest.builder()
                            .id("r1").mentorId("asked").status(MentorRequestStatus.PENDING.name()).build()));

            List<MentorDirectoryDTO> result = service.directory(INSTITUTE, STUDENT, null);
            MentorDirectoryDTO asked = result.stream().filter(d -> d.getId().equals("asked")).findFirst().orElseThrow();
            MentorDirectoryDTO mine = result.stream().filter(d -> d.getId().equals("mine")).findFirst().orElseThrow();

            assertTrue(mine.getAlreadyMentor());
            assertNull(mine.getRequestStatus());
            assertFalse(asked.getAlreadyMentor());
            assertEquals("PENDING", asked.getRequestStatus());
            assertEquals("r1", asked.getRequestId());
        }
    }

    @Nested
    @DisplayName("raising a request")
    class Create {

        @Test
        @DisplayName("saves a pending request and tells the mentor")
        void savesPendingAndNotifiesMentor() {
            Mentor m = mentor("m1", "Asha", true, 5, "Physics");
            mentorLookupReturns(m);
            when(assignmentRepository.findByInstituteIdAndMentorIdAndStudentUserIdAndStatus(
                    anyString(), anyString(), anyString(), anyString())).thenReturn(Optional.empty());
            when(assignmentRepository.countByMentorIdAndStatus(eq("m1"), anyString())).thenReturn(0L);
            when(requestRepository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

            MentorRequestDTO dto = service.createRequest(INSTITUTE, caller(), MentorRequestCreateDTO.builder()
                    .mentorId("m1").message("  need help with rotational motion  ").build());

            ArgumentCaptor<MentorRequest> captor = ArgumentCaptor.forClass(MentorRequest.class);
            verify(requestRepository).saveAndFlush(captor.capture());
            assertEquals(MentorRequestStatus.PENDING.name(), captor.getValue().getStatus());
            assertEquals("need help with rotational motion", captor.getValue().getMessage());
            assertEquals(STUDENT, captor.getValue().getStudentUserId());
            assertEquals("PENDING", dto.getStatus());
            verify(notificationService).notifyRequestSubmitted(INSTITUTE, "user-m1", STUDENT, "Asha");
        }

        @Test
        @DisplayName("refuses a second pending request for the same mentor")
        void refusesDuplicatePendingRequest() {
            Mentor m = mentor("m1", "Asha", true, null, null);
            mentorLookupReturns(m);
            when(assignmentRepository.findByInstituteIdAndMentorIdAndStudentUserIdAndStatus(
                    anyString(), anyString(), anyString(), anyString())).thenReturn(Optional.empty());
            when(requestRepository.findByInstituteIdAndStudentUserIdAndMentorIdAndStatus(
                    eq(INSTITUTE), eq(STUDENT), eq("m1"), eq(MentorRequestStatus.PENDING.name())))
                    .thenReturn(Optional.of(new MentorRequest()));

            VacademyException e = assertThrows(VacademyException.class, () ->
                    service.createRequest(INSTITUTE, caller(), MentorRequestCreateDTO.builder().mentorId("m1").build()));
            assertTrue(e.getMessage().contains("pending request"));
            verify(requestRepository, never()).saveAndFlush(any());
        }

        @Test
        @DisplayName("refuses a second open-ended request")
        void refusesDuplicateOpenEndedRequest() {
            when(requestRepository.findByInstituteIdAndStudentUserIdAndMentorIdIsNullAndStatus(
                    eq(INSTITUTE), eq(STUDENT), eq(MentorRequestStatus.PENDING.name())))
                    .thenReturn(Optional.of(new MentorRequest()));

            assertThrows(VacademyException.class, () ->
                    service.createRequest(INSTITUTE, caller(), MentorRequestCreateDTO.builder().build()));
            verify(requestRepository, never()).saveAndFlush(any());
        }

        @Test
        @DisplayName("a race that slips past the duplicate check still reads as a friendly refusal")
        void indexViolationBecomesAReadableError() {
            Mentor m = mentor("m1", "Asha", true, null, null);
            mentorLookupReturns(m);
            when(assignmentRepository.findByInstituteIdAndMentorIdAndStudentUserIdAndStatus(
                    anyString(), anyString(), anyString(), anyString())).thenReturn(Optional.empty());
            when(requestRepository.saveAndFlush(any()))
                    .thenThrow(new org.springframework.dao.DataIntegrityViolationException("uq_mentor_request_pending"));

            VacademyException e = assertThrows(VacademyException.class, () ->
                    service.createRequest(INSTITUTE, caller(), MentorRequestCreateDTO.builder().mentorId("m1").build()));
            assertTrue(e.getMessage().contains("pending request with this mentor"));
        }

        @Test
        @DisplayName("refuses a mentor who isn't in the directory")
        void refusesNonDiscoverableMentor() {
            mentorLookupReturns(mentor("m1", "Hidden", false, null, null));

            VacademyException e = assertThrows(VacademyException.class, () ->
                    service.createRequest(INSTITUTE, caller(), MentorRequestCreateDTO.builder().mentorId("m1").build()));
            assertTrue(e.getMessage().contains("accepting requests"));
        }

        @Test
        @DisplayName("refuses a mentor who is already mentoring the caller")
        void refusesExistingMentor() {
            mentorLookupReturns(mentor("m1", "Asha", true, null, null));
            when(assignmentRepository.findByInstituteIdAndMentorIdAndStudentUserIdAndStatus(
                    eq(INSTITUTE), eq("m1"), eq(STUDENT), anyString()))
                    .thenReturn(Optional.of(new MentorStudentAssignment()));

            VacademyException e = assertThrows(VacademyException.class, () ->
                    service.createRequest(INSTITUTE, caller(), MentorRequestCreateDTO.builder().mentorId("m1").build()));
            assertTrue(e.getMessage().contains("already mentoring"));
        }

        @Test
        @DisplayName("refuses a mentor who is at capacity")
        void refusesFullMentor() {
            mentorLookupReturns(mentor("m1", "Asha", true, 2, null));
            when(assignmentRepository.findByInstituteIdAndMentorIdAndStudentUserIdAndStatus(
                    anyString(), anyString(), anyString(), anyString())).thenReturn(Optional.empty());
            when(assignmentRepository.countByMentorIdAndStatus(eq("m1"), anyString())).thenReturn(2L);

            VacademyException e = assertThrows(VacademyException.class, () ->
                    service.createRequest(INSTITUTE, caller(), MentorRequestCreateDTO.builder().mentorId("m1").build()));
            assertTrue(e.getMessage().contains("fully booked"));
            verify(requestRepository, never()).saveAndFlush(any());
        }
    }

    @Nested
    @DisplayName("admin decision")
    class Decision {

        private MentorRequest pending(String mentorId) {
            MentorRequest r = MentorRequest.builder()
                    .id("req-1").instituteId(INSTITUTE).studentUserId(STUDENT)
                    .mentorId(mentorId).status(MentorRequestStatus.PENDING.name()).build();
            when(requestRepository.findByIdAndInstituteId("req-1", INSTITUTE)).thenReturn(Optional.of(r));
            when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            return r;
        }

        @Test
        @DisplayName("approval creates the pairing through the ordinary assignment path and links it")
        void approvalCreatesAssignmentAndLinksIt() {
            pending("m1");
            mentorLookupReturns(mentor("m1", "Asha", true, 5, null));
            when(assignmentRepository.countByMentorIdAndStatus(eq("m1"), anyString())).thenReturn(1L);
            when(assignmentService.assignManual(any(), any()))
                    .thenReturn(AssignmentResultDTO.builder().assigned(1).skipped(0).build());
            when(assignmentRepository.findByInstituteIdAndMentorIdAndStudentUserIdAndStatus(
                    eq(INSTITUTE), eq("m1"), eq(STUDENT), anyString()))
                    .thenReturn(Optional.of(MentorStudentAssignment.builder().id("assign-9").build()));

            MentorRequestDTO dto = service.approve("req-1", INSTITUTE, null, caller());

            ArgumentCaptor<AssignMentorRequest> captor = ArgumentCaptor.forClass(AssignMentorRequest.class);
            verify(assignmentService).assignManual(captor.capture(), any());
            assertEquals("m1", captor.getValue().getMentorId());
            assertEquals(List.of(STUDENT), captor.getValue().getStudentUserIds());
            assertEquals("APPROVED", dto.getStatus());
            assertEquals("assign-9", dto.getAssignmentId());
        }

        @Test
        @DisplayName("an admin can redirect an open-ended request to a chosen mentor")
        void openEndedRequestNeedsAPick() {
            pending(null);
            mentorLookupReturns(mentor("m2", "Bhavya", true, null, null));
            when(assignmentService.assignManual(any(), any()))
                    .thenReturn(AssignmentResultDTO.builder().assigned(1).build());
            when(assignmentRepository.findByInstituteIdAndMentorIdAndStudentUserIdAndStatus(
                    anyString(), anyString(), anyString(), anyString()))
                    .thenReturn(Optional.of(MentorStudentAssignment.builder().id("assign-2").build()));

            MentorRequestDTO dto = service.approve("req-1", INSTITUTE,
                    MentorRequestDecisionDTO.builder().mentorId("m2").build(), caller());

            assertEquals("m2", dto.getMentorId());
            assertEquals("APPROVED", dto.getStatus());
        }

        @Test
        @DisplayName("approving an open-ended request with no mentor picked is rejected")
        void openEndedRequestWithoutPickIsRejected() {
            pending(null);

            VacademyException e = assertThrows(VacademyException.class, () ->
                    service.approve("req-1", INSTITUTE, null, caller()));
            assertTrue(e.getMessage().contains("Pick a mentor"));
            verify(assignmentService, never()).assignManual(any(), any());
        }

        @Test
        @DisplayName("approval refuses to push a mentor past their cap")
        void approvalRespectsCapacity() {
            pending("m1");
            mentorLookupReturns(mentor("m1", "Asha", true, 3, null));
            when(assignmentRepository.countByMentorIdAndStatus(eq("m1"), anyString())).thenReturn(3L);

            VacademyException e = assertThrows(VacademyException.class, () ->
                    service.approve("req-1", INSTITUTE, null, caller()));
            assertTrue(e.getMessage().contains("at capacity"));
            verify(assignmentService, never()).assignManual(any(), any());
        }

        @Test
        @DisplayName("approval is refused when no pairing exists afterwards, so the request stays pending")
        void approvalWithoutAPairingIsRefused() {
            MentorRequest request = pending("m1");
            mentorLookupReturns(mentor("m1", "Asha", true, 5, null));
            when(assignmentRepository.countByMentorIdAndStatus(eq("m1"), anyString())).thenReturn(0L);
            // Capacity filled between the pre-check and the assign: nothing was created.
            when(assignmentService.assignManual(any(), any()))
                    .thenReturn(AssignmentResultDTO.builder().assigned(0).capacityFull(1).build());
            when(assignmentRepository.findByInstituteIdAndMentorIdAndStudentUserIdAndStatus(
                    anyString(), anyString(), anyString(), anyString())).thenReturn(Optional.empty());

            VacademyException e = assertThrows(VacademyException.class,
                    () -> service.approve("req-1", INSTITUTE, null, caller()));

            assertTrue(e.getMessage().contains("capacity may have just filled"));
            // The learner must never be told "approved" while they have no mentor.
            assertEquals(MentorRequestStatus.PENDING.name(), request.getStatus());
            verify(requestRepository, never()).save(any());
        }

        @Test
        @DisplayName("approving an already-paired learner resolves the request onto that pairing")
        void approvalOfAnExistingPairingSucceeds() {
            pending("m1");
            mentorLookupReturns(mentor("m1", "Asha", true, null, null));
            // assignManual reports 0 assigned because the pair already exists, not a failure.
            when(assignmentService.assignManual(any(), any()))
                    .thenReturn(AssignmentResultDTO.builder().assigned(0).skipped(1).build());
            when(assignmentRepository.findByInstituteIdAndMentorIdAndStudentUserIdAndStatus(
                    anyString(), anyString(), anyString(), anyString()))
                    .thenReturn(Optional.of(MentorStudentAssignment.builder().id("assign-existing").build()));

            MentorRequestDTO dto = service.approve("req-1", INSTITUTE, null, caller());

            assertEquals("APPROVED", dto.getStatus());
            assertEquals("assign-existing", dto.getAssignmentId());
        }

        @Test
        @DisplayName("a decided request can't be decided twice")
        void alreadyDecidedRequestIsRejected() {
            MentorRequest decided = MentorRequest.builder()
                    .id("req-1").instituteId(INSTITUTE).studentUserId(STUDENT)
                    .status(MentorRequestStatus.APPROVED.name()).build();
            when(requestRepository.findByIdAndInstituteId("req-1", INSTITUTE)).thenReturn(Optional.of(decided));

            assertThrows(VacademyException.class, () -> service.approve("req-1", INSTITUTE, null, caller()));
            assertThrows(VacademyException.class, () -> service.decline("req-1", INSTITUTE, null, caller()));
        }

        @Test
        @DisplayName("decline records the reason and tells the learner once")
        void declineNotifiesTheLearner() {
            pending("m1");

            MentorRequestDTO dto = service.decline("req-1", INSTITUTE,
                    MentorRequestDecisionDTO.builder().note(" Try Bhavya for Biology ").build(), caller());

            assertEquals("DECLINED", dto.getStatus());
            assertEquals("Try Bhavya for Biology", dto.getDecisionNote());
            verify(notificationService).notifyRequestDeclined(INSTITUTE, STUDENT, "Try Bhavya for Biology");
            // Declines must never create a pairing.
            verify(assignmentService, never()).assignManual(any(), any());
        }

        @Test
        @DisplayName("approval sends no extra notice — the new-mentor assignment notice covers it")
        void approvalDoesNotDoubleNotify() {
            pending("m1");
            mentorLookupReturns(mentor("m1", "Asha", true, null, null));
            when(assignmentService.assignManual(any(), any()))
                    .thenReturn(AssignmentResultDTO.builder().assigned(1).build());
            when(assignmentRepository.findByInstituteIdAndMentorIdAndStudentUserIdAndStatus(
                    anyString(), anyString(), anyString(), anyString()))
                    .thenReturn(Optional.of(MentorStudentAssignment.builder().id("assign-3").build()));

            service.approve("req-1", INSTITUTE, null, caller());

            verify(notificationService, never()).notifyRequestDeclined(anyString(), anyString(), any());
            verify(notificationService, never()).notifyRequestSubmitted(anyString(), anyString(), anyString(), any());
        }
    }

    @Nested
    @DisplayName("cancelling")
    class Cancel {

        @Test
        @DisplayName("a learner can withdraw their own pending request")
        void ownerCanCancel() {
            MentorRequest r = MentorRequest.builder()
                    .id("req-1").instituteId(INSTITUTE).studentUserId(STUDENT)
                    .status(MentorRequestStatus.PENDING.name()).build();
            when(requestRepository.findByIdAndInstituteId("req-1", INSTITUTE)).thenReturn(Optional.of(r));

            service.cancelRequest("req-1", INSTITUTE, STUDENT);

            assertEquals(MentorRequestStatus.CANCELLED.name(), r.getStatus());
            verify(requestRepository).save(r);
        }

        @Test
        @DisplayName("someone else's request is not visible to cancel")
        void nonOwnerCannotCancel() {
            when(requestRepository.findByIdAndInstituteId("req-1", INSTITUTE)).thenReturn(Optional.of(
                    MentorRequest.builder().id("req-1").instituteId(INSTITUTE)
                            .studentUserId("someone-else").status(MentorRequestStatus.PENDING.name()).build()));

            VacademyException e = assertThrows(VacademyException.class,
                    () -> service.cancelRequest("req-1", INSTITUTE, STUDENT));
            assertTrue(e.getMessage().contains("not found"));
            verify(requestRepository, never()).save(any());
        }

        @Test
        @DisplayName("an already-decided request can't be withdrawn")
        void decidedRequestCannotBeCancelled() {
            when(requestRepository.findByIdAndInstituteId("req-1", INSTITUTE)).thenReturn(Optional.of(
                    MentorRequest.builder().id("req-1").instituteId(INSTITUTE)
                            .studentUserId(STUDENT).status(MentorRequestStatus.APPROVED.name()).build()));

            assertThrows(VacademyException.class, () -> service.cancelRequest("req-1", INSTITUTE, STUDENT));
        }
    }
}
