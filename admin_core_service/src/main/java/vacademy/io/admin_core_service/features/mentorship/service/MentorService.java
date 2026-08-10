package vacademy.io.admin_core_service.features.mentorship.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.booking.dto.BookingAvailabilityDTO;
import vacademy.io.admin_core_service.features.booking.dto.BookingPageDTO;
import vacademy.io.admin_core_service.features.booking.repository.BookingInstanceRepository;
import vacademy.io.admin_core_service.features.booking.repository.BookingPageRepository;
import vacademy.io.admin_core_service.features.booking.service.BookingPageService;
import vacademy.io.admin_core_service.features.mentorship.dto.CreateMentorRequest;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorAvailabilityRequest;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorDashboardDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.UpdateMentorRequest;
import vacademy.io.admin_core_service.features.mentorship.entity.Mentor;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorStudentAssignment;
import vacademy.io.admin_core_service.features.mentorship.enums.MentorStatus;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorStudentAssignmentRepository;
import vacademy.io.admin_core_service.features.audience.entity.OAuthConnectState;
import vacademy.io.admin_core_service.features.audience.repository.OAuthConnectStateRepository;
import vacademy.io.admin_core_service.features.live_session.provider.dto.google.GoogleAccount;
import vacademy.io.admin_core_service.features.live_session.provider.service.google.GoogleAccountStore;
import vacademy.io.admin_core_service.features.live_session.provider.service.google.GoogleOAuthService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Mentor profile management: promote a user to mentor (grants the auth MENTOR
 * role best-effort + creates the profile row), edit, list with assigned-student
 * counts, soft-delete, and the admin dashboard aggregate. Identity fields
 * (name/email/image) are hydrated from auth_service by user id.
 */
@Service
@RequiredArgsConstructor
public class MentorService {

    private static final String MENTOR_ROLE = "MENTOR";

    private final MentorRepository mentorRepository;
    private final MentorStudentAssignmentRepository assignmentRepository;
    private final BookingPageRepository bookingPageRepository;
    private final BookingInstanceRepository bookingInstanceRepository;
    private final BookingPageService bookingPageService;
    private final GoogleOAuthService googleOAuthService;
    private final OAuthConnectStateRepository oAuthConnectStateRepository;
    private final GoogleAccountStore googleAccountStore;
    private final AuthService authService;

    @Transactional
    public MentorDTO create(CreateMentorRequest req, CustomUserDetails user) {
        if (req.getInstituteId() == null || req.getInstituteId().isBlank()
                || req.getUserId() == null || req.getUserId().isBlank()) {
            throw new VacademyException("instituteId and userId are required");
        }
        mentorRepository.findByInstituteIdAndUserIdAndStatusNot(
                        req.getInstituteId(), req.getUserId(), MentorStatus.DELETED.name())
                .ifPresent(m -> {
                    throw new VacademyException("This user is already a mentor in this institute");
                });

        // Grant the MENTOR role in auth_service (best-effort; swallows transient failures).
        authService.addRolesToUserInternal(req.getUserId(), List.of(MENTOR_ROLE), req.getInstituteId());

        Mentor mentor = Mentor.builder()
                .instituteId(req.getInstituteId())
                .userId(req.getUserId())
                .displayName(req.getDisplayName())
                .title(req.getTitle())
                .profileImageFileId(req.getProfileImageFileId())
                .bio(req.getBio())
                .subOrgId(req.getSubOrgId())
                .status(MentorStatus.ACTIVE.name())
                .createdByUserId(user != null ? user.getUserId() : null)
                .build();
        mentor = mentorRepository.save(mentor);

        return toDTO(mentor, 0, hydrate(List.of(mentor.getUserId())).get(mentor.getUserId()));
    }

    @Transactional
    public MentorDTO update(String mentorId, String instituteId, UpdateMentorRequest req) {
        Mentor mentor = getActiveMentorOrThrow(mentorId, instituteId);
        if (req.getDisplayName() != null) mentor.setDisplayName(req.getDisplayName());
        if (req.getTitle() != null) mentor.setTitle(req.getTitle());
        if (req.getProfileImageFileId() != null) mentor.setProfileImageFileId(req.getProfileImageFileId());
        if (req.getBio() != null) mentor.setBio(req.getBio());
        if (req.getBookingPageId() != null) mentor.setBookingPageId(req.getBookingPageId());
        if (req.getStatus() != null && !req.getStatus().isBlank()
                && !MentorStatus.DELETED.name().equalsIgnoreCase(req.getStatus())) {
            mentor.setStatus(req.getStatus().toUpperCase());
        }
        mentor = mentorRepository.save(mentor);
        int count = (int) assignmentRepository.countByMentorIdAndStatus(mentor.getId(), MentorStatus.ACTIVE.name());
        return toDTO(mentor, count, hydrate(List.of(mentor.getUserId())).get(mentor.getUserId()));
    }

