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
import vacademy.io.common.auth.dto.UserDTO;
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
        String subjectUserId = instance.getSubjectUserId();
        String instituteId = instance.getInstituteId();

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
