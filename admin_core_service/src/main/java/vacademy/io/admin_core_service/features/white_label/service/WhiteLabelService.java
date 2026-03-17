package vacademy.io.admin_core_service.features.white_label.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.domain_routing.dto.DomainRoutingUpsertRequest;
import vacademy.io.admin_core_service.features.domain_routing.entity.InstituteDomainRouting;
import vacademy.io.admin_core_service.features.domain_routing.repository.InstituteDomainRoutingRepository;
import vacademy.io.admin_core_service.features.domain_routing.service.DomainRoutingAdminService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.white_label.dto.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Core orchestrator for white-label setup.
 *
 * Supports multiple domain entries per role. E.g. "ADMIN" can have two
 * domains (admin.myschool.com AND manage.myschool.com). Each entry gets
 * its own Cloudflare CNAME and domain_routing row. Exactly one entry per
 * role may be is_primary = true — that URL is stored in the institute table.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WhiteLabelService {

    private static final String DOMAIN_TYPE_SUBDOMAIN = "VACADEMY_SUBDOMAIN";
    private static final String DOMAIN_TYPE_CUSTOM = "CUSTOM";

    private static final String ROLE_LEARNER = "LEARNER";
    private static final String ROLE_ADMIN = "ADMIN";
    private static final String ROLE_TEACHER = "TEACHER";

    private static final Set<String> VALID_ROLES = Set.of(ROLE_LEARNER, ROLE_ADMIN, ROLE_TEACHER);

    @Value("${cloudflare.learner.target:learner.vacademy.io}")
    private String learnerCnameTarget;

    @Value("${cloudflare.admin.target:admin.vacademy.io}")
    private String adminCnameTarget;

    @Value("${cloudflare.teacher.target:teacher.vacademy.io}")
    private String teacherCnameTarget;

    @Value("${vacademy.base.domain:vacademy.io}")
    private String vacademyBaseDomain;

    private final InstituteRepository instituteRepository;
    private final InstituteDomainRoutingRepository routingRepository;
    private final DomainRoutingAdminService domainRoutingAdminService;
    private final CloudflareService cloudflareService;

    // ── Setup ─────────────────────────────────────────────────────────────────

    @Transactional
    public WhiteLabelSetupResponse setup(CustomUserDetails user, String instituteId,
            WhiteLabelSetupRequest request) {

        // 0) Hard gate — Cloudflare must be configured on this deployment
        if (!cloudflareService.isEnabled()) {
            throw new VacademyException(
                    "White-label DNS automation is not available on this deployment. " +
                            "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID env variables are not set.");
        }

        // 1) Security check
        assertInstituteAccess(user, instituteId);

        // 2) Validate entries
        List<WhiteLabelSetupRequest.DomainEntry> entries = request.getEntries();
        if (entries == null || entries.isEmpty()) {
            throw new VacademyException("At least one domain entry is required");
        }

        // Validate roles and domains
        for (WhiteLabelSetupRequest.DomainEntry e : entries) {
            if (!StringUtils.hasText(e.getRole()) || !VALID_ROLES.contains(e.getRole().toUpperCase())) {
                throw new VacademyException("Invalid role: " + e.getRole() + ". Must be LEARNER, ADMIN, or TEACHER");
            }
            if (!StringUtils.hasText(e.getDomain())) {
                throw new VacademyException("Domain is required for each entry");
            }
            e.setRole(e.getRole().toUpperCase().trim());
            e.setDomain(e.getDomain().trim().toLowerCase()
                    .replaceFirst("^https?://", "")
                    .replaceFirst("/.*$", ""));
        }

        // Validate: at most one primary per role
        Map<String, Long> primaryCounts = entries.stream()
                .filter(WhiteLabelSetupRequest.DomainEntry::isPrimary)
                .collect(Collectors.groupingBy(WhiteLabelSetupRequest.DomainEntry::getRole, Collectors.counting()));
        for (Map.Entry<String, Long> pc : primaryCounts.entrySet()) {
            if (pc.getValue() > 1) {
                throw new VacademyException("At most one primary domain per role allowed. " +
                        "Role '" + pc.getKey() + "' has " + pc.getValue() + " primary entries.");
            }
        }

        // 3) Process each entry: Cloudflare DNS + routing row
        List<WhiteLabelSetupResponse.DnsRecordResult> dnsResults = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        for (WhiteLabelSetupRequest.DomainEntry entry : entries) {
            // a) Create/update Cloudflare CNAME
            String cnameTarget = cnameTargetForRole(entry.getRole());
            try {
                dnsResults.add(cloudflareService.upsertCname(entry.getDomain(), cnameTarget));
            } catch (Exception e) {
                warnings.add("Failed to configure DNS for " + entry.getDomain() + ": " + e.getMessage());
                log.error("[WhiteLabel] DNS failed for domain={}, role={}: {}",
                        entry.getDomain(), entry.getRole(), e.getMessage());
            }

            // b) Upsert routing row (by exact domain+subdomain+role match)
            upsertRoutingRow(instituteId, entry.getDomain(), entry.getRole(), entry.getRoutingConfig());
        }

        // 4) Update institute portal URLs for primary entries
        Institute institute = instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found: " + instituteId));

        String learnerUrl = null, adminUrl = null, teacherUrl = null;

        for (WhiteLabelSetupRequest.DomainEntry entry : entries) {
            if (entry.isPrimary()) {
                String url = "https://" + entry.getDomain();
                switch (entry.getRole()) {
                    case ROLE_LEARNER -> {
                        institute.setLearnerPortalBaseUrl(url);
                        learnerUrl = url;
                    }
                    case ROLE_ADMIN -> {
                        institute.setAdminPortalBaseUrl(url);
                        adminUrl = url;
                    }
                    case ROLE_TEACHER -> {
                        institute.setTeacherPortalBaseUrl(url);
                        teacherUrl = url;
                    }
                }
            }
        }
        instituteRepository.save(institute);

        // Use existing URLs if not explicitly set as primary in this request
        if (learnerUrl == null)
            learnerUrl = institute.getLearnerPortalBaseUrl();
        if (adminUrl == null)
            adminUrl = institute.getAdminPortalBaseUrl();
        if (teacherUrl == null)
            teacherUrl = institute.getTeacherPortalBaseUrl();

        log.info("[WhiteLabel] Setup complete for instituteId={}, {} entries processed",
                instituteId, entries.size());

        return WhiteLabelSetupResponse.builder()
                .setupComplete(true)
                .learnerPortalUrl(learnerUrl)
                .adminPortalUrl(adminUrl)
                .teacherPortalUrl(teacherUrl)
                .dnsRecordsConfigured(dnsResults)
                .warnings(warnings)
                .build();
    }

    // ── Status ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public WhiteLabelStatusResponse getStatus(CustomUserDetails user, String instituteId) {

        if (!cloudflareService.isEnabled()) {
            log.info("[WhiteLabel] getStatus called but Cloudflare is not configured on this deployment");
            return WhiteLabelStatusResponse.builder()
                    .cloudflareEnabled(false)
                    .isConfigured(false)
                    .routingEntries(Collections.emptyList())
                    .build();
        }

        Institute institute = instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found: " + instituteId));

        List<InstituteDomainRouting> routings = routingRepository.findByInstituteId(instituteId);

        boolean configured = StringUtils.hasText(institute.getLearnerPortalBaseUrl())
                || !routings.isEmpty();

        // Guess domain type from existing learner URL
        String domainType = null;
        if (StringUtils.hasText(institute.getLearnerPortalBaseUrl())) {
            domainType = institute.getLearnerPortalBaseUrl().contains(vacademyBaseDomain)
                    ? DOMAIN_TYPE_SUBDOMAIN
                    : DOMAIN_TYPE_CUSTOM;
        }

        List<WhiteLabelStatusResponse.RoutingEntry> entries = routings.stream()
                .map(r -> WhiteLabelStatusResponse.RoutingEntry.builder()
                        .id(r.getId())
                        .role(r.getRole())
                        .domain(r.getDomain())
                        .subdomain(r.getSubdomain())
                        // Branding
                        .tabText(r.getTabText())
                        .tabIconFileId(r.getTabIconFileId())
                        .theme(r.getTheme())
                        .fontFamily(r.getFontFamily())
                        // Routes
                        .redirect(r.getRedirect())
                        .afterLoginRoute(r.getAfterLoginRoute())
                        .adminPortalAfterLogoutRoute(r.getAdminPortalAfterLogoutRoute())
                        .homeIconClickRoute(r.getHomeIconClickRoute())
                        // Auth
                        .allowSignup(r.getAllowSignup())
                        .allowGoogleAuth(r.getAllowGoogleAuth())
                        .allowGithubAuth(r.getAllowGithubAuth())
                        .allowEmailOtpAuth(r.getAllowEmailOtpAuth())
                        .allowPhoneAuth(r.getAllowPhoneAuth())
                        .allowUsernamePasswordAuth(r.getAllowUsernamePasswordAuth())
                        .convertUsernamePasswordToLowercase(r.isConvertUsernamePasswordToLowercase())
                        // Legal / Links
                        .privacyPolicyUrl(r.getPrivacyPolicyUrl())
                        .termsAndConditionUrl(r.getTermsAndConditionUrl())
                        .playStoreAppLink(r.getPlayStoreAppLink())
                        .appStoreAppLink(r.getAppStoreAppLink())
                        .windowsAppLink(r.getWindowsAppLink())
                        .macAppLink(r.getMacAppLink())
                        .build())
                .collect(Collectors.toList());

        return WhiteLabelStatusResponse.builder()
                .cloudflareEnabled(true)
                .isConfigured(configured)
                .domainType(domainType)
                .learnerPortalUrl(institute.getLearnerPortalBaseUrl())
                .adminPortalUrl(institute.getAdminPortalBaseUrl())
                .teacherPortalUrl(institute.getTeacherPortalBaseUrl())
                .routingEntries(entries)
                .build();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void assertInstituteAccess(CustomUserDetails user, String instituteId) {
        boolean isMember = instituteRepository.findInstitutesByUserId(user.getId())
                .stream()
                .anyMatch(i -> i.getId().equals(instituteId));
        if (!isMember) {
            log.warn("[WhiteLabel] Unauthorized attempt by userId={} on instituteId={}",
                    user.getId(), instituteId);
            throw new VacademyException("Access denied: you are not a member of institute " + instituteId);
        }
    }

    /** Returns the Cloudflare CNAME target for a given role. */
    private String cnameTargetForRole(String role) {
        return switch (role) {
            case ROLE_LEARNER -> learnerCnameTarget;
            case ROLE_ADMIN -> adminCnameTarget;
            case ROLE_TEACHER -> teacherCnameTarget;
            default -> throw new VacademyException("Unknown role: " + role);
        };
    }

    /**
     * Upsert a domain routing row. Looks up by institute+domain+subdomain+role
     * (exact match). Updates if found, creates otherwise.
     */
    private void upsertRoutingRow(String instituteId, String fullDomain,
            String role, PortalRoutingConfig config) {

        String[] parts = splitDomain(fullDomain);
        String domain = parts[0];
        String subdomain = parts[1];

        DomainRoutingUpsertRequest req = buildUpsertRequest(instituteId, domain, subdomain, role, config);

        Optional<InstituteDomainRouting> existing = routingRepository.findByInstituteIdAndDomainAndSubdomainAndRole(
                instituteId, domain, subdomain, role);

        if (existing.isPresent()) {
            domainRoutingAdminService.update(existing.get().getId(), req);
            log.info("[WhiteLabel] Updated routing row id={} for {}://{}.{}", existing.get().getId(), role, subdomain,
                    domain);
        } else {
            InstituteDomainRouting created = domainRoutingAdminService.create(req);
            log.info("[WhiteLabel] Created routing row id={} for {}://{}.{}", created.getId(), role, subdomain, domain);
        }
    }

    /**
     * Splits "learn.myschool.com" → ["myschool.com", "learn"]
     */
    private String[] splitDomain(String fullDomain) {
        String d = fullDomain.trim().toLowerCase()
                .replaceFirst("^https?://", "")
                .replaceFirst("/.*$", "");

        String[] parts = d.split("\\.", 2);
        if (parts.length == 2) {
            return new String[] { parts[1], parts[0] };
        }
        return new String[] { d, "*" };
    }

    private DomainRoutingUpsertRequest buildUpsertRequest(
            String instituteId, String domain, String subdomain, String role,
            PortalRoutingConfig cfg) {

        DomainRoutingUpsertRequest r = new DomainRoutingUpsertRequest();
        r.setInstituteId(instituteId);
        r.setDomain(domain);
        r.setSubdomain(subdomain);
        r.setRole(role);

        if (cfg != null) {
            r.setRedirect(cfg.getRedirect());
            r.setPrivacyPolicyUrl(cfg.getPrivacyPolicyUrl());
            r.setTermsAndConditionUrl(cfg.getTermsAndConditionUrl());
            r.setAfterLoginRoute(cfg.getAfterLoginRoute());
            r.setAdminPortalAfterLogoutRoute(cfg.getAdminPortalAfterLogoutRoute());
            r.setHomeIconClickRoute(cfg.getHomeIconClickRoute());
            r.setTheme(cfg.getTheme());
            r.setTabText(cfg.getTabText());
            r.setAllowSignup(cfg.getAllowSignup());
            r.setTabIconFileId(cfg.getTabIconFileId());
            r.setFontFamily(cfg.getFontFamily());
            r.setAllowGoogleAuth(cfg.getAllowGoogleAuth());
            r.setAllowGithubAuth(cfg.getAllowGithubAuth());
            r.setAllowEmailOtpAuth(cfg.getAllowEmailOtpAuth());
            r.setAllowPhoneAuth(cfg.getAllowPhoneAuth());
            r.setAllowUsernamePasswordAuth(cfg.getAllowUsernamePasswordAuth());
            r.setPlayStoreAppLink(cfg.getPlayStoreAppLink());
            r.setAppStoreAppLink(cfg.getAppStoreAppLink());
            r.setWindowsAppLink(cfg.getWindowsAppLink());
            r.setMacAppLink(cfg.getMacAppLink());
            r.setConvertUsernamePasswordToLowercase(
                    cfg.getConvertUsernamePasswordToLowercase() != null
                            ? cfg.getConvertUsernamePasswordToLowercase()
                            : false);
        } else {
            r.setAllowUsernamePasswordAuth(true);
            r.setConvertUsernamePasswordToLowercase(false);
        }
        return r;
    }
}
