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
     * mechanism (the same one the assign-learner dialog uses) and records them as
     * resolvedSubjectUserId -- subjectUserId itself is NEVER reassigned, so the instance stays
     * visible under the same lead/student side-view it was started from. Every side effect from
     * here on (role grant, credentials email, course enrollment, later steps) targets
     * {@link OnboardingInstance#getEffectiveSubjectUserId()}. Called once per step-instance
     * completion by {@link OnboardingStepInstanceService#completeStep}, before ANY
     * identity-touching side effect runs -- not just the create_student one -- since "grant
     * STUDENT role" and "send credentials" can each live on their own, earlier step.
     */
    public void resolveSubjectUserId(OnboardingInstance instance, boolean isParent, String studentFullName,
                                      String studentEmail, String studentMobileNumber) {
        if (!isParent) return;

        // Row-locks the instance before the check-then-act below: two near-simultaneous
        // completions of the same step-instance (double-click, client retry) could otherwise
        // both read resolvedSubjectUserId as null before either commits, each call
        // parentLinkService.link, and create two separate child accounts. A concurrent second
        // transaction blocks on this call until the first commits. Same managed entity as
        // `instance` within this transaction (JPA identity map) -- just forces the DB-level lock.
        instance = onboardingInstanceRepository.findByIdForUpdate(instance.getId()).orElse(instance);

        // Guards against a step being (re)completed with is_parent=true after a PRIOR step on
        // this same instance already resolved the real student -- without this, the already-
        // resolved child would get treated as a parent adding a second, spurious new student.
        if (StringUtils.hasText(instance.getResolvedSubjectUserId())) {
            log.info("Onboarding instance {} already has a resolved student ({}); skipping duplicate parent resolution",
                    instance.getId(), instance.getResolvedSubjectUserId());
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
        instance.setResolvedSubjectUserId(linkResponse.getStudentUserId());
        onboardingInstanceRepository.save(instance);
    }

    /**
     * Whether the subject already has an ACTIVE enrollment in ANY course at this institute --
     * used by the "assign course" step's optional skip-course-selection setting, so a step
     * whose only job was "get the student enrolled" can complete without asking the admin to
     * pick a course again for someone who's already enrolled (e.g. from an earlier onboarding
     * instance, or enrolled outside onboarding entirely).
     */
    public boolean subjectAlreadyHasActiveEnrollment(OnboardingStepInstance stepInstance) {
        Optional<OnboardingInstance> instanceOpt =
                onboardingInstanceRepository.findById(stepInstance.getOnboardingInstanceId());
        if (instanceOpt.isEmpty()) return false;
        OnboardingInstance instance = instanceOpt.get();
        String subjectUserId = instance.getEffectiveSubjectUserId();
        if (!StringUtils.hasText(subjectUserId)) return false;
        return !studentSessionRepository
                .findAllByInstituteIdAndUserIdAndStatusIn(instance.getInstituteId(), subjectUserId, List.of("ACTIVE"))
                .isEmpty();
    }

    /**
     * {@code packageSessionId} is blank exactly when the "assign course" step's
     * skip-course-selection setting let the admin complete without picking one -- already
     * verified (by the caller, via {@link #subjectAlreadyHasActiveEnrollment}) that the subject
     * has an active enrollment elsewhere. Still grants the STUDENT role and ensures a
     * {@code student} row exists (both idempotent), just skips creating another enrollment row.
     */
    public void createStudentIfAbsent(OnboardingStepInstance stepInstance, String packageSessionId) {
        Optional<OnboardingInstance> instanceOpt =
                onboardingInstanceRepository.findById(stepInstance.getOnboardingInstanceId());
        if (instanceOpt.isEmpty()) {
            log.warn("onboarding_instance {} not found for step instance {}",
                    stepInstance.getOnboardingInstanceId(), stepInstance.getId());
            return;
        }
        OnboardingInstance instance = instanceOpt.get();
        String instituteId = instance.getInstituteId();
        String subjectUserId = instance.getEffectiveSubjectUserId();

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

        if (!StringUtils.hasText(packageSessionId)) {
            log.info("No packageSessionId for stepInstance {} (subject {} already enrolled elsewhere) -- role/student row ensured, skipping enrollment",
                    stepInstance.getId(), subjectUserId);
            return;
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
