package vacademy.io.admin_core_service.features.mentorship.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.booking.repository.BookingInstanceRepository;
import vacademy.io.admin_core_service.features.booking.repository.BookingPageRepository;
import vacademy.io.admin_core_service.features.booking.service.BookingPageService;
import vacademy.io.admin_core_service.features.audience.repository.OAuthConnectStateRepository;
import vacademy.io.admin_core_service.features.live_session.provider.service.google.GoogleAccountStore;
import vacademy.io.admin_core_service.features.live_session.provider.service.google.GoogleOAuthService;
import vacademy.io.admin_core_service.features.mentorship.entity.Mentor;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorRequest;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorStudentAssignment;
import vacademy.io.admin_core_service.features.mentorship.enums.MentorRequestStatus;
import vacademy.io.admin_core_service.features.mentorship.enums.MentorStatus;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorRequestRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorStudentAssignmentRepository;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Removing a mentor has to leave nothing dangling: their pairings go, and so do
 * the learner requests that were queued against them — a request nobody can ever
 * approve would otherwise sit in the admin queue forever and block the learner
 * from asking that mentor again.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MentorServiceRemovalTest {

    private static final String INSTITUTE = "inst-1";

    @Mock private MentorRepository mentorRepository;
    @Mock private MentorStudentAssignmentRepository assignmentRepository;
    @Mock private BookingPageRepository bookingPageRepository;
    @Mock private BookingInstanceRepository bookingInstanceRepository;
    @Mock private BookingPageService bookingPageService;
    @Mock private GoogleOAuthService googleOAuthService;
    @Mock private OAuthConnectStateRepository oAuthConnectStateRepository;
    @Mock private GoogleAccountStore googleAccountStore;
    @Mock private AuthService authService;
    @Mock private MentorRequestRepository mentorRequestRepository;

    @InjectMocks private MentorService service;

    private Mentor existingMentor() {
        Mentor m = Mentor.builder()
                .id("m1").instituteId(INSTITUTE).userId("u1")
                .displayName("Asha").status(MentorStatus.ACTIVE.name()).build();
        when(mentorRepository.findByIdAndInstituteIdAndStatusNot(eq("m1"), eq(INSTITUTE), anyString()))
                .thenReturn(Optional.of(m));
        return m;
    }

    @Test
    @DisplayName("removing a mentor soft-deletes them and their active pairings")
    void removalDeactivatesMentorAndAssignments() {
        Mentor mentor = existingMentor();
        MentorStudentAssignment assignment = MentorStudentAssignment.builder()
                .id("a1").mentorId("m1").studentUserId("stu-1").status(MentorStatus.ACTIVE.name()).build();
        when(assignmentRepository.findByMentorIdAndStatus(eq("m1"), eq(MentorStatus.ACTIVE.name())))
                .thenReturn(List.of(assignment));
        when(mentorRequestRepository.findByMentorIdAndStatus(anyString(), anyString())).thenReturn(List.of());

        service.delete("m1", INSTITUTE);

        assertEquals(MentorStatus.DELETED.name(), mentor.getStatus());
        assertEquals(MentorStatus.DELETED.name(), assignment.getStatus());
        verify(mentorRepository).save(mentor);
    }

    @Test
    @DisplayName("pending requests for that mentor are released, with a reason the learner sees")
    void removalReleasesPendingRequests() {
        existingMentor();
        when(assignmentRepository.findByMentorIdAndStatus(anyString(), anyString())).thenReturn(List.of());
        MentorRequest pending = MentorRequest.builder()
                .id("r1").instituteId(INSTITUTE).studentUserId("stu-1").mentorId("m1")
                .status(MentorRequestStatus.PENDING.name()).build();
        when(mentorRequestRepository.findByMentorIdAndStatus(eq("m1"), eq(MentorRequestStatus.PENDING.name())))
                .thenReturn(List.of(pending));

        service.delete("m1", INSTITUTE);

        // CANCELLED rather than DECLINED: this isn't a judgement on the learner, and it
        // frees them to request someone else (only a second PENDING row is blocked).
        assertEquals(MentorRequestStatus.CANCELLED.name(), pending.getStatus());
        assertTrue(pending.getDecisionNote().contains("no longer available"));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<MentorRequest>> captor = ArgumentCaptor.forClass(List.class);
        verify(mentorRequestRepository).saveAll(captor.capture());
        assertEquals(1, captor.getValue().size());
    }

    @Test
    @DisplayName("a mentor with nothing queued triggers no request write at all")
    void noPendingRequestsMeansNoWrite() {
        existingMentor();
        when(assignmentRepository.findByMentorIdAndStatus(anyString(), anyString())).thenReturn(List.of());
        when(mentorRequestRepository.findByMentorIdAndStatus(anyString(), anyString())).thenReturn(List.of());

        service.delete("m1", INSTITUTE);

        verify(mentorRequestRepository, never()).saveAll(any());
    }
}
