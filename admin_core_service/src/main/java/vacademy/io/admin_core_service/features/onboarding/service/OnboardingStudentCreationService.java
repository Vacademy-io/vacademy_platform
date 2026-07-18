package vacademy.io.admin_core_service.features.onboarding.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingInstance;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStepInstance;
import vacademy.io.admin_core_service.features.onboarding.repository.OnboardingInstanceRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.parent_link.dto.ParentLinkActionRequestDTO;
import vacademy.io.admin_core_service.features.parent_link.dto.ParentLinkActionResponseDTO;
import vacademy.io.admin_core_service.features.parent_link.service.ParentLinkService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.InvalidRequestException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Date;
import java.util.List;
import java.util.Optional;

/**
 * v1 simplification: creates the minimal {@code student} + {@code student_session_institute_group_mapping}
 * rows needed to consider the subject "enrolled" against an explicit package_session_id
 * (per the FORM step's step_type_config). This intentionally does not replicate the full
 * paid-enrollment funnel (invites/payment/user_plan) -- those don't apply to an
 * onboarding-triggered, typically-free enrollment. Extend here if a future step type needs
 * to route through the funnel instead.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OnboardingStudentCreationService {

    private final OnboardingInstanceRepository onboardingInstanceRepository;
    private final InstituteStudentRepository instituteStudentRepository;
    private final StudentSessionRepository studentSessionRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final InstituteRepository instituteRepository;
    private final AuthService authService;
    private final ParentLinkService parentLinkService;

    /**
     * Leads can be filled out by either the student themselves or a parent on their behalf. When
     * {@code isParent} is true, {@code instance.subjectUserId} (whoever the lead form was
     * originally captured against) is NOT the person any onboarding side effect should target --
     * it's their parent. Resolves/creates the real student via the existing guardian-link
     * mechanism (the same one the assign-learner dialog uses) and reassigns the instance to them,
     * so every side effect from here on (role grant, credentials email, course enrollment, later
     * steps) targets the actual student. Called once per step-instance completion by
     * {@link OnboardingStepInstanceService#completeStep}, before ANY identity-touching side
     * effect runs -- not just the create_student one -- since "grant STUDENT role" and "send
     * credentials" can each live on their own, earlier step.
     */
    public void resolveSubjectUserId(OnboardingInstance instance, boolean isParent, String studentFullName,
                                      String studentEmail, String studentMobileNumber) {
        if (!isParent) return;

        // Guards against a step being (re)completed with is_parent=true after a PRIOR step on
        // this same instance already resolved the real student -- without this, the already-
        // resolved child would get treated as a parent adding a second, spurious new student.
        List<UserDTO> currentSubject = authService.getUsersFromAuthServiceByUserIds(List.of(instance.getSubjectUserId()));
        if (!currentSubject.isEmpty() && StringUtils.hasText(currentSubject.get(0).getLinkedParentId())) {
            log.info("Subject {} is already a linked child (parent {}); skipping duplicate parent resolution",
                    instance.getSubjectUserId(), currentSubject.get(0).getLinkedParentId());
            return;
        }

        if (!StringUtils.hasText(studentFullName)
                || (!StringUtils.hasText(studentEmail) && !StringUtils.hasText(studentMobileNumber))) {
            throw new InvalidRequestException(
                    "Student name and email or mobile number are required when filling on behalf of a parent.");
        }
        ParentLinkActionRequestDTO linkRequest = ParentLinkActionRequestDTO.builder()
                .instituteId(instance.getInstituteId())
                .direction("PARENT_ADDS_STUDENT")
                .mode("CREATE_NEW")
                .anchorUserId(instance.getSubjectUserId())
                .newFullName(studentFullName)
                .newEmail(studentEmail)
                .newMobileNumber(studentMobileNumber)
                .build();
        ParentLinkActionResponseDTO linkResponse = parentLinkService.link(linkRequest);
        instance.setSubjectUserId(linkResponse.getStudentUserId());
        onboardingInstanceRepository.save(instance);
    }

    public void createStudentIfAbsent(OnboardingStepInstance stepInstance, String packageSessionId) {
        if (!StringUtils.hasText(packageSessionId)) {
            log.warn("onboarding step configured to create a student but no packageSessionId set (stepInstance {})",
                    stepInstance.getId());
            return;
        }

        Optional<OnboardingInstance> instanceOpt =
                onboardingInstanceRepository.findById(stepInstance.getOnboardingInstanceId());
        if (instanceOpt.isEmpty()) {
            log.warn("onboarding_instance {} not found for step instance {}",
                    stepInstance.getOnboardingInstanceId(), stepInstance.getId());
            return;
        }
        OnboardingInstance instance = instanceOpt.get();
        String instituteId = instance.getInstituteId();
        String subjectUserId = instance.getSubjectUserId();

        authService.addRolesToUserInternal(subjectUserId, List.of("STUDENT"), instituteId);

        List<Student> existingStudents = instituteStudentRepository.findByUserId(subjectUserId);
        if (existingStudents.isEmpty()) {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(subjectUserId));
            UserDTO user = users.isEmpty() ? null : users.get(0);
            Student student = Student.builder()
                    .userId(subjectUserId)
                    .username(user != null ? user.getUsername() : null)
                    .email(user != null ? user.getEmail() : null)
                    .fullName(user != null ? (user.getFullName()) : null)
                    .mobileNumber(user != null ? user.getMobileNumber() : null)
                    .build();
            instituteStudentRepository.save(student);
        }

        boolean alreadyEnrolled = !studentSessionRepository
                .findByUserIdAndPackageSession_IdAndStatus(subjectUserId, packageSessionId, "ACTIVE")
                .isEmpty();
        if (alreadyEnrolled) {
            log.info("Subject {} already has an ACTIVE enrollment in package session {}, skipping duplicate row (stepInstance {})",
                    subjectUserId, packageSessionId, stepInstance.getId());
            return;
        }

        Optional<PackageSession> packageSession = packageSessionRepository.findById(packageSessionId);
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (packageSession.isEmpty() || institute.isEmpty()) {
            log.warn("Cannot create ssigm row: packageSession {} or institute {} not found",
                    packageSessionId, instituteId);
            return;
        }

        StudentSessionInstituteGroupMapping mapping = new StudentSessionInstituteGroupMapping();
        mapping.setUserId(subjectUserId);
        mapping.setPackageSession(packageSession.get());
        mapping.setInstitute(institute.get());
        mapping.setStatus("ACTIVE");
        mapping.setEnrolledDate(new Date());
        mapping.setSource("ONBOARDING");
        mapping.setType("ONBOARDING_STEP");
        mapping.setTypeId(stepInstance.getStepId());
        studentSessionRepository.save(mapping);
    }
}
