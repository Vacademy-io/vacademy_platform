package vacademy.io.admin_core_service.features.institute_learner.service;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldTypeEnum;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldValueSourceTypeEnum;
import vacademy.io.admin_core_service.features.common.service.CustomFieldValueService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.service.SubOrgService;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentExtraDetails;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentRegistrationManager;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.institute_learner.dto.BulkLearnerApprovalRequestDTO;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.service.ReferralMappingService;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerExtraDetails;
import vacademy.io.common.common.dto.CustomFieldValueDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class LearnerBatchEnrollService {

    @Autowired
    private InstituteStudentRepository instituteStudentRepository;

    @Autowired
    private StudentRegistrationManager studentRegistrationManager;

    @Autowired
    private CustomFieldValueService customFieldValueService;

    @Autowired
    private StudentSessionRepository studentSessionRepository;

    @Autowired
    private UserPlanService userPlanService;

    @Autowired
    private ReferralMappingService referralMappingService;

    @Autowired
    private AuthService authService;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private SubOrgService subOrgService;

    @Transactional
    public UserDTO checkAndCreateStudentAndAddToBatch(UserDTO userDTO,
                                                      String instituteId,
                                                      List<InstituteStudentDetails> instituteStudentDetails,
                                                      List<CustomFieldValueDTO>customFieldValues,
                                                      Map<String, Object> extraData,
                                                      LearnerExtraDetails learnerExtraDetails,
                                                      EnrollInvite enrollInvite) {
        UserDTO createdUser = studentRegistrationManager.createUserFromAuthService(userDTO, instituteId, false);
        Student student = studentRegistrationManager.createStudentFromRequest(createdUser, mapToStudentExtraDetails(learnerExtraDetails));
        for (InstituteStudentDetails instituteStudentDetail : instituteStudentDetails) {
            PackageSession packageSession = null;
            if (StringUtils.hasText(instituteStudentDetail.getDestinationPackageSessionId())){
               packageSession = packageSessionRepository.findById(instituteStudentDetail.getDestinationPackageSessionId()).get();
            }else{
                packageSession = packageSessionRepository.findById(instituteStudentDetail.getPackageSessionId()).get();
            }
            if (packageSession.getIsOrgAssociated()){
                Institute suborg = subOrgService.createOrGetSubOrg(customFieldValues,enrollInvite.getSettingJson(),userDTO.getId(),packageSession.getId(),instituteId);
                String commaSepratedRoles = subOrgService.getRoles(customFieldValues,enrollInvite.getSettingJson());
                if (suborg == null || StringUtils.isEmpty(commaSepratedRoles)){
                    throw new VacademyException("Sub Org can not be created. Data not passed!!!");
                }
                instituteStudentDetail.setSubOrgId(suborg.getId());
                instituteStudentDetail.setCommaSeparatedOrgRoles(commaSepratedRoles);
            }
          String studentSessionId =  studentRegistrationManager.linkStudentToInstitute(student, instituteStudentDetail);
            if (instituteStudentDetail.getEnrollmentStatus().equalsIgnoreCase(LearnerSessionStatusEnum.ACTIVE.name())){
                studentRegistrationManager.triggerEnrollmentWorkflow(instituteId,userDTO,instituteStudentDetail.getPackageSessionId());
            }
            customFieldValueService.addCustomFieldValue(customFieldValues, CustomFieldValueSourceTypeEnum.STUDENT_SESSION_INSTITUTE_GROUP_MAPPING.name(), studentSessionId);
            customFieldValueService.addCustomFieldValue(customFieldValues, CustomFieldValueSourceTypeEnum.USER.name(), userDTO.getId());
        }
        return createdUser;
    }

    private StudentExtraDetails mapToStudentExtraDetails(LearnerExtraDetails learnerExtraDetails){
        if (learnerExtraDetails == null){
            return null;
        }
        StudentExtraDetails studentExtraDetails = new StudentExtraDetails();
        studentExtraDetails.setFathersName(learnerExtraDetails.getFathersName());
        studentExtraDetails.setMothersName(learnerExtraDetails.getMothersName());
        studentExtraDetails.setParentsMobileNumber(learnerExtraDetails.getParentsMobileNumber());
        studentExtraDetails.setParentsEmail(learnerExtraDetails.getParentsEmail());
        studentExtraDetails.setParentsToMotherMobileNumber(learnerExtraDetails.getParentsToMotherMobileNumber());
        studentExtraDetails.setParentsToMotherEmail(learnerExtraDetails.getParentsToMotherEmail());
        studentExtraDetails.setLinkedInstituteName(learnerExtraDetails.getLinkedInstituteName());
        return studentExtraDetails;
    }

    public void shiftLearnerFromInvitedToActivePackageSessions(List<String> packageSessionIds, String userId, String enrollInviteId) {
        shiftLearnerToActiveStatus(packageSessionIds, userId, enrollInviteId, LearnerStatusEnum.INVITED);
    }

    public void shiftLearnerFromPendingForApprovalToActivePackageSessions(List<String> packageSessionIds, String userId, String enrollInviteId) {
        shiftLearnerToActiveStatus(packageSessionIds, userId, enrollInviteId, LearnerStatusEnum.PENDING_FOR_APPROVAL);
    }

    private void shiftLearnerToActiveStatus(List<String> packageSessionIds, String userId, String enrollInviteId, LearnerStatusEnum fromStatus) {
        List<StudentSessionInstituteGroupMapping> invitedMappings = studentSessionRepository
                .findByDestinationPackageSession_IdInAndUserIdAndStatusIn(
                        packageSessionIds, userId, List.of(fromStatus.name())
                );

        UserDTO userDTO = authService.getUsersFromAuthServiceWithPasswordByUserId(userId);


        for (StudentSessionInstituteGroupMapping mapping : invitedMappings) {
            if (mapping.getDestinationPackageSession() != null) {
                String newSessionId = studentRegistrationManager.shiftStudentBatch(
                        mapping,
                        LearnerStatusEnum.ACTIVE.name()
                );
                studentRegistrationManager.triggerEnrollmentWorkflow(mapping.getInstitute().getId(),userDTO,mapping.getDestinationPackageSession().getId());
                customFieldValueService.shiftCustomField(
                        CustomFieldValueSourceTypeEnum.STUDENT_SESSION_INSTITUTE_GROUP_MAPPING.name(),
                        mapping.getId(),
                        newSessionId,
                        CustomFieldTypeEnum.ENROLL_INVITE.name(),
                        enrollInviteId
                );


                customFieldValueService.shiftCustomField(
                    CustomFieldValueSourceTypeEnum.USER.name(),
                    mapping.getId(),
                    newSessionId,
                    CustomFieldTypeEnum.ENROLL_INVITE.name(),
                    enrollInviteId
                );

                if (invitedMappings.size() > 0){
                    String userPlanId = invitedMappings.get(0).getUserPlanId();
                    UserPlan userPlan = userPlanService.findById(userPlanId);
                    referralMappingService.processReferralBenefitsIfApplicable(userPlan);
                }
            }
        }
    }

    /**
     * Process bulk learner approval requests
     * @param request The bulk approval request containing multiple items
     * @return A result object with success count and total count
     */
    public BulkApprovalResult processBulkLearnerApproval(BulkLearnerApprovalRequestDTO request) {
        log.info("Processing bulk learner approval request with {} items", request != null ? request.getItems().size() : 0);

        if (request == null || request.getItems() == null || request.getItems().isEmpty()) {
            log.warn("Bulk approval request is null or empty");
            return new BulkApprovalResult(0, 0, "Request cannot be null or empty");
        }

        int successCount = 0;
        int totalCount = request.getItems().size();

        // Process each item in the bulk request
        for (BulkLearnerApprovalRequestDTO.LearnerApprovalItem item : request.getItems()) {
            try {
                // Validate individual item
                if (item.getPackageSessionIds() == null || item.getPackageSessionIds().isEmpty() ||
                    item.getUserId() == null || item.getUserId().trim().isEmpty() ||
                    item.getEnrollInviteId() == null || item.getEnrollInviteId().trim().isEmpty()) {
                    log.warn("Skipping invalid item: userId={}, enrollInviteId={}, packageSessionIds={}",
                            item.getUserId(), item.getEnrollInviteId(), item.getPackageSessionIds());
                    continue; // Skip invalid items
                }

                log.debug("Processing item: userId={}, enrollInviteId={}, packageSessionIds={}",
                         item.getUserId(), item.getEnrollInviteId(), item.getPackageSessionIds());

                shiftLearnerFromPendingForApprovalToActivePackageSessions(
                    item.getPackageSessionIds(),
                    item.getUserId(),
                    item.getEnrollInviteId()
                );
                successCount++;
                log.debug("Successfully processed item for userId: {}", item.getUserId());
            } catch (Exception e) {
                // Log error but continue processing other items
                log.error("Error processing item for userId: {}, enrollInviteId: {}, error: {}",
                         item.getUserId(), item.getEnrollInviteId(), e.getMessage(), e);
                continue;
            }
        }

        String message;
        if (successCount == 0) {
            message = "No items were processed successfully";
        } else if (successCount < totalCount) {
            message = String.format("Bulk approval partially successful: %d/%d items processed", successCount, totalCount);
        } else {
            message = String.format("Bulk approval successful: %d items processed", successCount);
        }

        log.info("Bulk approval completed: {}/{} items processed successfully", successCount, totalCount);
        return new BulkApprovalResult(successCount, totalCount, message);
    }

    /**
     * Result class for bulk approval operations
     */
    public static class BulkApprovalResult {
        private final int successCount;
        private final int totalCount;
        private final String message;

        public BulkApprovalResult(int successCount, int totalCount, String message) {
            this.successCount = successCount;
            this.totalCount = totalCount;
            this.message = message;
        }

        public int getSuccessCount() { return successCount; }
        public int getTotalCount() { return totalCount; }
        public String getMessage() { return message; }
        public boolean isFullySuccessful() { return successCount == totalCount; }
        public boolean isPartiallySuccessful() { return successCount > 0 && successCount < totalCount; }
        public boolean isFailed() { return successCount == 0; }
    }
}
