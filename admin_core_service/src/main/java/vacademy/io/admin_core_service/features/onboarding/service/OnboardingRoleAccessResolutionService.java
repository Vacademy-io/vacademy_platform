package vacademy.io.admin_core_service.features.onboarding.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingRoleAccessDTO;
import vacademy.io.admin_core_service.features.onboarding.dto.OnboardingStepFieldConfigDTO;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStep;
import vacademy.io.admin_core_service.features.onboarding.enums.OnboardingRoleKey;
import vacademy.io.admin_core_service.features.onboarding.repository.OnboardingStepRepository;
import vacademy.io.admin_core_service.features.parent_link.service.ParentLinkService;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;
import java.util.Optional;

/**
 * Resolves the effective view/edit access for a role at step and field level.
 * ADMIN always short-circuits to full access. For STUDENT/PARENT, a field-level entry (if
 * present) overrides the step-level default; absence of any entry defaults to
 * can_view=true, can_edit=false (safe default: visible, not editable).
 *
 * <p>Role access (and the FORM step's field list) is stored as JSON directly on
 * {@link OnboardingStep#getRoleAccess()} / {@link OnboardingStep#getFieldsConfig()} rather than
 * in separate join tables -- both are small, bounded sets always read/written as a whole.
 */
@Service
@RequiredArgsConstructor
public class OnboardingRoleAccessResolutionService {

    private final OnboardingStepRepository onboardingStepRepository;
    private final ParentLinkService parentLinkService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @AllArgsConstructor
    public static class EffectiveAccess {
        public final boolean canView;
        public final boolean canEdit;
    }

    /** Resolves whether the caller is ADMIN/STUDENT/PARENT for onboarding purposes.
     *  ADMIN is any caller acting through the institute-admin surface (not a lead/learner);
     *  STUDENT/PARENT are resolved from the auth_service user's is_parent/linked_parent_id
     *  linkage: a user with is_parent=true is PARENT, everyone else acting as the subject
     *  (or a linked child) is STUDENT. */
    public String resolveRoleKey(boolean callerIsAdminSurface, UserDTO callerUser) {
        if (callerIsAdminSurface) {
            return OnboardingRoleKey.ADMIN.name();
        }
        if (callerUser != null && Boolean.TRUE.equals(callerUser.getIsParent())) {
            return OnboardingRoleKey.PARENT.name();
        }
        return OnboardingRoleKey.STUDENT.name();
    }

    /**
     * True if {@code callerId} is the linked guardian (parent) of {@code subjectUserId}, per
     * auth_service's {@code users.linked_parent_id} -- lets a parent with their OWN separate
     * login act on a child's onboarding instance, not just the exact subject/resolved-subject
     * account itself. Pure DB-relationship check (no JWT authority / institute / enrolment
     * assumptions), consistent with how {@link #resolveRoleKey} already trusts the DB
     * {@code is_parent} flag rather than any JWT claim.
     */
    public boolean isLinkedGuardianOf(String callerId, String subjectUserId) {
        if (!StringUtils.hasText(callerId) || !StringUtils.hasText(subjectUserId)) return false;
        UserDTO parent = parentLinkService.getParentOfStudent(subjectUserId);
        return parent != null && callerId.equals(parent.getId());
    }

    public EffectiveAccess resolveStepAccess(String stepId, String roleKey) {
        if (OnboardingRoleKey.ADMIN.name().equals(roleKey)) {
            return new EffectiveAccess(true, true);
        }
        Optional<OnboardingStep> step = onboardingStepRepository.findById(stepId);
        List<OnboardingRoleAccessDTO> rows = step.map(s -> parseRoleAccess(s.getRoleAccess())).orElse(List.of());
        return effectiveFrom(rows, roleKey).orElse(new EffectiveAccess(true, false));
    }

    /** {@code instituteCustomFieldId} identifies the field entry within the step's fields_config JSON. */
    public EffectiveAccess resolveFieldAccess(String stepId, String instituteCustomFieldId, String roleKey) {
        if (OnboardingRoleKey.ADMIN.name().equals(roleKey)) {
            return new EffectiveAccess(true, true);
        }
        Optional<OnboardingStep> step = onboardingStepRepository.findById(stepId);
        List<OnboardingRoleAccessDTO> fieldRows = step
                .map(OnboardingStep::getFieldsConfig)
                .map(this::parseFieldConfigs)
                .orElse(List.of()).stream()
                .filter(f -> instituteCustomFieldId.equals(f.getInstituteCustomFieldId()))
                .findFirst()
                .map(f -> f.getRoleAccess() != null ? f.getRoleAccess() : List.<OnboardingRoleAccessDTO>of())
                .orElse(List.of());
        Optional<EffectiveAccess> fieldAccess = effectiveFrom(fieldRows, roleKey);
        return fieldAccess.orElseGet(() -> resolveStepAccess(stepId, roleKey));
    }

    private Optional<EffectiveAccess> effectiveFrom(List<OnboardingRoleAccessDTO> rows, String roleKey) {
        return rows.stream()
                .filter(r -> roleKey.equals(r.getRoleKey()))
                .findFirst()
                .map(r -> new EffectiveAccess(
                        Boolean.TRUE.equals(r.getCanView()), Boolean.TRUE.equals(r.getCanEdit())));
    }

    private List<OnboardingRoleAccessDTO> parseRoleAccess(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return List.of(objectMapper.readValue(json, OnboardingRoleAccessDTO[].class));
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<OnboardingStepFieldConfigDTO> parseFieldConfigs(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return List.of(objectMapper.readValue(json, OnboardingStepFieldConfigDTO[].class));
        } catch (Exception e) {
            return List.of();
        }
    }
}
