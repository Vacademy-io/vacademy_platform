package vacademy.io.admin_core_service.features.parent_link.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.RandomStringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.parent_link.dto.BackfillSummaryDTO;
import vacademy.io.admin_core_service.features.parent_link.dto.NewGuardianLinkRequestDTO;
import vacademy.io.admin_core_service.features.parent_link.dto.ParentLinkActionRequestDTO;
import vacademy.io.admin_core_service.features.parent_link.dto.ParentLinkActionResponseDTO;
import vacademy.io.admin_core_service.features.parent_link.dto.PendingGuardianStudentDTO;
import vacademy.io.common.auth.dto.BackfillCreatedPairDTO;
import vacademy.io.common.auth.dto.BackfillParentItemDTO;
import vacademy.io.common.auth.dto.BackfillParentsResultDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class ParentLinkService {

    private static final int BACKFILL_CHUNK_SIZE = 100;

    @Autowired
    private AuthService authService;

    @Autowired
    private StudentSessionInstituteGroupMappingRepository ssigmRepository;

    @Autowired
    private InstituteStudentRepository studentRepository;

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AudienceResponseRepository audienceResponseRepository;

    public UserDTO getParentOfStudent(String studentUserId) {
        if (!StringUtils.hasText(studentUserId)) {
            return null;
        }
        List<UserDTO> students = authService.getUsersFromAuthServiceByUserIds(List.of(studentUserId));
        if (students.isEmpty() || !StringUtils.hasText(students.get(0).getLinkedParentId())) {
            return null;
        }
        List<UserDTO> parents = authService.getUsersFromAuthServiceByUserIds(
                List.of(students.get(0).getLinkedParentId()));
        return parents.isEmpty() ? null : parents.get(0);
    }

    public List<UserDTO> getChildrenOfParent(String parentUserId) {
        return authService.getChildrenOfParent(parentUserId);
    }

    public ParentLinkActionResponseDTO link(ParentLinkActionRequestDTO request) {
        if (!StringUtils.hasText(request.getInstituteId()) || !StringUtils.hasText(request.getAnchorUserId())
                || !StringUtils.hasText(request.getDirection()) || !StringUtils.hasText(request.getMode())) {
            throw new VacademyException("instituteId, anchorUserId, direction and mode are required");
        }

        boolean parentAddsStudent = "PARENT_ADDS_STUDENT".equalsIgnoreCase(request.getDirection());
        String otherPartyUserId;

        if ("LINK_EXISTING".equalsIgnoreCase(request.getMode())) {
            if (!StringUtils.hasText(request.getExistingUserId())) {
                throw new VacademyException("existingUserId is required for LINK_EXISTING mode");
            }
            otherPartyUserId = request.getExistingUserId();
        } else if ("CREATE_NEW".equalsIgnoreCase(request.getMode())) {
            otherPartyUserId = createNewLinkedUser(request, parentAddsStudent);
        } else {
            throw new VacademyException("Unknown mode: " + request.getMode());
        }

        String parentUserId = parentAddsStudent ? request.getAnchorUserId() : otherPartyUserId;
        String studentUserId = parentAddsStudent ? otherPartyUserId : request.getAnchorUserId();

        authService.linkParentChild(parentUserId, studentUserId);
        studentRepository.updateGuardianUserId(studentUserId, parentUserId);

        return ParentLinkActionResponseDTO.builder()
                .parentUserId(parentUserId)
                .studentUserId(studentUserId)
                .build();
    }

    /**
     * Creates the new party (student or guardian, depending on direction),
     * blocking on a duplicate email/mobile match — no auto-link, no override.
     */
    private String createNewLinkedUser(ParentLinkActionRequestDTO request, boolean parentAddsStudent) {
        checkNotAlreadyTaken(request.getNewEmail(), request.getNewMobileNumber());

        UserDTO newUser = new UserDTO();
        newUser.setFullName(request.getNewFullName());
        newUser.setEmail(request.getNewEmail());
        newUser.setMobileNumber(request.getNewMobileNumber());
        // The new party being created is the opposite role of what the anchor already is.
        newUser.setRoles(parentAddsStudent ? List.of("STUDENT") : List.of("PARENT"));

        UserDTO created = authService.createUserFromAuthService(newUser, request.getInstituteId(), false);
        return created.getId();
    }

    /**
     * Handles the one case {@code link()} can't: a brand-new manual chip in
     * the assign dialog flagged "is this a guardian?". The guardian has no
     * user id yet, so there is no valid anchor for {@code link()} — the
     * guardian is always created fresh here, and the student side is either
     * created fresh too or linked to an already-existing user.
     */
    public ParentLinkActionResponseDTO linkNewGuardian(NewGuardianLinkRequestDTO request) {
        if (!StringUtils.hasText(request.getInstituteId()) || !StringUtils.hasText(request.getMode())) {
            throw new VacademyException("instituteId and mode are required");
        }
        checkNotAlreadyTaken(request.getGuardianEmail(), request.getGuardianMobileNumber());

        if ("LINK_EXISTING".equalsIgnoreCase(request.getMode())) {
            if (!StringUtils.hasText(request.getStudentExistingUserId())) {
                throw new VacademyException("studentExistingUserId is required for LINK_EXISTING mode");
            }
            UserDTO parentDTO = new UserDTO();
            parentDTO.setFullName(request.getGuardianFullName());
            parentDTO.setEmail(request.getGuardianEmail());
            parentDTO.setMobileNumber(request.getGuardianMobileNumber());
            parentDTO.setRoles(List.of("PARENT"));

            UserDTO createdParent = authService.createUserFromAuthService(parentDTO, request.getInstituteId(), false);
            authService.linkParentChild(createdParent.getId(), request.getStudentExistingUserId());
            studentRepository.updateGuardianUserId(request.getStudentExistingUserId(), createdParent.getId());

            return ParentLinkActionResponseDTO.builder()
                    .parentUserId(createdParent.getId())
                    .studentUserId(request.getStudentExistingUserId())
                    .build();
        } else if ("CREATE_NEW".equalsIgnoreCase(request.getMode())) {
            checkNotAlreadyTaken(request.getStudentEmail(), request.getStudentMobileNumber());

            UserDTO parentDTO = new UserDTO();
            parentDTO.setFullName(request.getGuardianFullName());
            parentDTO.setEmail(request.getGuardianEmail());
            parentDTO.setMobileNumber(request.getGuardianMobileNumber());
            parentDTO.setRoles(List.of("PARENT"));

            UserDTO studentDTO = new UserDTO();
            studentDTO.setFullName(request.getStudentFullName());
            studentDTO.setEmail(request.getStudentEmail());
            studentDTO.setMobileNumber(request.getStudentMobileNumber());
            studentDTO.setRoles(List.of("STUDENT"));

            // createMultipleUsers (auth_service) requires exactly [parent, child] and
            // already sets is_parent / linked_parent_id internally — no separate
            // linkParentChild call needed here.
            List<UserDTO> created = authService.createMultipleUsers(
                    List.of(parentDTO, studentDTO), request.getInstituteId(), false);
            String newParentId = created.get(0).getId();
            String newStudentId = created.get(1).getId();
            // Best-effort: this student is a brand-new auth user, not yet enrolled
            // here, so there is usually no local `student` row for this UPDATE to
            // match yet (it's a no-op, not an error). The eligibility check in
            // backfillGuardians/previewPendingGuardians always falls back to
            // auth_service's linked_parent_id as the source of truth, so a student
            // enrolled later without this column ever getting stamped still won't
            // be double-backfilled — only the local "which one is missed" view
            // stays incomplete for this one edge case.
            studentRepository.updateGuardianUserId(newStudentId, newParentId);

            return ParentLinkActionResponseDTO.builder()
                    .parentUserId(newParentId)
                    .studentUserId(newStudentId)
                    .build();
        } else {
            throw new VacademyException("Unknown mode: " + request.getMode());
        }
    }

    private void checkNotAlreadyTaken(String email, String mobileNumber) {
        if (StringUtils.hasText(email)) {
            UserDTO existingByEmail = authService.getUserByEmail(email);
            if (existingByEmail != null) {
                throw new VacademyException("A user with this email already exists: " + email);
            }
        }
        if (StringUtils.hasText(mobileNumber)) {
            UserDTO existingByMobile = authService.getUserByMobileNumber(mobileNumber);
            if (existingByMobile != null) {
                throw new VacademyException("A user with this mobile number already exists: " + mobileNumber);
            }
        }
    }

    /**
     * Enrolled students in this institute who don't have a guardian linked
     * yet — the same eligibility check {@link #backfillGuardians} uses,
     * exposed read-only so the settings page can show admins what a backfill
     * run would actually touch before they confirm it.
     */
    public List<PendingGuardianStudentDTO> previewPendingGuardians(String instituteId) {
        return toPendingDtos(computeEligibleFromUserIds(getEnrolledStudentUserIds(instituteId)));
    }

    /**
     * Leads in this institute (any campaign, any status) whose student side
     * already has a real user attached but no guardian linked yet — reaches
     * leads that never got as far as an SSIGM enrollment row, unlike
     * {@link #previewPendingGuardians}.
     */
    public List<PendingGuardianStudentDTO> previewPendingLeadGuardians(String instituteId) {
        return toPendingDtos(computeEligibleFromUserIds(getLeadStudentUserIds(instituteId)));
    }

    private List<PendingGuardianStudentDTO> toPendingDtos(List<UserDTO> eligible) {
        return eligible.stream()
                .map(u -> PendingGuardianStudentDTO.builder()
                        .userId(u.getId())
                        .fullName(u.getFullName())
                        .email(u.getEmail())
                        .mobileNumber(u.getMobileNumber())
                        .build())
                .toList();
    }

    private List<String> getEnrolledStudentUserIds(String instituteId) {
        if (!StringUtils.hasText(instituteId)) {
            throw new VacademyException("instituteId is required");
        }
        return ssigmRepository.findDistinctUserIdsByInstituteAndStatus(
                instituteId, List.of(LearnerSessionStatusEnum.ACTIVE.name()));
    }

    private List<String> getLeadStudentUserIds(String instituteId) {
        if (!StringUtils.hasText(instituteId)) {
            throw new VacademyException("instituteId is required");
        }
        return audienceResponseRepository.findDistinctStudentUserIdsByInstitute(instituteId);
    }

    /**
     * Given a candidate id list from either source (enrolled students or
     * leads), returns the ones with no guardian linked who also aren't
     * themselves flagged as a guardian. Pre-filters via the local
     * {@code student.guardian_user_id} column (cheap, no cross-service call)
     * before the authoritative auth_service check — the local column is
     * best-effort (see linkNewGuardian's CREATE_NEW branch), so auth_service's
     * linked_parent_id/is_parent remains the source of truth for correctness;
     * the local column only narrows the auth_service payload size. Leads with
     * no local {@code student} row at all (never enrolled) simply always fall
     * through to the auth_service check — the narrowing is a pure optimization,
     * never a filter of correctness.
     */
    private List<UserDTO> computeEligibleFromUserIds(List<String> candidateUserIds) {
        if (candidateUserIds.isEmpty()) {
            return List.of();
        }

        Set<String> narrowedUserIds = studentRepository.findByUserIdInAndGuardianUserIdIsNull(candidateUserIds)
                .stream()
                .map(Student::getUserId)
                .collect(HashSet::new, Set::add, Set::addAll);
        // Defensive: a student row might be missing locally (never enrolled, or
        // a race with enrollment) — don't let that silently exclude someone
        // auth_service would still consider eligible. Fall back to the full id
        // list when the local narrowing found nothing, rather than trusting an
        // empty/absent local table.
        List<String> lookupIds = narrowedUserIds.isEmpty() ? candidateUserIds : new ArrayList<>(narrowedUserIds);

        List<UserDTO> students = authService.getUsersFromAuthServiceByUserIds(lookupIds);
        List<UserDTO> eligible = new ArrayList<>();
        for (UserDTO student : students) {
            boolean alreadyLinked = StringUtils.hasText(student.getLinkedParentId());
            boolean isItselfAGuardian = Boolean.TRUE.equals(student.getIsParent());
            if (alreadyLinked || isItselfAGuardian) {
                continue;
            }
            eligible.add(student);
        }
        return eligible;
    }

    public BackfillSummaryDTO backfillGuardians(String instituteId) {
        return runBackfill(instituteId, computeEligibleFromUserIds(getEnrolledStudentUserIds(instituteId)));
    }

    /** Same synthetic-guardian creation, sourced from leads instead of SSIGM enrollment. */
    public BackfillSummaryDTO backfillLeadGuardians(String instituteId) {
        return runBackfill(instituteId, computeEligibleFromUserIds(getLeadStudentUserIds(instituteId)));
    }

    /**
     * Processes at most ONE batch ({@link #BACKFILL_CHUNK_SIZE}) per call —
     * deliberately, so a single HTTP request can never run long enough to
     * risk a reverse-proxy timeout, regardless of institute size. The
     * frontend loops, calling this endpoint again until {@code totalEligible}
     * comes back {@code <=} what this batch just processed. This is
     * self-correcting rather than cursor-based: eligibility is recomputed
     * fresh on every call, so a student processed in an earlier batch simply
     * no longer appears (their linked_parent_id is now set) — no offset/page
     * token needs to be threaded through by the caller.
     *
     * {@code totalEligible} in the response is the FULL outstanding count as
     * of this call's snapshot (including the batch just processed), not just
     * the batch size — that's what lets the frontend show real progress
     * ("X of Y done") across the whole loop.
     */
    private BackfillSummaryDTO runBackfill(String instituteId, List<UserDTO> eligibleStudents) {
        int totalEligible = eligibleStudents.size();
        if (totalEligible == 0) {
            return BackfillSummaryDTO.builder().totalEligible(0).created(0).skipped(0).build();
        }

        List<UserDTO> batch = totalEligible > BACKFILL_CHUNK_SIZE
                ? eligibleStudents.subList(0, BACKFILL_CHUNK_SIZE)
                : eligibleStudents;

        List<BackfillParentItemDTO> items = new ArrayList<>();
        for (UserDTO student : batch) {
            String studentName = StringUtils.hasText(student.getFullName()) ? student.getFullName() : "Student";
            items.add(BackfillParentItemDTO.builder()
                    .childUserId(student.getId())
                    .parentFullName(studentName + "'s Guardian")
                    .parentEmail(RandomStringUtils.randomAlphanumeric(10).toLowerCase() + "@vacademy.com")
                    .build());
        }

        CredentialEmailConfig emailConfig = readCredentialEmailConfig(instituteId);
        BackfillParentsResultDTO result = authService.backfillParents(
                items, instituteId, emailConfig.sendCredentials(), emailConfig.recipient());
        if (result.getCreatedPairs() != null) {
            for (BackfillCreatedPairDTO pair : result.getCreatedPairs()) {
                studentRepository.updateGuardianUserId(pair.getChildUserId(), pair.getParentUserId());
            }
        }

        return BackfillSummaryDTO.builder()
                .totalEligible(totalEligible)
                .created(result.getCreated())
                .skipped(result.getSkipped())
                .build();
    }

    private record CredentialEmailConfig(boolean sendCredentials, String recipient) {
    }

    /**
     * Reads the Guardian Setting's backfill credential-email preference
     * directly from the institute's setting blob — the same source the
     * Settings page reads/writes (PARENT_SETTING), so there's a single
     * source of truth rather than trusting a client-supplied flag on the
     * backfill request itself.
     */
    private CredentialEmailConfig readCredentialEmailConfig(String instituteId) {
        try {
            String settingJson = instituteRepository.findById(instituteId)
                    .map(institute -> institute.getSetting())
                    .orElse(null);
            if (!StringUtils.hasText(settingJson)) {
                return new CredentialEmailConfig(false, "STUDENT");
            }
            JsonNode root = objectMapper.readTree(settingJson);
            JsonNode data = root.path("setting").path("PARENT_SETTING").path("data");
            boolean send = data.path("sendCredentialsOnBackfill").asBoolean(false);
            String recipient = data.path("backfillCredentialRecipient").asText("STUDENT");
            return new CredentialEmailConfig(send, recipient);
        } catch (Exception e) {
            return new CredentialEmailConfig(false, "STUDENT");
        }
    }
}