    public List<MentorDTO> list(String instituteId) {
        List<Mentor> mentors = mentorRepository.findByInstituteIdAndStatusNot(instituteId, MentorStatus.DELETED.name());
        if (mentors.isEmpty()) return List.of();

        Map<String, UserDTO> users = hydrate(mentors.stream().map(Mentor::getUserId).collect(Collectors.toList()));
        Map<String, Integer> counts = activeCountsByMentorId(instituteId);

        return mentors.stream()
                .map(m -> toDTO(m, counts.getOrDefault(m.getId(), 0), users.get(m.getUserId())))
                .collect(Collectors.toList());
    }

    /** Paginated mentor list; identity hydration and assignment counts are per-page. */
    public Page<MentorDTO> listPaged(String instituteId, int pageNo, int pageSize) {
        Page<Mentor> page = mentorRepository.findByInstituteIdAndStatusNot(
                instituteId, MentorStatus.DELETED.name(),
                PageRequest.of(Math.max(0, pageNo), Math.min(Math.max(1, pageSize), 100)));
        if (page.isEmpty()) return page.map(m -> null);

        Map<String, UserDTO> users = hydrate(
                page.getContent().stream().map(Mentor::getUserId).collect(Collectors.toList()));
        Map<String, Integer> counts = activeCountsByMentorId(instituteId);
        return page.map(m -> toDTO(m, counts.getOrDefault(m.getId(), 0), users.get(m.getUserId())));
    }

    public MentorDTO getById(String mentorId, String instituteId) {
        Mentor mentor = getActiveMentorOrThrow(mentorId, instituteId);
        int count = (int) assignmentRepository.countByMentorIdAndStatus(mentor.getId(), MentorStatus.ACTIVE.name());
        return toDTO(mentor, count, hydrate(List.of(mentor.getUserId())).get(mentor.getUserId()));
    }

    @Transactional
    public void delete(String mentorId, String instituteId) {
        Mentor mentor = getActiveMentorOrThrow(mentorId, instituteId);
        mentor.setStatus(MentorStatus.DELETED.name());
        mentorRepository.save(mentor);
        // Deactivate this mentor's active assignments too.
        List<MentorStudentAssignment> active =
                assignmentRepository.findByMentorIdAndStatus(mentor.getId(), MentorStatus.ACTIVE.name());
        active.forEach(a -> a.setStatus(MentorStatus.DELETED.name()));
        if (!active.isEmpty()) assignmentRepository.saveAll(active);
        // Auth MENTOR role is intentionally NOT revoked here: role removal in auth
        // is not institute-scoped, so it could strip the role in other institutes.
    }

    /**
     * Ensure the mentor has a booking page (host = the mentor) so learners can book
     * 1:1 sessions. Idempotent — returns the current mentor if a live page already
     * exists. Creates a sensible default (Mon–Fri 09:00–17:00, Google Meet) via the
     * booking module; the mentor can refine availability later in Meetings.
     */
    @Transactional
    public MentorDTO provisionBookingPage(String mentorId, String instituteId, CustomUserDetails user) {
        Mentor mentor = getActiveMentorOrThrow(mentorId, instituteId);

        if (slugFor(mentor.getBookingPageId()) != null) {
            // Already linked to a live booking page — no-op.
            int existing = (int) assignmentRepository.countByMentorIdAndStatus(mentor.getId(), MentorStatus.ACTIVE.name());
            return toDTO(mentor, existing, hydrate(List.of(mentor.getUserId())).get(mentor.getUserId()));
        }

        String label = (mentor.getDisplayName() != null && !mentor.getDisplayName().isBlank())
                ? mentor.getDisplayName() : "Mentor";

        List<BookingAvailabilityDTO.WeeklyWindow> windows =
                List.of("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY").stream()
                        .map(day -> BookingAvailabilityDTO.WeeklyWindow.builder()
                                .dayOfWeek(day).startTime("09:00").endTime("17:00").build())
                        .collect(Collectors.toList());
        BookingAvailabilityDTO availability = BookingAvailabilityDTO.builder().weeklyWindows(windows).build();

        BookingPageDTO pageDto = new BookingPageDTO();
        pageDto.setInstituteId(instituteId);
        pageDto.setHostUserId(mentor.getUserId());
        pageDto.setTitle(label + " — 1:1 Session");
        pageDto.setAllocateGoogleMeet(true);
        pageDto.setAvailability(availability);

        BookingPageDTO created = bookingPageService.create(pageDto, user);
        mentor.setBookingPageId(created.getId());
        mentor = mentorRepository.save(mentor);

        int count = (int) assignmentRepository.countByMentorIdAndStatus(mentor.getId(), MentorStatus.ACTIVE.name());
        return toDTO(mentor, count, hydrate(List.of(mentor.getUserId())).get(mentor.getUserId()));
    }

