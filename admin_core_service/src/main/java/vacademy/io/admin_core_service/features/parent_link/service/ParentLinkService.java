package vacademy.io.admin_core_service.features.parent_link.service;

import org.apache.commons.lang3.RandomStringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.parent_link.dto.BackfillSummaryDTO;
import vacademy.io.admin_core_service.features.parent_link.dto.NewGuardianLinkRequestDTO;
import vacademy.io.admin_core_service.features.parent_link.dto.ParentLinkActionRequestDTO;
import vacademy.io.admin_core_service.features.parent_link.dto.ParentLinkActionResponseDTO;
import vacademy.io.common.auth.dto.BackfillParentItemDTO;
import vacademy.io.common.auth.dto.BackfillParentsResultDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;

@Service
public class ParentLinkService {

    private static final int BACKFILL_CHUNK_SIZE = 100;

    @Autowired
    private AuthService authService;

    @Autowired
    private StudentSessionInstituteGroupMappingRepository ssigmRepository;

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

            return ParentLinkActionResponseDTO.builder()
                    .parentUserId(created.get(0).getId())
                    .studentUserId(created.get(1).getId())
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

    public BackfillSummaryDTO backfillGuardians(String instituteId) {
        if (!StringUtils.hasText(instituteId)) {
            throw new VacademyException("instituteId is required");
        }

        List<String> studentUserIds = ssigmRepository.findDistinctUserIdsByInstituteAndStatus(
                instituteId, List.of(LearnerSessionStatusEnum.ACTIVE.name()));
        if (studentUserIds.isEmpty()) {
            return BackfillSummaryDTO.builder().totalEligible(0).created(0).skipped(0).build();
        }

        List<UserDTO> students = authService.getUsersFromAuthServiceByUserIds(studentUserIds);
        List<BackfillParentItemDTO> eligible = new ArrayList<>();
        int skippedUpfront = 0;
        for (UserDTO student : students) {
            boolean alreadyLinked = StringUtils.hasText(student.getLinkedParentId());
            boolean isItselfAParent = Boolean.TRUE.equals(student.getIsParent());
            if (alreadyLinked || isItselfAParent) {
                skippedUpfront++;
                continue;
            }
            String studentName = StringUtils.hasText(student.getFullName()) ? student.getFullName() : "Student";
            eligible.add(BackfillParentItemDTO.builder()
                    .childUserId(student.getId())
                    .parentFullName(studentName + "'s Guardian")
                    .parentEmail(RandomStringUtils.randomAlphanumeric(10).toLowerCase() + "@vacademy.com")
                    .build());
        }

        int created = 0;
        int skipped = skippedUpfront;
        for (int i = 0; i < eligible.size(); i += BACKFILL_CHUNK_SIZE) {
            List<BackfillParentItemDTO> chunk = eligible.subList(i, Math.min(i + BACKFILL_CHUNK_SIZE, eligible.size()));
            BackfillParentsResultDTO result = authService.backfillParents(chunk, instituteId);
            created += result.getCreated();
            skipped += result.getSkipped();
        }

        return BackfillSummaryDTO.builder()
                .totalEligible(eligible.size())
                .created(created)
                .skipped(skipped)
                .build();
    }
}
