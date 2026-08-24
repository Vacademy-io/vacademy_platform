package vacademy.io.admin_core_service.features.mentorship.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
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
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Learner-initiated mentorship: the Find-a-mentor directory and the request →
 * admin decision → assignment loop.
 *
 * <p>Mentorship started admin-push only (an admin picks students for a mentor).
 * This is the pull direction: a learner browses mentors their institute opted into
 * the directory ({@code mentor.is_discoverable}) and asks for one. An admin approves,
 * and approval creates an ordinary {@code mentor_student_assignment} row through
 * {@link MentorAssignmentService} — so notifications, feeds and booking behave exactly
 * as they do for an admin-made pairing, with no second code path.
 *
 * <p>Capacity ({@code mentor.max_mentees}) is enforced here as well as in assignment,
 * so a full mentor can't be approved into an over-allocation.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MentorDiscoveryService {

    private final MentorRepository mentorRepository;
    private final MentorRequestRepository requestRepository;
    private final MentorStudentAssignmentRepository assignmentRepository;
    private final MentorAssignmentService assignmentService;
    private final MentorshipNotificationService notificationService;
    private final AuthService authService;

    // ============================== learner: directory ==============================

    /**
     * Mentors a learner can browse and request: ACTIVE, opted into the directory, and
     * not soft-deleted. Each row carries the caller's own relationship to that mentor
     * (already mentored / request pending) so the card renders in one call.
     *
     * @param search optional case-insensitive filter over name, title, bio and expertise tags.
     */
    public List<MentorDirectoryDTO> directory(String instituteId, String callerUserId, String search) {
        List<Mentor> discoverable = mentorRepository
                .findByInstituteIdAndStatusNot(instituteId, MentorStatus.DELETED.name()).stream()
                .filter(m -> Boolean.TRUE.equals(m.getIsDiscoverable()))
                .filter(m -> MentorStatus.ACTIVE.name().equals(m.getStatus()))
                .collect(Collectors.toList());
        if (discoverable.isEmpty()) return List.of();

        Map<String, UserDTO> users = hydrate(discoverable.stream().map(Mentor::getUserId).toList());
        Map<String, Integer> loads = activeCountsByMentorId(instituteId);

        // The caller's existing mentors and live requests — drives the card's CTA state.
        Set<String> myMentorIds = assignmentRepository
                .findByInstituteIdAndStudentUserIdAndStatus(instituteId, callerUserId, MentorStatus.ACTIVE.name())
                .stream().map(MentorStudentAssignment::getMentorId).collect(Collectors.toSet());
        Map<String, MentorRequest> myRequests = requestRepository
                .findByInstituteIdAndStudentUserIdOrderByCreatedAtDesc(instituteId, callerUserId).stream()
                .filter(r -> r.getMentorId() != null)
                // Keep the newest per mentor — the list is already newest-first.
                .collect(Collectors.toMap(MentorRequest::getMentorId, r -> r, (newest, older) -> newest));

        String q = search == null ? "" : search.trim().toLowerCase();
        return discoverable.stream()
                .map(m -> toDirectoryDTO(m, users.get(m.getUserId()), loads.getOrDefault(m.getId(), 0),
                        myMentorIds.contains(m.getId()), myRequests.get(m.getId())))
                .filter(dto -> q.isEmpty() || matches(dto, q))
                .sorted((a, b) -> {
                    // Mentors with room first, then alphabetically — a full mentor is a dead end.
                    int byCapacity = Boolean.compare(Boolean.TRUE.equals(a.getAtCapacity()),
                            Boolean.TRUE.equals(b.getAtCapacity()));
                    if (byCapacity != 0) return byCapacity;
                    return orEmpty(a.getName()).compareToIgnoreCase(orEmpty(b.getName()));
                })
                .collect(Collectors.toList());
    }

    private static boolean matches(MentorDirectoryDTO dto, String q) {
        if (orEmpty(dto.getName()).toLowerCase().contains(q)) return true;
        if (orEmpty(dto.getTitle()).toLowerCase().contains(q)) return true;
        if (orEmpty(dto.getBio()).toLowerCase().contains(q)) return true;
        return dto.getExpertiseTags() != null
                && dto.getExpertiseTags().stream().anyMatch(t -> t.toLowerCase().contains(q));
    }

    private MentorDirectoryDTO toDirectoryDTO(Mentor m, UserDTO u, int load,
                                              boolean alreadyMentor, MentorRequest myRequest) {
        return MentorDirectoryDTO.builder()
                .id(m.getId())
                .name(firstNonBlank(m.getDisplayName(), u != null ? u.getFullName() : null, "Mentor"))
                .title(m.getTitle())
                .bio(m.getBio())
                .profileImageFileId(firstNonBlank(m.getProfileImageFileId(),
                        u != null ? u.getProfilePicFileId() : null, null))
                .expertiseTags(MentorService.splitTags(m.getExpertiseTags()))
                .atCapacity(MentorService.atCapacity(m.getMaxMentees(), load))
                .availableSlots(MentorService.availableSlots(m.getMaxMentees(), load))
                .alreadyMentor(alreadyMentor)
                .requestStatus(myRequest == null ? null : myRequest.getStatus())
                .requestId(myRequest == null ? null : myRequest.getId())
                .build();
    }

    // ============================== learner: requests ==============================

    /**
     * Raise a mentor request. {@code mentorId} may be omitted for "any available mentor".
     * Rejects duplicates of a live request and mentors the learner already has, so the
     * admin queue never fills with noise.
     */
    @Transactional
    public MentorRequestDTO createRequest(String instituteId, CustomUserDetails user, MentorRequestCreateDTO req) {
        String studentUserId = user.getUserId();
        Mentor mentor = null;
        if (req.getMentorId() != null && !req.getMentorId().isBlank()) {
            mentor = mentorRepository
                    .findByIdAndInstituteIdAndStatusNot(req.getMentorId(), instituteId, MentorStatus.DELETED.name())
                    .orElseThrow(() -> new VacademyException("Mentor not found"));
            if (!Boolean.TRUE.equals(mentor.getIsDiscoverable())
                    || !MentorStatus.ACTIVE.name().equals(mentor.getStatus())) {
                throw new VacademyException("This mentor isn't accepting requests");
            }
            if (assignmentRepository.findByInstituteIdAndMentorIdAndStudentUserIdAndStatus(
                    instituteId, mentor.getId(), studentUserId, MentorStatus.ACTIVE.name()).isPresent()) {
                throw new VacademyException("This mentor is already mentoring you");
            }
            int load = (int) assignmentRepository.countByMentorIdAndStatus(mentor.getId(), MentorStatus.ACTIVE.name());
            if (MentorService.atCapacity(mentor.getMaxMentees(), load)) {
                throw new VacademyException("This mentor is fully booked right now");
            }
            requestRepository.findByInstituteIdAndStudentUserIdAndMentorIdAndStatus(
                            instituteId, studentUserId, mentor.getId(), MentorRequestStatus.PENDING.name())
                    .ifPresent(r -> {
                        throw new VacademyException("You already have a pending request with this mentor");
                    });
        } else {
            requestRepository.findByInstituteIdAndStudentUserIdAndMentorIdIsNullAndStatus(
                            instituteId, studentUserId, MentorRequestStatus.PENDING.name())
                    .ifPresent(r -> {
                        throw new VacademyException("You already have a pending mentor request");
                    });
        }

        MentorRequest saved;
        try {
            saved = requestRepository.saveAndFlush(MentorRequest.builder()
                    .instituteId(instituteId)
                    .studentUserId(studentUserId)
                    .mentorId(mentor == null ? null : mentor.getId())
                    .message(trimToNull(req.getMessage()))
                    .status(MentorRequestStatus.PENDING.name())
                    .build());
        } catch (DataIntegrityViolationException e) {
            // Two taps racing past the duplicate check above: the partial unique index
            // is the real guard, so turn its violation into the same message the check
            // would have given rather than a 500.
            throw new VacademyException(mentor == null
                    ? "You already have a pending mentor request"
                    : "You already have a pending request with this mentor");
        }

        if (mentor != null) {
            final String mentorUserId = mentor.getUserId();
            final String mentorName = mentor.getDisplayName();
            afterCommit(() -> notificationService.notifyRequestSubmitted(
                    instituteId, mentorUserId, studentUserId, mentorName));
        }
        return toRequestDTO(saved, mentorsById(List.of(saved)), hydrate(List.of(studentUserId)));
    }

    /** The caller's own requests, newest first. */
    public List<MentorRequestDTO> myRequests(String instituteId, String studentUserId) {
        List<MentorRequest> rows = requestRepository
                .findByInstituteIdAndStudentUserIdOrderByCreatedAtDesc(instituteId, studentUserId);
        if (rows.isEmpty()) return List.of();
        Map<String, Mentor> mentors = mentorsById(rows);
        Map<String, UserDTO> users = hydrate(List.of(studentUserId));
        return rows.stream().map(r -> toRequestDTO(r, mentors, users)).collect(Collectors.toList());
    }

    /** The learner withdraws their own PENDING request. */
    @Transactional
    public void cancelRequest(String requestId, String instituteId, String studentUserId) {
        MentorRequest request = requestRepository.findByIdAndInstituteId(requestId, instituteId)
                .orElseThrow(() -> new VacademyException("Request not found"));
        if (!studentUserId.equals(request.getStudentUserId())) {
            throw new VacademyException("Request not found");
        }
        if (!MentorRequestStatus.PENDING.name().equals(request.getStatus())) {
            throw new VacademyException("Only a pending request can be cancelled");
        }
        request.setStatus(MentorRequestStatus.CANCELLED.name());
        requestRepository.save(request);
    }

    // ============================== admin: review queue ==============================

    /** The admin review queue for one status (default PENDING), newest first. */
    public Page<MentorRequestDTO> listRequests(String instituteId, String status, int pageNo, int pageSize) {
        String resolved = status == null || status.isBlank()
                ? MentorRequestStatus.PENDING.name() : status.trim().toUpperCase();
        Page<MentorRequest> page = requestRepository.findByInstituteIdAndStatusOrderByCreatedAtDesc(
                instituteId, resolved,
                PageRequest.of(Math.max(0, pageNo), Math.min(Math.max(1, pageSize), 100)));
        if (page.isEmpty()) return page.map(r -> null);

        Map<String, Mentor> mentors = mentorsById(page.getContent());
        Map<String, UserDTO> users = hydrate(page.getContent().stream()
                .map(MentorRequest::getStudentUserId).toList());
        return page.map(r -> toRequestDTO(r, mentors, users));
    }

    /**
     * Approve a request: pair the learner with the mentor and record which assignment
     * came out of it. The mentor is the one the admin picked, falling back to the one the
     * learner asked for — an "any mentor" request must carry a pick.
     */
    @Transactional
    public MentorRequestDTO approve(String requestId, String instituteId,
                                    MentorRequestDecisionDTO decision, CustomUserDetails user) {
        MentorRequest request = pendingOrThrow(requestId, instituteId);
        String mentorId = decision != null && decision.getMentorId() != null && !decision.getMentorId().isBlank()
                ? decision.getMentorId() : request.getMentorId();
        if (mentorId == null || mentorId.isBlank()) {
            throw new VacademyException("Pick a mentor to approve this request");
        }
        Mentor mentor = mentorRepository
                .findByIdAndInstituteIdAndStatusNot(mentorId, instituteId, MentorStatus.DELETED.name())
                .orElseThrow(() -> new VacademyException("Mentor not found"));

        int load = (int) assignmentRepository.countByMentorIdAndStatus(mentor.getId(), MentorStatus.ACTIVE.name());
        if (MentorService.atCapacity(mentor.getMaxMentees(), load)) {
            throw new VacademyException("%s is at capacity (%d mentees). Raise their limit or pick another mentor."
                    .formatted(orEmpty(mentor.getDisplayName()).isBlank() ? "This mentor" : mentor.getDisplayName(),
                            mentor.getMaxMentees()));
        }

        // Reuse the ordinary assignment path so the pairing, its audit fields and the
        // "you have a new mentor" notification are identical to an admin-made one.
        AssignmentResultDTO result = assignmentService.assignManual(AssignMentorRequest.builder()
                .instituteId(instituteId)
                .mentorId(mentor.getId())
                .studentUserIds(List.of(request.getStudentUserId()))
                .build(), user);

        // An approval is only real if a pairing exists afterwards. assignManual reports
        // 0 assigned both when the pair already existed (fine — that row is the pairing)
        // and when capacity blocked it (not fine), so the row itself is the thing to
        // check. Throwing rolls the transaction back and leaves the request PENDING,
        // rather than telling the learner "approved" while they have no mentor.
        MentorStudentAssignment pairing = assignmentRepository
                .findByInstituteIdAndMentorIdAndStudentUserIdAndStatus(
                        instituteId, mentor.getId(), request.getStudentUserId(), MentorStatus.ACTIVE.name())
                .orElseThrow(() -> new VacademyException(
                        "Couldn't pair them with this mentor — their capacity may have just filled. "
                                + "Raise the limit or pick another mentor, then approve again."));
        if (result.getAssigned() == null || result.getAssigned() == 0) {
            log.info("mentor request {} approved onto an existing pairing {}", requestId, pairing.getId());
        }

        request.setStatus(MentorRequestStatus.APPROVED.name());
        request.setMentorId(mentor.getId());
        request.setDecidedByUserId(user == null ? null : user.getUserId());
        request.setDecidedAt(Timestamp.from(Instant.now()));
        request.setDecisionNote(trimToNull(decision == null ? null : decision.getNote()));
        request.setAssignmentId(pairing.getId());
        MentorRequest saved = requestRepository.save(request);
        return toRequestDTO(saved, Map.of(mentor.getId(), mentor), hydrate(List.of(saved.getStudentUserId())));
    }

    /** Decline a request, optionally with a reason the learner sees. */
    @Transactional
    public MentorRequestDTO decline(String requestId, String instituteId,
                                    MentorRequestDecisionDTO decision, CustomUserDetails user) {
        MentorRequest request = pendingOrThrow(requestId, instituteId);
        request.setStatus(MentorRequestStatus.DECLINED.name());
        request.setDecidedByUserId(user == null ? null : user.getUserId());
        request.setDecidedAt(Timestamp.from(Instant.now()));
        request.setDecisionNote(trimToNull(decision == null ? null : decision.getNote()));
        MentorRequest saved = requestRepository.save(request);

        final String studentUserId = saved.getStudentUserId();
        final String note = saved.getDecisionNote();
        afterCommit(() -> notificationService.notifyRequestDeclined(instituteId, studentUserId, note));
        return toRequestDTO(saved, mentorsById(List.of(saved)), hydrate(List.of(studentUserId)));
    }

    // ---------------------------------------------------------------- helpers

    private MentorRequest pendingOrThrow(String requestId, String instituteId) {
        MentorRequest request = requestRepository.findByIdAndInstituteId(requestId, instituteId)
                .orElseThrow(() -> new VacademyException("Request not found"));
        if (!MentorRequestStatus.PENDING.name().equals(request.getStatus())) {
            throw new VacademyException("This request was already " + request.getStatus().toLowerCase());
        }
        return request;
    }

    private Map<String, Mentor> mentorsById(List<MentorRequest> requests) {
        List<String> ids = requests.stream()
                .map(MentorRequest::getMentorId)
                .filter(id -> id != null && !id.isBlank())
                .distinct().toList();
        if (ids.isEmpty()) return Map.of();
        Map<String, Mentor> map = new HashMap<>();
        for (Mentor m : mentorRepository.findAllById(ids)) map.put(m.getId(), m);
        return map;
    }

    private Map<String, Integer> activeCountsByMentorId(String instituteId) {
        Map<String, Integer> counts = new HashMap<>();
        for (MentorStudentAssignment a :
                assignmentRepository.findByInstituteIdAndStatus(instituteId, MentorStatus.ACTIVE.name())) {
            counts.merge(a.getMentorId(), 1, Integer::sum);
        }
        return counts;
    }

    private MentorRequestDTO toRequestDTO(MentorRequest r, Map<String, Mentor> mentors, Map<String, UserDTO> users) {
        Mentor mentor = r.getMentorId() == null ? null : mentors.get(r.getMentorId());
        UserDTO student = users.get(r.getStudentUserId());
        Integer availableSlots = null;
        if (mentor != null && mentor.getMaxMentees() != null) {
            int load = (int) assignmentRepository.countByMentorIdAndStatus(mentor.getId(), MentorStatus.ACTIVE.name());
            availableSlots = MentorService.availableSlots(mentor.getMaxMentees(), load);
        }
        return MentorRequestDTO.builder()
                .id(r.getId())
                .instituteId(r.getInstituteId())
                .studentUserId(r.getStudentUserId())
                .mentorId(r.getMentorId())
                .message(r.getMessage())
                .status(r.getStatus())
                .decisionNote(r.getDecisionNote())
                .assignmentId(r.getAssignmentId())
                .createdAt(r.getCreatedAt() == null ? null : r.getCreatedAt().getTime())
                .decidedAt(r.getDecidedAt() == null ? null : r.getDecidedAt().getTime())
                .studentName(student == null ? null : student.getFullName())
                .studentEmail(student == null ? null : student.getEmail())
                .mentorName(mentor == null ? null : mentor.getDisplayName())
                .mentorTitle(mentor == null ? null : mentor.getTitle())
                .mentorProfileImageFileId(mentor == null ? null : mentor.getProfileImageFileId())
                .mentorExpertiseTags(mentor == null ? null : MentorService.splitTags(mentor.getExpertiseTags()))
                .mentorAvailableSlots(availableSlots)
                .build();
    }

    private Map<String, UserDTO> hydrate(List<String> userIds) {
        List<String> distinct = userIds.stream().filter(id -> id != null && !id.isBlank()).distinct().toList();
        if (distinct.isEmpty()) return Map.of();
        try {
            Map<String, UserDTO> map = new HashMap<>();
            for (UserDTO u : authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(distinct))) {
                if (u != null && u.getId() != null) map.put(u.getId(), u);
            }
            return map;
        } catch (Exception e) {
            // Names/emails simply go missing rather than the screen failing, so this
            // is invisible without reporting it.
            MentorshipErrorReporter.report(e, "hydrate-users", null);
            return Map.of();
        }
    }

    /**
     * Run once the surrounding transaction commits, so a notification HTTP call can
     * never hold the request transaction open or roll a decision back.
     */
    private void afterCommit(Runnable task) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
        } else {
            task.run();
        }
    }

    private static String trimToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    private static String orEmpty(String v) {
        return v == null ? "" : v;
    }

    private static String firstNonBlank(String a, String b, String c) {
        if (a != null && !a.isBlank()) return a;
        if (b != null && !b.isBlank()) return b;
        return c;
    }
}