    /** Mentor self-connects their OWN Google account — returns the consent URL (state carries the mentor id). */
    public Map<String, String> initiateGoogleConnect(String instituteId, CustomUserDetails user) {
        Mentor mentor = mentorRepository
                .findByInstituteIdAndUserIdAndStatusNot(instituteId, user.getUserId(), MentorStatus.DELETED.name())
                .orElseThrow(() -> new VacademyException("You are not a mentor in this institute"));
        OAuthConnectState state = oAuthConnectStateRepository.save(OAuthConnectState.builder()
                .instituteId(instituteId)
                .vendor("GOOGLE_OAUTH")
                .initiatedBy(user.getUserId())
                .mentorId(mentor.getId())
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .build());
        return Map.of(
                "oauth_url", googleOAuthService.buildAuthorizeUrl(state.getId()),
                "session_key", state.getId());
    }

    /** The caller's own mentor profile (for the "Connect Google" card in My Mentorship). */
    public MentorDTO getMyMentorProfile(String instituteId, CustomUserDetails user) {
        Mentor mentor = getMyMentorOrThrow(instituteId, user);
        int count = (int) assignmentRepository.countByMentorIdAndStatus(mentor.getId(), MentorStatus.ACTIVE.name());
        return toDTO(mentor, count, hydrate(List.of(mentor.getUserId())).get(mentor.getUserId()));
    }

    /**
     * The caller's own booking page (availability, duration, buffers). Auto-provisions
     * a default Mon–Fri 9–5 page the first time a mentor opens their availability, so
     * the editor always has something to edit.
     */
    public BookingPageDTO getMyBookingPage(String instituteId, CustomUserDetails user) {
        Mentor mentor = ensureMyBookingPage(instituteId, user);
        return bookingPageService.getById(mentor.getBookingPageId(), instituteId);
    }

    /**
     * Update ONLY the caller's own booking-page scheduling fields. The request DTO
     * deliberately excludes host/slug/institute, so a mentor can only change their own
     * availability — never repoint the page at another host.
     */
    public BookingPageDTO updateMyBookingPage(String instituteId, CustomUserDetails user,
                                              MentorAvailabilityRequest req) {
        Mentor mentor = ensureMyBookingPage(instituteId, user);
        BookingPageDTO dto = new BookingPageDTO();
        dto.setAvailability(req.getAvailability());
        dto.setDurationMinutes(req.getDurationMinutes());
        dto.setMinNoticeMinutes(req.getMinNoticeMinutes());
        dto.setBufferBeforeMinutes(req.getBufferBeforeMinutes());
        dto.setBufferAfterMinutes(req.getBufferAfterMinutes());
        dto.setBookingHorizonDays(req.getBookingHorizonDays());
        dto.setSlotGranularityMinutes(req.getSlotGranularityMinutes());
        dto.setTimezone(req.getTimezone());
        dto.setSessionTypes(req.getSessionTypes());
        dto.setLocationType(req.getLocationType());
        dto.setCustomMeetingLink(req.getCustomMeetingLink());
        dto.setAllocateGoogleMeet(req.getAllocateGoogleMeet());
        return bookingPageService.update(mentor.getBookingPageId(), instituteId, dto, user);
    }

    private Mentor getMyMentorOrThrow(String instituteId, CustomUserDetails user) {
        return mentorRepository
                .findByInstituteIdAndUserIdAndStatusNot(instituteId, user.getUserId(), MentorStatus.DELETED.name())
                .orElseThrow(() -> new VacademyException("You are not a mentor in this institute"));
    }

    /** Resolve the caller's mentor row, provisioning a booking page if they don't have one yet. */
    private Mentor ensureMyBookingPage(String instituteId, CustomUserDetails user) {
        Mentor mentor = getMyMentorOrThrow(instituteId, user);
        if (slugFor(mentor.getBookingPageId()) == null) {
            provisionBookingPage(mentor.getId(), instituteId, user);
            mentor = getMyMentorOrThrow(instituteId, user);
        }
        return mentor;
    }

