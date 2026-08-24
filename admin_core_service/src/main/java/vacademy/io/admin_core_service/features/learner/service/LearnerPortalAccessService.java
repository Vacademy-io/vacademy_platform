package vacademy.io.admin_core_service.features.learner.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.learner.dto.LearnerPortalAccessResponse;
import vacademy.io.admin_core_service.features.learner.enums.LmsSourcesEnum;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.UserWithJwtDTO;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class LearnerPortalAccessService {

    /** The learner_portal_base_url column default — a stamped value nobody deliberately chose. */
    private static final String DEFAULT_PORTAL_HOST = "learner.vacademy.io";

    private final InstituteRepository instituteRepository;
    private final InstituteSettingService instituteSettingService;
    private final InternalClientUtils internalClientUtils;
    private final WorkflowTriggerService workflowTriggerService;
    private final AuthService authService;
    private final StudentSessionInstituteGroupMappingRepository mappingRepository;

    @Value("${default.learner.portal.url}")
    private String defaultLearnerPortalUrl;

    public LearnerPortalAccessResponse generateLearnerPortalAccessUrl(String instituteId,String packageId, String userId) {
        UserWithJwtDTO userWithJwtDTO = authService.generateJwtTokensWithUser(userId, instituteId);
       if(StringUtils.hasText(packageId)){
           Optional<WorkflowTrigger>optionalWorkflowTrigger = workflowTriggerService.findByInstituteIdEventNameAndEventId(instituteId,WorkflowTriggerEvent.GENERATE_ADMIN_LOGIN_URL_FOR_LEARNER_PORTAL.name(),instituteId);
           if (optionalWorkflowTrigger.isPresent()) {
               Map<String, Object> response = workflowTriggerService.handleTriggerEvents(
                   WorkflowTriggerEvent.GENERATE_ADMIN_LOGIN_URL_FOR_LEARNER_PORTAL.name(),
                   instituteId, instituteId, Map.of("user", userWithJwtDTO.getUser(),"packageId",packageId));
               if (response.get("adminLoginUrl") != null) {
                   return LearnerPortalAccessResponse.builder()
                       .redirectUrl(response.get("adminLoginUrl").toString())
                       .build();
               }
               throw new VacademyException("User not foud on Learndash LMS");
           }
       }
        Institute institute = instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found"));
        String redirectUrl = buildRedirectUrl(institute, userWithJwtDTO, resolveSubOrgPortalBaseUrl(instituteId, userId));

        return LearnerPortalAccessResponse.builder()
                .redirectUrl(redirectUrl)
                .build();
    }

    /**
     * The page a learner lands on to choose a new password: the learner portal's normal login,
     * pre-filled with their username, which hands off to the existing update-profile /
     * change-password screen once they are in.
     *
     * <p>Deliberately NOT a one-time token URL. The link is required to stay predictable so an
     * admin can hand its shape to a third-party system that will substitute its own usernames
     * (see {@link #buildPasswordResetLinkTemplate}); a per-user secret could not be templated
     * that way. Nothing sensitive is exposed by it either — a username alone gets nobody in;
     * the login screen it opens still demands a password or an OTP.
     */
    private static final String RESET_PATH = "/login?username=%s&redirect=%%2Fchange-password";

    /** Placeholder a third-party integrator replaces with their own username. */
    private static final String USERNAME_PLACEHOLDER = "{username}";

    /**
     * Portal base URL for this learner: their sub-org's branded portal when it has one,
     * otherwise the parent institute's, otherwise the platform default. Same precedence the
     * SSO redirect uses, so a reset link and a portal link never point at different hosts.
     */
    public String resolvePortalBaseUrl(String instituteId, String userId) {
        String subOrgBaseUrl = resolveSubOrgPortalBaseUrl(instituteId, userId);
        if (StringUtils.hasText(subOrgBaseUrl)) {
            return withScheme(subOrgBaseUrl);
        }
        String institutePortal = instituteRepository.findById(instituteId)
                .map(Institute::getLearnerPortalBaseUrl)
                .orElse(null);
        if (StringUtils.hasText(institutePortal)) {
            return withScheme(institutePortal);
        }
        return defaultLearnerPortalUrl;
    }

    /** The ready-to-send link for one specific learner. */
    public String buildPasswordResetLink(String instituteId, String userId, String username) {
        return resolvePortalBaseUrl(instituteId, userId)
                + String.format(RESET_PATH, URLEncoder.encode(
                        StringUtils.hasText(username) ? username : "", StandardCharsets.UTF_8));
    }

    /**
     * The same link with a literal {@code {username}} left in it — what an admin copies out of
     * the UI when a third-party system will be generating these links itself.
     */
    public String buildPasswordResetLinkTemplate(String instituteId, String userId) {
        return resolvePortalBaseUrl(instituteId, userId)
                + String.format(RESET_PATH, USERNAME_PLACEHOLDER);
    }

    private String determineActiveLms(Institute institute) {
        try {
            Object settingData = instituteSettingService.getSettingData(institute, "LMS_SETTING");
            if (settingData == null) {
                return LmsSourcesEnum.VACADEMY.name();
            }

            ObjectMapper mapper = new ObjectMapper();
            JsonNode lmsData = mapper.convertValue(settingData, JsonNode.class);
            JsonNode innerDataNode = lmsData.get("data");

            if (innerDataNode != null && innerDataNode.has("activeLms") && !innerDataNode.get("activeLms").isNull()) {
                // 3. Return the text value from the 'activeLms' field
                return innerDataNode.get("activeLms").asText();
            }
            return LmsSourcesEnum.VACADEMY.name();
        } catch (Exception e) {
            log.warn("Error reading LMS_SETTING for institute {}: {}", institute.getId(), e.getMessage());
            return LmsSourcesEnum.VACADEMY.name();
        }
    }

    /**
     * A sub-org is itself an institute row, so it can carry its own learner_portal_base_url.
     * When the learner belongs to a sub-org that has one configured, the portal link must point
     * at the sub-org's branded portal instead of the parent institute's.
     *
     * Returns null when the learner has no sub-org, or no sub-org of theirs has a portal of its
     * own — the caller then falls back to the parent institute's configuration exactly as before.
     * Best-effort: a lookup failure must never block portal access.
     */
    private String resolveSubOrgPortalBaseUrl(String instituteId, String userId) {
        try {
            List<String> subOrgIds = mappingRepository.findActiveSubOrgIdsForUserInInstitute(userId, instituteId);
            for (String subOrgId : subOrgIds) {
                if (!StringUtils.hasText(subOrgId)) {
                    continue;
                }
                String subOrgBaseUrl = instituteRepository.findById(subOrgId)
                        .map(Institute::getLearnerPortalBaseUrl)
                        .orElse(null);
                if (isConfiguredPortal(subOrgBaseUrl)) {
                    return subOrgBaseUrl;
                }
            }
        } catch (Exception e) {
            log.warn("Error resolving sub-org learner portal url for user {} in institute {}: {}",
                    userId, instituteId, e.getMessage());
        }
        return null;
    }

    /**
     * A sub-org counts as having its own portal only if the value is a real, branded host.
     * Blank means never configured; the platform-wide default host means "not configured either" —
     * it's the learner_portal_base_url column default, so it can be stamped without anyone choosing
     * it. Both cases must fall through to the parent institute's configuration.
     */
    private boolean isConfiguredPortal(String baseUrl) {
        if (!StringUtils.hasText(baseUrl)) {
            return false;
        }
        String host = withScheme(baseUrl).replaceFirst("^https?://", "");
        return !DEFAULT_PORTAL_HOST.equalsIgnoreCase(host);
    }

    private String buildRedirectUrl(Institute institute, UserWithJwtDTO userWithJwtDTO, String subOrgPortalBaseUrl) {
        // Sub-org portal (when configured) wins over the parent institute's, which wins over the
        // global default. The instituteId stays the parent's — the tokens are minted against it.
        String portalHost = StringUtils.hasText(subOrgPortalBaseUrl)
                ? subOrgPortalBaseUrl
                : institute.getLearnerPortalBaseUrl();

        String baseUrl;
        if (StringUtils.hasText(portalHost)) {
            baseUrl = withScheme(portalHost);
        } else {
            baseUrl = defaultLearnerPortalUrl;
        }

        return String.format("%s/login?sso=true&accessToken=%s&refreshToken=%s&instituteId=%s",
                baseUrl,
                userWithJwtDTO.getAccessToken(),
                userWithJwtDTO.getRefreshToken(),
                institute.getId());
    }

    /**
     * Portal base urls are stored as bare domains ("bls.enarkuplift.in"), but real rows also carry
     * a scheme ("https://training.enarkuplift.in") or a trailing slash ("example.com/") — normalize
     * both so the caller can append "/login" without producing "//login".
     */
    private String withScheme(String host) {
        String trimmed = host.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed;
        }
        return "https://" + trimmed;
    }

    public Boolean sendCredForLMS(String instituteId,String packageId, String userId) {
        UserDTO userDTO = authService.getUsersFromAuthServiceByUserIds(List.of(userId)).get(0);
        if (StringUtils.hasText(packageId)){
            Optional<WorkflowTrigger>optionalWorkflowTrigger = workflowTriggerService.findByInstituteIdEventNameAndEventId(instituteId,WorkflowTriggerEvent.SEND_LEARNER_CREDENTIALS.name(),instituteId);
            if (optionalWorkflowTrigger.isPresent()) {
                Map<String, Object> response = workflowTriggerService.handleTriggerEvents(
                    WorkflowTriggerEvent.SEND_LEARNER_CREDENTIALS.name(), instituteId, instituteId,
                    Map.of("user", userDTO,"packageId",packageId));
                if (response.get("credSent") != null && response.get("credSent") instanceof Boolean
                    && (Boolean) response.get("credSent")) {
                    return true;
                }
                return false;
            }
        }

        authService.sendCredToUsers(List.of(userId));
        return true;
    }
}
