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

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Core orchestrator for white-label setup.
 *
 * Security guarantee:
 * - Caller MUST be authenticated (enforced at the gateway / filter chain
 * via @RequestAttribute("user")).
 * - We verify that the authenticated user belongs to the requested institute
 * via InstituteRepository.findInstitutesByUserId before performing any
 * mutation.
 * - All DB and Cloudflare mutations are scoped exclusively to the supplied
 * instituteId.
 * - The @Transactional annotation rolls back the entire DB state if Cloudflare
 * fails.
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

    // Cloudflare CNAME targets — where our Cloudflare deployments live
    @Value("${cloudflare.learner.target:learner.vacademy.io}")
    private String learnerCnameTarget;

    @Value("${cloudflare.admin.target:admin.vacademy.io}")
    private String adminCnameTarget;

    @Value("${cloudflare.teacher.target:teacher.vacademy.io}")
    private String teacherCnameTarget;

    // Default vacademy base domain for subdomain mode, e.g. "vacademy.io"
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

        // 1) Verify the caller belongs to this institute
        assertInstituteAccess(user, instituteId);

        // 2) Derive portal domain names
        String learnerDomain = resolveLearnerDomain(request);
        String adminDomain = resolveAdminDomain(request);
        String teacherDomain = resolveTeacherDomain(request);

        // 3) Validate
        if (!StringUtils.hasText(learnerDomain) || !StringUtils.hasText(adminDomain)) {
            throw new VacademyException("learner_domain and admin_domain are required");
        }

        List<WhiteLabelSetupResponse.DnsRecordResult> dnsResults = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        // 4) Configure Cloudflare DNS (fails fast — rolling back transaction on error)
        dnsResults.add(cloudflareService.upsertCname(learnerDomain, learnerCnameTarget));
        dnsResults.add(cloudflareService.upsertCname(adminDomain, adminCnameTarget));

        if (StringUtils.hasText(teacherDomain)) {
            dnsResults.add(cloudflareService.upsertCname(teacherDomain, teacherCnameTarget));
        } else {
            warnings.add("Teacher domain not supplied — teacher portal DNS skipped");
        }

        // 5) Upsert domain routing rows
        upsertRoutingRow(instituteId, learnerDomain, ROLE_LEARNER, request.getLearnerRouting());
        upsertRoutingRow(instituteId, adminDomain, ROLE_ADMIN, request.getAdminRouting());
        if (StringUtils.hasText(teacherDomain)) {
            upsertRoutingRow(instituteId, teacherDomain, ROLE_TEACHER, request.getTeacherRouting());
        }

        // 6) Update Institute portal URLs
        Institute institute = instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found: " + instituteId));

        String learnerUrl = "https://" + learnerDomain;
        String adminUrl = "https://" + adminDomain;
        String teacherUrl = StringUtils.hasText(teacherDomain) ? "https://" + teacherDomain : null;

        institute.setLearnerPortalBaseUrl(learnerUrl);
        institute.setAdminPortalBaseUrl(adminUrl);
        if (teacherUrl != null) {
            institute.setTeacherPortalBaseUrl(teacherUrl);
        }
        instituteRepository.save(institute);

        log.info("[WhiteLabel] Setup complete for instituteId={}, learner={}, admin={}, teacher={}",
                instituteId, learnerUrl, adminUrl, teacherUrl);

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
        assertInstituteAccess(user, instituteId);

        // If Cloudflare is not configured on this deployment, return early with a
        // minimal response
        // so the frontend knows to hide the setup UI entirely.
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

    /**
     * Security check: ensures the authenticated user is a member of the given
     * institute.
     * Throws VacademyException (→ 403) if not.
     */
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

    private String resolveLearnerDomain(WhiteLabelSetupRequest req) {
        if (DOMAIN_TYPE_SUBDOMAIN.equalsIgnoreCase(req.getDomainType())) {
            assertSlug(req.getSubdomainSlug());
            return req.getSubdomainSlug().trim().toLowerCase() + "." + vacademyBaseDomain;
        }
        return trimmedOrNull(req.getCustomLearnerDomain());
    }

    private String resolveAdminDomain(WhiteLabelSetupRequest req) {
        if (DOMAIN_TYPE_SUBDOMAIN.equalsIgnoreCase(req.getDomainType())) {
            assertSlug(req.getSubdomainSlug());
            return req.getSubdomainSlug().trim().toLowerCase() + "-admin." + vacademyBaseDomain;
        }
        return trimmedOrNull(req.getCustomAdminDomain());
    }

    private String resolveTeacherDomain(WhiteLabelSetupRequest req) {
        if (DOMAIN_TYPE_SUBDOMAIN.equalsIgnoreCase(req.getDomainType())) {
            if (!StringUtils.hasText(req.getSubdomainSlug()))
                return null;
            return req.getSubdomainSlug().trim().toLowerCase() + "-teacher." + vacademyBaseDomain;
        }
        return trimmedOrNull(req.getCustomTeacherDomain());
    }

    private void assertSlug(String slug) {
        if (!StringUtils.hasText(slug)) {
            throw new VacademyException("subdomain_slug is required for VACADEMY_SUBDOMAIN mode");
        }
        // only lowercase alphanumeric + hyphens allowed
        if (!slug.trim().matches("[a-z0-9][a-z0-9\\-]*[a-z0-9]")) {
            throw new VacademyException(
                    "subdomain_slug must be lowercase alphanumeric with hyphens only (e.g. 'my-school')");
        }
    }

    /**
     * Upsert: if a routing row already exists for this institute+role, update it;
     * otherwise create a new one.
     */
    private void upsertRoutingRow(String instituteId, String fullDomain,
            String role, PortalRoutingConfig config) {

        // Cloudflare returns the full FQDN as DNS name. Split into domain + subdomain.
        String[] parts = splitDomain(fullDomain);
        String domain = parts[0];
        String subdomain = parts[1];

        DomainRoutingUpsertRequest req = buildUpsertRequest(instituteId, domain, subdomain, role, config);

        Optional<InstituteDomainRouting> existing = routingRepository.findByInstituteIdAndRole(instituteId, role);

        if (existing.isPresent()) {
            domainRoutingAdminService.update(existing.get().getId(), req);
            log.info("[WhiteLabel] Updated routing row id={} for role={}", existing.get().getId(), role);
        } else {
            InstituteDomainRouting created = domainRoutingAdminService.create(req);
            log.info("[WhiteLabel] Created routing row id={} for role={}", created.getId(), role);
        }
    }

    /**
     * Splits "learn.myschool.com" → ["myschool.com", "learn"]
     * For a root domain "myschool.vacademy.io" (no extra subdomain) →
     * ["vacademy.io", "myschool"]
     */
    private String[] splitDomain(String fullDomain) {
        // normalise
        String d = fullDomain.trim().toLowerCase()
                .replaceFirst("^https?://", "")
                .replaceFirst("/.*$", "");

        String[] parts = d.split("\\.", 2);
        if (parts.length == 2) {
            // subdomain = parts[0], domain = parts[1]
            return new String[] { parts[1], parts[0] };
        }
        // edge-case: bare domain with no subdomain
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
            // sensible defaults
            r.setAllowUsernamePasswordAuth(true);
            r.setConvertUsernamePasswordToLowercase(false);
        }
        return r;
    }

    private String trimmedOrNull(String s) {
        return StringUtils.hasText(s) ? s.trim().toLowerCase() : null;
    }
}