    public MentorDashboardDTO dashboard(String instituteId) {
        List<MentorDTO> mentors = list(instituteId);
        List<MentorStudentAssignment> active =
                assignmentRepository.findByInstituteIdAndStatus(instituteId, MentorStatus.ACTIVE.name());
        int distinctMentees = (int) active.stream().map(MentorStudentAssignment::getStudentUserId).distinct().count();

        // Booking counts across all of this institute's mentors (as hosts).
        List<String> mentorUserIds = mentors.stream()
                .map(MentorDTO::getUserId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
        int todaySessions = 0;
        int upcomingSessions = 0;
        if (!mentorUserIds.isEmpty()) {
            java.time.LocalDate todayUtc = java.time.LocalDate.now(java.time.ZoneOffset.UTC);
            java.sql.Timestamp startToday =
                    java.sql.Timestamp.from(todayUtc.atStartOfDay(java.time.ZoneOffset.UTC).toInstant());
            java.sql.Timestamp endToday =
                    java.sql.Timestamp.from(todayUtc.plusDays(1).atStartOfDay(java.time.ZoneOffset.UTC).toInstant());
            java.time.Instant now = java.time.Instant.now();
            todaySessions = (int) bookingInstanceRepository.countActiveForHostsBetween(mentorUserIds, startToday, endToday);
            upcomingSessions = (int) bookingInstanceRepository.countActiveForHostsBetween(
                    mentorUserIds, java.sql.Timestamp.from(now),
                    java.sql.Timestamp.from(now.plus(java.time.Duration.ofDays(7))));
        }

        return MentorDashboardDTO.builder()
                .totalMentors(mentors.size())
                .totalActiveAssignments(active.size())
                .distinctMentees(distinctMentees)
                .todaySessions(todaySessions)
                .upcomingSessions(upcomingSessions)
                .mentors(mentors)
                .build();
    }

    // ---------- helpers ----------

    private Mentor getActiveMentorOrThrow(String mentorId, String instituteId) {
        return mentorRepository.findByIdAndInstituteIdAndStatusNot(mentorId, instituteId, MentorStatus.DELETED.name())
                .orElseThrow(() -> new VacademyException("Mentor not found"));
    }

    private Map<String, Integer> activeCountsByMentorId(String instituteId) {
        Map<String, Integer> counts = new HashMap<>();
        for (MentorStudentAssignment a :
                assignmentRepository.findByInstituteIdAndStatus(instituteId, MentorStatus.ACTIVE.name())) {
            counts.merge(a.getMentorId(), 1, Integer::sum);
        }
        return counts;
    }

    /** The connected Google account's email for display; null when unset/unknown. */
    private String googleEmailFor(String accountId) {
        if (accountId == null || accountId.isBlank()) return null;
        try {
            return googleAccountStore.findById(accountId).map(GoogleAccount::getOrganizerEmail).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    /** Resolve a mentor's booking-page slug (for the learner Book flow); null when unset/deleted. */
    String slugFor(String bookingPageId) {
        if (bookingPageId == null || bookingPageId.isBlank()) return null;
        return bookingPageRepository.findById(bookingPageId)
                .filter(p -> !MentorStatus.DELETED.name().equals(p.getStatus()))
                .map(vacademy.io.admin_core_service.features.booking.entity.BookingPage::getSlug)
                .orElse(null);
    }

    /** Batch-resolve user identity from auth_service, keyed by user id. Never throws hard. */
    private Map<String, UserDTO> hydrate(List<String> userIds) {
        List<String> distinct = userIds.stream().filter(id -> id != null && !id.isBlank()).distinct().toList();
        if (distinct.isEmpty()) return Map.of();
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(distinct);
            Map<String, UserDTO> map = new HashMap<>();
            for (UserDTO u : users) {
                if (u != null && u.getId() != null) map.put(u.getId(), u);
            }
            return map;
        } catch (Exception e) {
            return Map.of();
        }
    }

    private MentorDTO toDTO(Mentor m, Integer assignedCount, UserDTO u) {
        return MentorDTO.builder()
                .id(m.getId())
                .instituteId(m.getInstituteId())
                .userId(m.getUserId())
                .displayName(m.getDisplayName())
                .title(m.getTitle())
                .profileImageFileId(m.getProfileImageFileId())
                .bio(m.getBio())
                .bookingPageId(m.getBookingPageId())
                .bookingPageSlug(slugFor(m.getBookingPageId()))
                .googleAccountId(m.getGoogleAccountId())
                .googleConnected(m.getGoogleAccountId() != null && !m.getGoogleAccountId().isBlank())
                .googleEmail(googleEmailFor(m.getGoogleAccountId()))
                .status(m.getStatus())
                .assignedStudentCount(assignedCount)
                .name(u != null ? u.getFullName() : null)
                .email(u != null ? u.getEmail() : null)
                .mobileNumber(u != null ? u.getMobileNumber() : null)
                .profilePicFileId(u != null ? u.getProfilePicFileId() : null)
                .build();
    }
}
