package vacademy.io.admin_core_service.features.learner_invitation.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentRegistrationManager;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.learner_invitation.dto.*;
import vacademy.io.admin_core_service.features.learner_invitation.dto.json_mapper.PackageSelectionDTO;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitation;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitationCustomFieldResponse;
import vacademy.io.admin_core_service.features.learner_invitation.entity.LearnerInvitationResponse;
import vacademy.io.admin_core_service.features.learner_invitation.enums.CustomFieldStatusEnum;
import vacademy.io.admin_core_service.features.learner_invitation.enums.LearnerInvitationCodeStatusEnum;
import vacademy.io.admin_core_service.features.learner_invitation.enums.LearnerInvitationResponseStatusEnum;
import vacademy.io.admin_core_service.features.learner_invitation.notification.LearnerInvitationNotification;
import vacademy.io.admin_core_service.features.learner_invitation.repository.LearnerInvitationCustomFieldResponseRepository;
import vacademy.io.admin_core_service.features.learner_invitation.repository.LearnerInvitationRepository;
import vacademy.io.admin_core_service.features.learner_invitation.repository.LearnerInvitationResponseRepository;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class LearnerInvitationResponseService {

    // Dependencies
    @Autowired private LearnerInvitationResponseRepository learnerInvitationResponseRepository;
    @Autowired private LearnerInvitationRepository learnerInvitationRepository;
    @Autowired private LearnerInvitationCustomFieldResponseRepository learnerInvitationCustomFieldResponseRepository;
    @Autowired private InstituteRepository instituteRepository;
    @Autowired private LearnerInvitationNotification notification;
    @Autowired private InstituteStudentRepository instituteStudentRepository;
    @Autowired private StudentRegistrationManager studentRegistrationManager;
    @Autowired private PackageSessionRepository packageSessionRepository;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private StudentSessionRepository studentSessionRepository;

    // Constants
    private static final int DEFAULT_ACCESS_DAYS = 365;
    private static final List<String> ACTIVE_PACKAGE_STATUSES = List.of(
            PackageSessionStatusEnum.ACTIVE.name(),
            PackageSessionStatusEnum.HIDDEN.name()
    );
    private static final List<String> INVITED_STATUSES = List.of(LearnerSessionStatusEnum.INVITED.name());

    // Main Service Methods =====================================================

    @Transactional
    public String registerLearnerInvitationResponse(LearnerInvitationResponseDTO learnerInvitationResponseDTO) {
        validateRegistrationRequest(learnerInvitationResponseDTO);

        LearnerInvitation invitation = getValidInvitation(learnerInvitationResponseDTO.getLearnerInvitationId());
        PackageSelectionDTO packageSelection = parsePackageSelection(learnerInvitationResponseDTO.getBatchSelectionResponseJson());

        Optional<Student> existingStudent = findExistingStudent(
                learnerInvitationResponseDTO.getEmail(),
                invitation.getInstituteId()
        );

        if (existingStudent.isEmpty()) {
            registerNewStudent(learnerInvitationResponseDTO, invitation, packageSelection);
        } else {
            createSessionMappings(
                    existingStudent.get().getUserId(),
                    invitation.getInstituteId(),
                    packageSelection,
                    new BooleanWrapper(false) // Using wrapper for pass-by-reference behavior
            );
        }

        return "Done!!!";
    }

    public LearnerInvitationFormDTO getInvitationFormByInviteCodeAndInstituteId(String instituteId, String inviteCode) {
        Objects.requireNonNull(instituteId, "Institute ID cannot be null");
        Objects.requireNonNull(inviteCode, "Invite code cannot be null");

        LearnerInvitation invitation = getValidInvitationByCode(instituteId, inviteCode);
        Institute institute = getInstitute(invitation.getInstituteId());

        return buildInvitationFormDTO(invitation, institute);
    }

    public Page<OneLearnerInvitationResponse> getLearnerInvitationResponses(
            LearnerInvitationResponsesFilterDTO filterDTO,
            String instituteId,
            int pageNo,
            int pageSize,
            CustomUserDetails user) {

        validatePaginationParameters(pageNo, pageSize);
        Pageable pageable = PageRequest.of(pageNo, pageSize);

        return learnerInvitationResponseRepository
                .findByInstituteIdAndStatusWithCustomFields(
                        instituteId,
                        filterDTO.getStatus(),
                        List.of(CustomFieldStatusEnum.ACTIVE.name()),
                        pageable
                )
                .map(LearnerInvitationResponse::mapToOneLearnerInvitationResponse);
    }

    @Transactional
    public String updateLearnerInvitationResponseStatus(
            LearnerInvitationRequestStatusChangeDTO statusChangeDTO,
            CustomUserDetails user) {

        validateStatusChangeRequest(statusChangeDTO);
        List<LearnerInvitationResponse> responses = updateResponseStatuses(statusChangeDTO);
        sendStatusUpdateNotifications(responses);

        return "Status updated successfully!!!";
    }

    // Core Business Logic Methods ==============================================

    private void registerNewStudent(
            LearnerInvitationResponseDTO responseDTO,
            LearnerInvitation invitation,
            PackageSelectionDTO packageSelection) {

        Student student = createInitialStudent(responseDTO, invitation, packageSelection);
        createSessionMappings(
                student.getUserId(),
                invitation.getInstituteId(),
                packageSelection,
                new BooleanWrapper(true) // Using wrapper for pass-by-reference behavior
        );
    }

    private Student createInitialStudent(
            LearnerInvitationResponseDTO responseDTO,
            LearnerInvitation invitation,
            PackageSelectionDTO packageSelection) {

        InstituteStudentDTO studentDTO = buildStudentDTO(responseDTO);
        PackageSession firstSession = findFirstValidPackageSession(packageSelection);

        studentDTO.setInstituteStudentDetails(
                buildStudentDetails(invitation.getInstituteId(), firstSession)
        );

        studentRegistrationManager.addStudentToInstitute(null, studentDTO, null);

        return findCreatedStudent(responseDTO.getEmail(), invitation.getInstituteId());
    }

    private void createSessionMappings(
            String userId,
            String instituteId,
            PackageSelectionDTO packageSelection,
            BooleanWrapper skipFirstWrapper) {

        List<StudentSessionInstituteGroupMapping> mappings = buildSessionMappings(
                userId,
                instituteId,
                packageSelection,
                skipFirstWrapper
        );

        studentSessionRepository.saveAll(mappings);
    }

    // Helper Methods ===========================================================

    private List<StudentSessionInstituteGroupMapping> buildSessionMappings(
            String userId,
            String instituteId,
            PackageSelectionDTO packageSelection,
            BooleanWrapper skipFirstWrapper) {

        StudentSessionInstituteGroupMapping latestMapping = getLatestStudentMapping(userId, instituteId);
        List<String> existingSessionIds = getExistingInvitedSessionIds(userId, instituteId);

        List<StudentSessionInstituteGroupMapping> mappings = new ArrayList<>();
        BooleanWrapper skippedWrapper = new BooleanWrapper(!skipFirstWrapper.getValue());
        // Process learner choice packages
        processPackageSelections(
                packageSelection.getLearnerChoicePackages(),
                latestMapping,
                existingSessionIds,
                mappings,
                skippedWrapper
        );

        // Process pre-selected packages
        processPackageSelections(
                packageSelection.getPreSelectedPackages(),
                latestMapping,
                existingSessionIds,
                mappings,
                skippedWrapper
        );

        return mappings;
    }

    private void processPackageSelections(
            List<PackageSelectionDTO.PackageDTO> packages,
            StudentSessionInstituteGroupMapping latestMapping,
            List<String> existingSessionIds,
            List<StudentSessionInstituteGroupMapping> mappings,
            BooleanWrapper skippedWrapper) {

        if (packages == null) {
            return;
        }

        for (PackageSelectionDTO.PackageDTO packageDTO : packages) {
            if (packageDTO == null) continue;

            // Process learner choice sessions
            List<PackageSelectionDTO.SessionDTO> learnerChoiceSessions = packageDTO.getLearnerChoiceSessions();
            if (learnerChoiceSessions != null) {
                processSessionSelections(
                        learnerChoiceSessions,
                        packageDTO,
                        latestMapping,
                        existingSessionIds,
                        mappings,
                        skippedWrapper
                );
            }

            // Process pre-selected sessions
            List<PackageSelectionDTO.SessionDTO> preSelectedSessionDtos = packageDTO.getPreSelectedSessionDtos();
            if (preSelectedSessionDtos != null) {
                processSessionSelections(
                        preSelectedSessionDtos,
                        packageDTO,
                        latestMapping,
                        existingSessionIds,
                        mappings,
                        skippedWrapper
                );
            }
        }
    }

    private void processSessionSelections(
            List<PackageSelectionDTO.SessionDTO> sessions,
            PackageSelectionDTO.PackageDTO packageDTO,
            StudentSessionInstituteGroupMapping latestMapping,
            List<String> existingSessionIds,
            List<StudentSessionInstituteGroupMapping> mappings,
            BooleanWrapper skippedWrapper) {

        if (sessions == null) {
            return;
        }

        for (PackageSelectionDTO.SessionDTO sessionDTO : sessions) {
            if (sessionDTO == null) continue;

            // Process learner choice levels
            List<PackageSelectionDTO.LevelDTO> learnerChoiceLevels = sessionDTO.getLearnerChoiceLevels();
            if (learnerChoiceLevels != null) {
                processLevelSelections(
                        learnerChoiceLevels,
                        sessionDTO,
                        packageDTO,
                        latestMapping,
                        existingSessionIds,
                        mappings,
                        skippedWrapper
                );
            }

            // Process pre-selected levels
            List<PackageSelectionDTO.LevelDTO> preSelectedLevels = sessionDTO.getPreSelectedLevels();
            if (preSelectedLevels != null) {
                processLevelSelections(
                        preSelectedLevels,
                        sessionDTO,
                        packageDTO,
                        latestMapping,
                        existingSessionIds,
                        mappings,
                        skippedWrapper
                );
            }
        }
    }

    private void processLevelSelections(
            List<PackageSelectionDTO.LevelDTO> levels,
            PackageSelectionDTO.SessionDTO sessionDTO,
            PackageSelectionDTO.PackageDTO packageDTO,
            StudentSessionInstituteGroupMapping latestMapping,
            List<String> existingSessionIds,
            List<StudentSessionInstituteGroupMapping> mappings,
            BooleanWrapper skippedWrapper) {

        if (levels == null) {
            return;
        }

        for (PackageSelectionDTO.LevelDTO levelDTO : levels) {
            if (levelDTO == null) continue;
            if (skippedWrapper.getValue() == false){
                skippedWrapper.setValue(true);
                continue;
            }
            PackageSession session = findPackageSession(
                    levelDTO.getId(),
                    sessionDTO.getId(),
                    packageDTO.getId()
            );
            System.out.println(session);
            if (session != null && !existingSessionIds.contains(session.getId())) {
                mappings.add(buildSessionMapping(latestMapping, session));
            }
        }
    }

    // Wrapper class to simulate pass-by-reference for boolean
    private static class BooleanWrapper {
        private boolean value;

        public BooleanWrapper(boolean value) {
            this.value = value;
        }

        public boolean getValue() {
            return value;
        }

        public void setValue(boolean value) {
            this.value = value;
        }
    }

    private StudentSessionInstituteGroupMapping buildSessionMapping(
            StudentSessionInstituteGroupMapping template,
            PackageSession packageSession) {

        StudentSessionInstituteGroupMapping mapping = new StudentSessionInstituteGroupMapping();
        mapping.setId(UUID.randomUUID().toString());
        mapping.setInstitute(template.getInstitute());
        mapping.setUserId(template.getUserId());
        mapping.setEnrolledDate(new Date());
        mapping.setExpiryDate(makeExpiryDate(new Date(), DEFAULT_ACCESS_DAYS));
        mapping.setInstituteEnrolledNumber(template.getInstituteEnrolledNumber());
        mapping.setPackageSession(packageSession);
        mapping.setStatus(LearnerSessionStatusEnum.INVITED.name());
        return mapping;
    }

    private PackageSession findPackageSession(String levelId, String sessionId, String packageId) {
        Optional<PackageSession> packageSession = packageSessionRepository
                .findTopByLevelIdAndSessionIdAndPackageEntityIdAndStatusesOrderByCreatedAtDesc(
                        levelId, "DEFAULT-INVITATION-SESSION", packageId, ACTIVE_PACKAGE_STATUSES
                );

        if (packageSession.isPresent()) {
            return packageSession.get();
        } else {
            throw new VacademyException("Package session not found.");
        }
    }

    private PackageSession findFirstValidPackageSession(PackageSelectionDTO packageSelection) {
        if (packageSelection == null) {
            throw new VacademyException("Package selection is missing.");
        }

        // Search in learner choice packages first
        List<PackageSelectionDTO.PackageDTO> learnerChoicePackages = packageSelection.getLearnerChoicePackages();
        if (learnerChoicePackages != null) {
            for (PackageSelectionDTO.PackageDTO packageDTO : learnerChoicePackages) {
                if (packageDTO == null) continue;

                List<PackageSelectionDTO.SessionDTO> learnerChoiceSessions = packageDTO.getLearnerChoiceSessions();
                if (learnerChoiceSessions != null) {
                    for (PackageSelectionDTO.SessionDTO sessionDTO : learnerChoiceSessions) {
                        if (sessionDTO == null) continue;

                        List<PackageSelectionDTO.LevelDTO> learnerChoiceLevels = sessionDTO.getLearnerChoiceLevels();
                        if (learnerChoiceLevels != null) {
                            for (PackageSelectionDTO.LevelDTO levelDTO : learnerChoiceLevels) {
                                if (levelDTO == null) continue;
                                return findPackageSession(levelDTO.getId(), sessionDTO.getId(), packageDTO.getId());
                            }
                        }

                        List<PackageSelectionDTO.LevelDTO> preSelectedLevels = sessionDTO.getPreSelectedLevels();
                        if (preSelectedLevels != null) {
                            for (PackageSelectionDTO.LevelDTO levelDTO : preSelectedLevels) {
                                if (levelDTO == null) continue;
                                return findPackageSession(levelDTO.getId(), sessionDTO.getId(), packageDTO.getId());
                            }
                        }
                    }
                }

                List<PackageSelectionDTO.SessionDTO> preSelectedSessionDtos = packageDTO.getPreSelectedSessionDtos();
                if (preSelectedSessionDtos != null) {
                    for (PackageSelectionDTO.SessionDTO sessionDTO : preSelectedSessionDtos) {
                        if (sessionDTO == null) continue;

                        List<PackageSelectionDTO.LevelDTO> learnerChoiceLevels = sessionDTO.getLearnerChoiceLevels();
                        if (learnerChoiceLevels != null) {
                            for (PackageSelectionDTO.LevelDTO levelDTO : learnerChoiceLevels) {
                                if (levelDTO == null) continue;
                                return findPackageSession(levelDTO.getId(), sessionDTO.getId(), packageDTO.getId());
                            }
                        }

                        List<PackageSelectionDTO.LevelDTO> preSelectedLevels = sessionDTO.getPreSelectedLevels();
                        if (preSelectedLevels != null) {
                            for (PackageSelectionDTO.LevelDTO levelDTO : preSelectedLevels) {
                                if (levelDTO == null) continue;
                                return findPackageSession(levelDTO.getId(), sessionDTO.getId(), packageDTO.getId());
                            }
                        }
                    }
                }
            }
        }

        // If not found in learner choice, search in pre-selected packages
        List<PackageSelectionDTO.PackageDTO> preSelectedPackages = packageSelection.getPreSelectedPackages();
        if (preSelectedPackages != null) {
            for (PackageSelectionDTO.PackageDTO packageDTO : preSelectedPackages) {
                if (packageDTO == null) continue;

                List<PackageSelectionDTO.SessionDTO> learnerChoiceSessions = packageDTO.getLearnerChoiceSessions();
                if (learnerChoiceSessions != null) {
                    for (PackageSelectionDTO.SessionDTO sessionDTO : learnerChoiceSessions) {
                        if (sessionDTO == null) continue;

                        List<PackageSelectionDTO.LevelDTO> learnerChoiceLevels = sessionDTO.getLearnerChoiceLevels();
                        if (learnerChoiceLevels != null) {
                            for (PackageSelectionDTO.LevelDTO levelDTO : learnerChoiceLevels) {
                                if (levelDTO == null) continue;
                                return findPackageSession(levelDTO.getId(), sessionDTO.getId(), packageDTO.getId());
                            }
                        }

                        List<PackageSelectionDTO.LevelDTO> preSelectedLevels = sessionDTO.getPreSelectedLevels();
                        if (preSelectedLevels != null) {
                            for (PackageSelectionDTO.LevelDTO levelDTO : preSelectedLevels) {
                                if (levelDTO == null) continue;
                                return findPackageSession(levelDTO.getId(), sessionDTO.getId(), packageDTO.getId());
                            }
                        }
                    }
                }

                List<PackageSelectionDTO.SessionDTO> preSelectedSessionDtos = packageDTO.getPreSelectedSessionDtos();
                if (preSelectedSessionDtos != null) {
                    for (PackageSelectionDTO.SessionDTO sessionDTO : preSelectedSessionDtos) {
                        if (sessionDTO == null) continue;

                        List<PackageSelectionDTO.LevelDTO> learnerChoiceLevels = sessionDTO.getLearnerChoiceLevels();
                        if (learnerChoiceLevels != null) {
                            for (PackageSelectionDTO.LevelDTO levelDTO : learnerChoiceLevels) {
                                if (levelDTO == null) continue;
                                return findPackageSession(levelDTO.getId(), sessionDTO.getId(), packageDTO.getId());
                            }
                        }

                        List<PackageSelectionDTO.LevelDTO> preSelectedLevels = sessionDTO.getPreSelectedLevels();
                        if (preSelectedLevels != null) {
                            for (PackageSelectionDTO.LevelDTO levelDTO : preSelectedLevels) {
                                if (levelDTO == null) continue;
                                return findPackageSession(levelDTO.getId(), sessionDTO.getId(), packageDTO.getId());
                            }
                        }
                    }
                }
            }
        }

        throw new VacademyException("Please select at least one batch.");
    }

    // Data Access Methods ======================================================

    private LearnerInvitation getValidInvitation(String invitationId) {
        return learnerInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new VacademyException("Learner invitation not found"));
    }

    private LearnerInvitation getValidInvitationByCode(String instituteId, String inviteCode) {
        LearnerInvitation invitation = learnerInvitationRepository
                .findByInstituteIdAndInviteCodeAndStatus(
                        instituteId,
                        inviteCode,
                        List.of(LearnerInvitationCodeStatusEnum.ACTIVE.name()),
                        List.of(CustomFieldStatusEnum.ACTIVE.name())
                )
                .orElseThrow(() -> new VacademyException("This invite link is closed. Please contact the institute for further support."));

        if (invitation.getExpiryDate().before(new Date())) {
            throw new VacademyException("This invite code is expired. Please contact the institute for further support.");
        }

        return invitation;
    }

    private Optional<Student> findExistingStudent(String email, String instituteId) {
        return instituteStudentRepository
                .findTopStudentByEmailAndInstituteIdOrderByMappingCreatedAtDesc(email, instituteId);
    }

    private Student findCreatedStudent(String email, String instituteId) {
        return instituteStudentRepository
                .findTopStudentByEmailAndInstituteIdOrderByMappingCreatedAtDesc(email, instituteId)
                .orElseThrow(() -> new VacademyException("Student creation failed"));
    }

    private StudentSessionInstituteGroupMapping getLatestStudentMapping(String userId, String instituteId) {
        return studentSessionRepository
                .findTopByUserIdAndInstituteIdOrderByCreatedAtDesc(userId, instituteId)
                .orElseThrow(() -> new VacademyException("Student session not found"));
    }

    private List<String> getExistingInvitedSessionIds(String userId, String instituteId) {
        return studentSessionRepository
                .findAllByInstituteIdAndUserIdAndStatusIn(instituteId, userId, INVITED_STATUSES)
                .stream()
                .map(mapping -> mapping.getPackageSession().getId())
                .collect(Collectors.toList());
    }

    private Institute getInstitute(String instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found"));
    }

    private List<LearnerInvitationResponse> updateResponseStatuses(LearnerInvitationRequestStatusChangeDTO statusChangeDTO) {
        List<LearnerInvitationResponse> responses = learnerInvitationResponseRepository
                .findAllById(statusChangeDTO.getLearnerInvitationResponseIds());

        responses.forEach(response -> {
            response.setStatus(statusChangeDTO.getStatus());
            response.setMessageByInstitute(statusChangeDTO.getDescription());
        });

        return learnerInvitationResponseRepository.saveAll(responses);
    }

    // DTO Building Methods =====================================================

    private InstituteStudentDTO buildStudentDTO(LearnerInvitationResponseDTO responseDTO) {
        InstituteStudentDTO studentDTO = new InstituteStudentDTO();
        UserDTO userDTO = new UserDTO();
        userDTO.setEmail(responseDTO.getEmail());
        userDTO.setFullName(responseDTO.getFullName());
        userDTO.setMobileNumber(responseDTO.getContactNumber());
        studentDTO.setUserDetails(userDTO);
        return studentDTO;
    }

    private InstituteStudentDetails buildStudentDetails(String instituteId, PackageSession packageSession) {
        InstituteStudentDetails details = new InstituteStudentDetails();
        details.setInstituteId(instituteId);
        details.setPackageSessionId(packageSession.getId());
        details.setEnrollmentStatus(LearnerSessionStatusEnum.INVITED.name());
        return details;
    }

    private LearnerInvitationFormDTO buildInvitationFormDTO(LearnerInvitation invitation, Institute institute) {
        LearnerInvitationFormDTO formDTO = new LearnerInvitationFormDTO();
        formDTO.setLearnerInvitation(invitation.mapToDTO());
        formDTO.setInstituteName(institute.getInstituteName());
        formDTO.setInstituteLogoFileId(institute.getLogoFileId());
        return formDTO;
    }

    // Utility Methods ==========================================================

    private PackageSelectionDTO parsePackageSelection(String batchSelectionJson) {
        try {
            return objectMapper.readValue(batchSelectionJson, PackageSelectionDTO.class);
        } catch (JsonProcessingException e) {
            throw new VacademyException("Error occurred while processing your request");
        }
    }

    private void sendStatusUpdateNotifications(List<LearnerInvitationResponse> responses) {
        if (!responses.isEmpty()) {
            List<String> emails = responses.stream()
                    .map(LearnerInvitationResponse::getEmail)
                    .collect(Collectors.toList());

            Institute institute = getInstitute(responses.get(0).getInstituteId());
            notification.sendStatusUpdateNotification(emails, institute.getInstituteName(), institute.getId());
        }
    }

    public Date makeExpiryDate(Date enrollmentDate, int accessDays) {
        try {
            Date expiryDate = new Date();
            expiryDate.setTime(enrollmentDate.getTime() + (long) accessDays * 24 * 60 * 60 * 1000);
            return expiryDate;
        } catch (Exception e) {
            return null;
        }
    }

    // Validation Methods =======================================================

    private void validateRegistrationRequest(LearnerInvitationResponseDTO responseDTO) {
        Objects.requireNonNull(responseDTO, "learnerInvitationResponseDTO cannot be null");

        if (!StringUtils.hasText(responseDTO.getEmail())) {
            throw new VacademyException("Email is required");
        }
        if (!StringUtils.hasText(responseDTO.getFullName())) {
            throw new VacademyException("Full name is required");
        }
        if (!StringUtils.hasText(responseDTO.getContactNumber())) {
            throw new VacademyException("Contact number is required");
        }
        if (!StringUtils.hasText(responseDTO.getInstituteId())) {
            throw new VacademyException("Institute id is required");
        }
        if (!StringUtils.hasText(responseDTO.getLearnerInvitationId())) {
            throw new VacademyException("Learner invitation id is required");
        }

        validateDuplicateRegistration(responseDTO);
    }

    private void validateDuplicateRegistration(LearnerInvitationResponseDTO responseDTO) {
        Optional<LearnerInvitationResponse> existingResponse = learnerInvitationResponseRepository
                .findByEmailAndLearnerInvitationIdAndStatusIn(
                        responseDTO.getEmail(),
                        responseDTO.getLearnerInvitationId(),
                        List.of(
                                LearnerInvitationResponseStatusEnum.ACTIVE.name(),
                                LearnerInvitationResponseStatusEnum.ACCEPTED.name()
                        )
                );

        if (existingResponse.isPresent()) {
            throw new VacademyException("Learner with email " + responseDTO.getEmail() + " has already registered");
        }
    }

    private void validateStatusChangeRequest(LearnerInvitationRequestStatusChangeDTO statusChangeDTO) {
        Objects.requireNonNull(statusChangeDTO, "Status change request cannot be null");

        if (statusChangeDTO.getLearnerInvitationResponseIds() == null ||
                statusChangeDTO.getLearnerInvitationResponseIds().isEmpty()) {
            throw new VacademyException("Response IDs are required");
        }
        if (!StringUtils.hasText(statusChangeDTO.getStatus())) {
            throw new VacademyException("Status is required");
        }
    }

    private void validatePaginationParameters(int pageNo, int pageSize) {
        if (pageNo < 0) {
            throw new VacademyException("Page number cannot be negative");
        }
        if (pageSize <= 0) {
            throw new VacademyException("Page size must be positive");
        }
    }
}