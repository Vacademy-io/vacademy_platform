package vacademy.io.admin_core_service.features.enrollment_policy.processor;


import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.aot.generate.ValueCodeGenerationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.OnExpiryPolicyDTO;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionSourceEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionTypeEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.learner_invitation.repository.LearnerInvitationRepository;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class FinalExpiryProcessor implements IEnrolmentPolicyProcessor {

            private final StudentSessionInstituteGroupMappingRepository mappingRepository;
            private final LearnerInvitationRepository learnerInvitationRepository;
            private final PackageSessionRepository packageSessionRepository;
            private final StudentSessionRepository studentSessionRepository;
            private final UserPlanService userPlanService;

            @Override
            @Transactional
            public void process(EnrolmentContext context) {
                OnExpiryPolicyDTO expiryPolicy = context.getPolicy().getOnExpiry();
                if (expiryPolicy == null) {
                    log.warn("No onExpiry policy for mapping {}. No final action taken.", context.getMapping().getId());
                    return;
                }

                LearnerSessionStatusEnum finalStatus = LearnerSessionStatusEnum.INVITED;

                if (finalStatus == null) {
                    log.warn("No finalStatusOnGracePeriodEnd for mapping {}. No final action taken.", context.getMapping().getId());
                    return;
                }

                StudentSessionInstituteGroupMapping mapping = context.getMapping();
                mapping.setStatus(LearnerSessionStatusEnum.EXPIRED.name());
                mappingRepository.save(mapping);
                log.info("Updated mapping {} to status {}", mapping.getId(), finalStatus);
                createInvitedEntry(mapping);
                String userPlanId = mapping.getUserPlanId();
                if (StringUtils.hasText(userPlanId)){
                    UserPlan userPlan = userPlanService.findById(userPlanId);
                    userPlan.setStatus(UserPlanStatusEnum.EXPIRED.name());
                    userPlanService.saveUserPlan(userPlan);
                }

            }

            private StudentSessionInstituteGroupMapping createInvitedEntry(StudentSessionInstituteGroupMapping mapping) {


                StudentSessionInstituteGroupMapping invited = new StudentSessionInstituteGroupMapping();


                invited.setUserId(mapping.getUserId());
                invited.setInstituteEnrolledNumber(mapping.getInstituteEnrolledNumber());
                invited.setEnrolledDate(new Date());


                invited.setStatus(LearnerSessionStatusEnum.INVITED.name());

                invited.setGroup(mapping.getGroup());
                invited.setInstitute(mapping.getInstitute());
                invited.setPackageSession(getInvitedPackageSession(mapping.getPackageSession()));
                invited.setDestinationPackageSession(mapping.getPackageSession());

                // Copy additional identifiers
                invited.setUserPlanId(mapping.getUserPlanId());
                invited.setType(LearnerSessionTypeEnum.PACKAGE_SESSION.name());
                invited.setTypeId(mapping.getPackageSession().getId());
                invited.setSource(LearnerSessionSourceEnum.EXPIRED.name());
                invited.setDesiredLevelId(mapping.getDesiredLevelId());
                invited.setDesiredPackageId(mapping.getDesiredPackageId());
                invited.setAutomatedCompletionCertificateFileId(mapping.getAutomatedCompletionCertificateFileId());
                studentSessionRepository.deleteByUserTypeSourcePackageInstitute(
                        mapping.getUserId(),
                        mapping.getPackageSession().getId(),
                        LearnerSessionSourceEnum.EXPIRED.name(),
                        LearnerSessionTypeEnum.PACKAGE_SESSION.name(),
                        invited.getPackageSession().getId(),
                        invited.getInstitute().getId()
                );
                mappingRepository.save(invited);
                return invited;
            }

            private PackageSession getInvitedPackageSession(PackageSession packageSession){
                String packageSessionId = packageSession.getId();
                return packageSessionRepository
                        .findInvitedPackageSessionForPackage(
                                packageSessionId,
                                "INVITED", // levelId (placeholder — ensure correct value)
                                "INVITED", // sessionId (placeholder — ensure correct value)
                                List.of(PackageSessionStatusEnum.INVITED.name()),
                                List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                                List.of(PackageStatusEnum.ACTIVE.name())).orElseThrow(()-> new VacademyException("No Invited package session found"));
            }

}
