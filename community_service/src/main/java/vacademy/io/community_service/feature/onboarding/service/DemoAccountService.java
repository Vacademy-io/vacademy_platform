package vacademy.io.community_service.feature.onboarding.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.community_service.feature.onboarding.dto.DemoAccountDto;
import vacademy.io.community_service.feature.onboarding.dto.DemoHandoffDto;
import vacademy.io.community_service.feature.onboarding.dto.UpdateDemoAccountRequest;
import vacademy.io.community_service.feature.onboarding.entity.OnboardingDemoAccount;
import vacademy.io.community_service.feature.onboarding.enums.InstituteType;
import vacademy.io.community_service.feature.onboarding.repository.OnboardingDemoAccountRepository;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

/** Reads/edits the four demo accounts and builds the prospect-facing demo handoff (login URLs). */
@Service
@Slf4j
public class DemoAccountService {

    @Autowired
    private OnboardingDemoAccountRepository repository;
    @Autowired
    private AdminCoreClient adminCoreClient;

    @Value("${ONBOARDING_ADMIN_PORTAL_URL:https://dash.vacademy.io}")
    private String defaultAdminPortalUrl;

    @Value("${ONBOARDING_LEARNER_PORTAL_URL:https://learner.vacademy.io}")
    private String defaultLearnerPortalUrl;

    public List<DemoAccountDto> listForSuperAdmin() {
        return repository.findAllByOrderBySortOrderAsc().stream().map(this::toDto).collect(Collectors.toList());
    }

    public OnboardingDemoAccount requireByType(String instituteType) {
        if (!StringUtils.hasText(instituteType)) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "Institute type is required");
        }
        return repository.findByInstituteType(instituteType.toUpperCase())
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND,
                        "No demo configured for type " + instituteType));
    }

    public DemoHandoffDto buildHandoff(String instituteType) {
        return toHandoff(requireByType(instituteType));
    }

    public DemoAccountDto update(String id, UpdateDemoAccountRequest req) {
        OnboardingDemoAccount acc = repository.findById(id)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Demo account not found"));

        boolean nameChanged = false;
        if (req.getDisplayName() != null && !req.getDisplayName().isBlank()
                && !req.getDisplayName().equals(acc.getDisplayName())) {
            acc.setDisplayName(req.getDisplayName().trim());
            nameChanged = true;
        }
        if (req.getAdminUsername() != null) acc.setAdminUsername(emptyToNull(req.getAdminUsername()));
        if (req.getAdminPassword() != null) acc.setAdminPassword(emptyToNull(req.getAdminPassword()));
        if (req.getLearnerUsername() != null) acc.setLearnerUsername(emptyToNull(req.getLearnerUsername()));
        if (req.getLearnerPassword() != null) acc.setLearnerPassword(emptyToNull(req.getLearnerPassword()));
        if (req.getAdminPortalUrl() != null) acc.setAdminPortalUrl(emptyToNull(req.getAdminPortalUrl()));
        if (req.getLearnerPortalUrl() != null) acc.setLearnerPortalUrl(emptyToNull(req.getLearnerPortalUrl()));
        if (req.getActive() != null) acc.setActive(req.getActive());

        repository.save(acc);

        // Optionally push the new name to the live institute so the demo reflects it.
        if (nameChanged && Boolean.TRUE.equals(req.getSyncNameToInstitute())) {
            try {
                adminCoreClient.renameInstitute(acc.getInstituteId(), acc.getDisplayName());
            } catch (Exception e) {
                log.error("Demo institute rename failed for {}: {}", acc.getInstituteId(), e.getMessage());
                throw new VacademyException(HttpStatus.BAD_GATEWAY,
                        "Saved locally, but renaming the live institute failed: " + e.getMessage());
            }
        }
        return toDto(acc);
    }

    // ---- mapping -----------------------------------------------------------------

    public DemoAccountDto toDto(OnboardingDemoAccount a) {
        return DemoAccountDto.builder()
                .id(a.getId())
                .instituteType(a.getInstituteType())
                .instituteTypeLabel(label(a.getInstituteType()))
                .instituteId(a.getInstituteId())
                .displayName(a.getDisplayName())
                .adminUsername(a.getAdminUsername())
                .adminPassword(a.getAdminPassword())
                .learnerUsername(a.getLearnerUsername())
                .learnerPassword(a.getLearnerPassword())
                .adminPortalUrl(a.getAdminPortalUrl())
                .learnerPortalUrl(a.getLearnerPortalUrl())
                .active(a.isActive())
                .sortOrder(a.getSortOrder())
                .build();
    }

    private DemoHandoffDto toHandoff(OnboardingDemoAccount a) {
        String adminBase = StringUtils.hasText(a.getAdminPortalUrl()) ? a.getAdminPortalUrl() : defaultAdminPortalUrl;
        String learnerBase = StringUtils.hasText(a.getLearnerPortalUrl()) ? a.getLearnerPortalUrl() : defaultLearnerPortalUrl;
        return DemoHandoffDto.builder()
                .instituteType(a.getInstituteType())
                .instituteTypeLabel(label(a.getInstituteType()))
                .instituteId(a.getInstituteId())
                .displayName(a.getDisplayName())
                .adminUsername(a.getAdminUsername())
                .adminPassword(a.getAdminPassword())
                .adminLoginUrl(loginUrl(adminBase, a.getAdminUsername(), a.getAdminPassword()))
                .learnerUsername(a.getLearnerUsername())
                .learnerPassword(a.getLearnerPassword())
                .learnerLoginUrl(loginUrl(learnerBase, a.getLearnerUsername(), a.getLearnerPassword()))
                .build();
    }

    /** Builds a /login URL the portal apps recognise: prefills (and auto-submits) the demo creds. */
    private String loginUrl(String base, String username, String password) {
        if (!StringUtils.hasText(base) || !StringUtils.hasText(username)) {
            return base;
        }
        String sep = base.contains("?") ? "&" : "?";
        String path = base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
        return path + "/login" + sep
                + "demo_username=" + enc(username)
                + "&demo_password=" + enc(password)
                + "&demo=1";
    }

    private static String enc(String v) {
        return v == null ? "" : URLEncoder.encode(v, StandardCharsets.UTF_8);
    }

    private static String emptyToNull(String v) {
        return (v == null || v.isBlank()) ? null : v.trim();
    }

    private static String label(String type) {
        try {
            return InstituteType.valueOf(type).getLabel();
        } catch (Exception e) {
            return type;
        }
    }
}
