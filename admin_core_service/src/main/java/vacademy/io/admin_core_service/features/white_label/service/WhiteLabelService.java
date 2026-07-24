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
import vacademy.io.common.auth.repository.UserRoleRepository;
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

    // Role names are simple uppercase tokens (system roles like
    // LEARNER/ADMIN/TEACHER
    // and institute custom roles like MANAGE_LEAD). Used to sanity-check request
    // tokens.
    private static final java.util.regex.Pattern ROLE_TOKEN_PATTERN = java.util.regex.Pattern.compile("[A-Z0-9_]+");

    @Value("${cloudflare.learner.target:learner.vacademy.io}")
    private String learnerCnameTarget;

    @Value("${cloudflare.admin.target:dash.vacademy.io}")
    private String adminCnameTarget;

    @Value("${cloudflare.teacher.target:teacher.vacademy.io}")
    private String teacherCnameTarget;

    // Cloudflare Pages project names (i.e. <project>.pages.dev) that serve the SPAs.
    // Only two exist: the learner dashboard and the admin dashboard. ADMIN and
    // TEACHER portals are both the admin dashboard SPA, so they share the admin
    // project. Blank when Pages provisioning is not configured on this deployment —
    // in that case the setup falls back to the legacy DNS-only path.
    @Value("${cloudflare.learner.pages-project:}")
    private String learnerPagesProject;

    @Value("${cloudflare.admin.pages-project:}")
    private String adminPagesProject;

    @Value("${vacademy.base.domain:vacademy.io}")
    private String vacademyBaseDomain;

    private static final String ROLE_NAME_ADMIN = "ADMIN";

    private final InstituteRepository instituteRepository;
    private final InstituteDomainRoutingRepository routingRepository;
    private final DomainRoutingAdminService domainRoutingAdminService;
    private final CloudflareService cloudflareService;
    private final UserRoleRepository userRoleRepository;

    // ── Setup ─────────────────────────────────────────────────────────────────

    @Transactional
    public WhiteLabelSetupResponse setup(CustomUserDetails user, String instituteId,
            WhiteLabelSetupRequest request) {

        // 0) Hard gate — some Cloudflare capability must be configured on this
        // deployment: DNS (token + zone) and/or Pages provisioning (token + account).
        if (!cloudflareService.isEnabled() && !cloudflareService.isPagesEnabled()) {
            throw new VacademyException(
                    "White-label automation is not available on this deployment. " +
                            "Set CLOUDFLARE_API_TOKEN with CLOUDFLARE_ZONE_ID (DNS) and/or " +
                            "CLOUDFLARE_ACCOUNT_ID (Pages custom domains).");
        }

        // 1) Security check
        assertInstituteAccess(user, instituteId);

        // 2) Validate entries
        List<WhiteLabelSetupRequest.DomainEntry> entries = request.getEntries();
        if (entries == null || entries.isEmpty()) {
            throw new VacademyException("At least one domain entry is required");
        }

        // Validate domains and validate+canonicalize role strings (comma-separated
        // lists).
        // After this loop, each entry.role is a canonical "ROLE1,ROLE2" string with
        // unique, sorted, upper-cased tokens.
        for (WhiteLabelSetupRequest.DomainEntry e : entries) {
            if (!StringUtils.hasText(e.getDomain())) {
                throw new VacademyException("Domain is required for each entry");
            }
            e.setRole(validateAndCanonicalizeRoles(e.getRole()));
            e.setDomain(e.getDomain().trim().toLowerCase()
                    .replaceFirst("^https?://", "")
                    .replaceFirst("/.*$", ""));
        }

        // Validate: at most one primary per *individual* role token. If a user marks
        // one entry primary with roles "ADMIN,MANAGE_LEAD" and another entry primary
        // with "ADMIN", they collide on ADMIN.
        Map<String, Long> primaryTokenCounts = entries.stream()
                .filter(WhiteLabelSetupRequest.DomainEntry::isPrimary)
                .flatMap(e -> splitRoleTokens(e.getRole()).stream())
                .collect(Collectors.groupingBy(r -> r, Collectors.counting()));
        for (Map.Entry<String, Long> pc : primaryTokenCounts.entrySet()) {
            if (pc.getValue() > 1) {
                throw new VacademyException("At most one primary domain per role allowed. " +
                        "Role '" + pc.getKey() + "' has " + pc.getValue() + " primary entries.");
            }
        }

        // 3) Process each entry: Cloudflare Pages custom domain (preferred) or the
        // legacy DNS-only fallback, then the routing row.
        List<WhiteLabelSetupResponse.DnsRecordResult> dnsResults = new ArrayList<>();
        List<WhiteLabelSetupResponse.PagesDomainResult> pagesResults = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        for (WhiteLabelSetupRequest.DomainEntry entry : entries) {
            String host = entry.getDomain();
            boolean inZone = isVacademySubdomain(host);
            String pagesProject = pagesProjectForRole(entry.getRole());
            boolean pagesEnabled = cloudflareService.isPagesEnabled() && StringUtils.hasText(pagesProject);

            // a) Wire the host into the serving layer.
            if (pagesEnabled) {
                // Preferred: attach the host as a custom domain on the Pages project
                // that serves this role. This is the step that makes the host actually
                // SERVE the SPA. For in-zone (*.vacademy.io) hosts Cloudflare also
                // creates the DNS record + certificate automatically; for external
                // customer domains we can't touch their zone, so we surface the CNAME
                // they must add themselves.
                try {
                    WhiteLabelSetupResponse.PagesDomainResult pr =
                            cloudflareService.upsertPagesCustomDomain(pagesProject, host);
                    pagesResults.add(pr);
                    if (!inZone) {
                        warnings.add("Custom domain " + host + ": add a CNAME at your DNS provider pointing "
                                + host + " → " + pr.getPagesCnameTarget()
                                + ". SSL activates automatically once Cloudflare validates it"
                                + " (current status: " + pr.getStatus() + ").");
                    }
                } catch (Exception e) {
                    warnings.add("Failed to attach Pages custom domain for " + host + ": " + e.getMessage());
                    log.error("[WhiteLabel] Pages attach failed host={}, role={}: {}",
                            host, entry.getRole(), e.getMessage());
                }
            } else if (inZone) {
                // Legacy fallback (Pages not configured): proxied CNAME only. NOTE: this
                // only serves traffic if a wildcard/Pages custom domain already covers
                // the target — otherwise the host will 522 until registered on Pages.
                String cnameTarget = cnameTargetForRole(entry.getRole());
                try {
                    dnsResults.add(cloudflareService.upsertCname(host, cnameTarget));
                } catch (Exception e) {
                    warnings.add("Failed to configure DNS for " + host + ": " + e.getMessage());
                    log.error("[WhiteLabel] DNS failed for domain={}, role={}: {}",
                            host, entry.getRole(), e.getMessage());
                }
            } else {
                // External custom domain with no Pages provisioning configured — we can
                // neither create DNS in the customer's zone nor register the domain.
                warnings.add("Custom external domain " + host + " needs Cloudflare Pages provisioning "
                        + "(CLOUDFLARE_ACCOUNT_ID + a Pages project for role " + entry.getRole()
                        + "), which is not set on this deployment. Nothing was provisioned for it.");
            }

            // b) Upsert routing row (by exact domain+subdomain+role match)
            upsertRoutingRow(instituteId, host, entry.getRole(), entry.getRoutingConfig());
        }

        // 4) Update institute portal URLs for primary entries
        Institute institute = instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found: " + instituteId));

        String learnerUrl = null, adminUrl = null, teacherUrl = null;

        // For each primary entry, iterate its role tokens and update the institute's
        // matching portal URL columns. Custom-role tokens don't have dedicated columns,
        // so they're silently skipped — their branding lives on the routing row only.
        for (WhiteLabelSetupRequest.DomainEntry entry : entries) {
            if (!entry.isPrimary())
                continue;
            String url = "https://" + entry.getDomain();
            for (String token : splitRoleTokens(entry.getRole())) {
                switch (token) {
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
                    default -> {
                        /* custom role: no institute column to update */ }
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
                .pagesDomainsConfigured(pagesResults)
                .warnings(warnings)
                .build();
    }

    // ── Status ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public WhiteLabelStatusResponse getStatus(CustomUserDetails user, String instituteId) {

        if (!cloudflareService.isEnabled() && !cloudflareService.isPagesEnabled()) {
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
                        // Live Cloudflare Pages custom-domain status (active/pending/…)
                        .pagesStatus(pagesStatusFor(r))
                        .pagesCnameTarget(pagesCnameTargetFor(r))
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
                        .commaSeparatedPreferredCountry(r.getCommaSeparatedPreferredCountry())
                        // Logo / institute-name display
                        .hideInstituteName(r.getHideInstituteName())
                        .logoWidthPx(r.getLogoWidthPx())
                        .logoHeightPx(r.getLogoHeightPx())
                        .stackNameBelowLogo(r.getStackNameBelowLogo())
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
        if (user == null) {
            throw new VacademyException("Access denied: no authenticated user");
        }

        // 1) Root users bypass all institute membership checks. Matches the convention
        // used elsewhere in the codebase (e.g.
        // StudentListManager#applyFacultyAccessFilter).
        if (user.isRootUser()) {
            return;
        }

        // 2) Users with an active ADMIN role on the *specific* target institute are
        // allowed. This uses the canonical user_role table (the same source the
        // auth service builds the JWT's per-institute authorities from), so it
        // correctly authorizes admins regardless of how they were provisioned —
        // including admins who don't have a row in the `staff` table.
        if (userRoleRepository.existsByUserIdAndInstituteIdAndRoleName(
                user.getUserId(), instituteId, ROLE_NAME_ADMIN)) {
            return;
        }

        // 3) Fallback: legacy staff-table membership check, preserved for backward
        // compatibility with users who were granted access via that path.
        boolean isStaff = instituteRepository.findInstitutesByUserId(user.getUserId())
                .stream()
                .anyMatch(i -> i.getId().equals(instituteId));
        if (!isStaff) {
            log.warn("[WhiteLabel] Unauthorized attempt by userId={} on instituteId={}",
                    user.getUserId(), instituteId);
            throw new VacademyException("Access denied: you are not a member of institute " + instituteId);
        }
    }

    /**
     * Returns the Cloudflare CNAME target for a role string.
     *
     * The role string may contain multiple comma-separated role tokens. We pick
     * the first system-role token in priority order [LEARNER, ADMIN, TEACHER]
     * and use its CNAME target. If the entry has only custom-role tokens
     * (e.g. "MANAGE_LEAD"), we default to the admin target since custom roles
     * are virtually always served from the admin-side infra.
     */
    private String cnameTargetForRole(String role) {
        List<String> tokens = splitRoleTokens(role);
        if (tokens.contains(ROLE_LEARNER))
            return learnerCnameTarget;
        if (tokens.contains(ROLE_ADMIN))
            return adminCnameTarget;
        if (tokens.contains(ROLE_TEACHER))
            return teacherCnameTarget;
        // Custom-role-only entry: admin infra serves it.
        return adminCnameTarget;
    }

    /**
     * Returns the Cloudflare Pages project name that serves a role string, or null
     * when it isn't configured. Only LEARNER is served by its own project; ADMIN,
     * TEACHER and any institute custom role are all served by the admin dashboard
     * SPA, so they share the admin project (there is no separate teacher project —
     * teacher.vacademy.io is just another custom domain on the admin project).
     */
    private String pagesProjectForRole(String role) {
        List<String> tokens = splitRoleTokens(role);
        if (tokens.contains(ROLE_LEARNER))
            return trimToNull(learnerPagesProject);
        return trimToNull(adminPagesProject);
    }

    /**
     * Looks up the live Cloudflare Pages custom-domain status for a routing row
     * (active/pending/…), or null when Pages isn't configured or the host isn't
     * attached. Failure-safe — used only for display.
     */
    private String pagesStatusFor(InstituteDomainRouting r) {
        if (!cloudflareService.isPagesEnabled()) {
            return null;
        }
        String project = pagesProjectForRole(r.getRole());
        if (!StringUtils.hasText(project)) {
            return null;
        }
        String host = (StringUtils.hasText(r.getSubdomain()) && !"*".equals(r.getSubdomain()))
                ? r.getSubdomain() + "." + r.getDomain()
                : r.getDomain();
        return cloudflareService.getPagesCustomDomainStatus(project, host);
    }

    /**
     * The {@code <project>.pages.dev} CNAME target for a routing row, so the UI
     * can show an external domain the exact record to add. Null when Pages isn't
     * configured for the role.
     */
    private String pagesCnameTargetFor(InstituteDomainRouting r) {
        String project = pagesProjectForRole(r.getRole());
        return StringUtils.hasText(project) ? project + ".pages.dev" : null;
    }

    /** True when {@code host} is the base vacademy domain or a subdomain of it. */
    private boolean isVacademySubdomain(String host) {
        if (!StringUtils.hasText(host))
            return false;
        String h = host.trim().toLowerCase();
        String base = vacademyBaseDomain.trim().toLowerCase();
        return h.equals(base) || h.endsWith("." + base);
    }

    private String trimToNull(String s) {
        return StringUtils.hasText(s) ? s.trim() : null;
    }

    /**
     * Upsert a domain routing row. Looks up by institute+domain+subdomain+role
     * (exact match on the full role string, so "ADMIN" and "ADMIN,MANAGE_LEAD"
     * are separate rows). Updates if found, creates otherwise.
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

    // ── Role helpers ──────────────────────────────────────────────────────────

    /**
     * Validates a comma-separated role string and returns its canonical form:
     * tokens trimmed, uppercased, deduped, sorted alphabetically and rejoined
     * with a single comma. Sorting makes "ADMIN,MANAGE_LEAD" and
     * "MANAGE_LEAD,ADMIN" collapse to one canonical value so upserts match.
     *
     * Role names are NOT validated against the `roles` table: that table lives
     * in the auth service's database and is not reachable from
     * admin_core_service's database. Instead we enforce a simple token format,
     * which covers both system roles (LEARNER/ADMIN/TEACHER) and any institute
     * custom role (e.g. MANAGE_LEAD). An unrecognized token simply produces a
     * routing row that no user matches — harmless and editable — so we don't
     * need an authoritative role list here.
     *
     * Throws VacademyException if the string is empty or contains a malformed
     * token.
     */
    private String validateAndCanonicalizeRoles(String roleStr) {
        if (!StringUtils.hasText(roleStr)) {
            throw new VacademyException("Role is required for each entry");
        }
        Set<String> tokens = new TreeSet<>();
        for (String raw : roleStr.split(",")) {
            String token = raw == null ? "" : raw.trim().toUpperCase();
            if (token.isEmpty())
                continue;
            if (!ROLE_TOKEN_PATTERN.matcher(token).matches()) {
                throw new VacademyException("Invalid role '" + token + "'. "
                        + "Role names may contain only letters, digits and underscores.");
            }
            tokens.add(token);
        }
        if (tokens.isEmpty()) {
            throw new VacademyException("Role is required for each entry");
        }
        return String.join(",", tokens);
    }

    /**
     * Splits a canonical role string into its role tokens. Safe for null/empty
     * input (returns an empty list). Used by cname-target and primary-URL logic
     * that need to inspect individual roles.
     */
    private List<String> splitRoleTokens(String roleStr) {
        if (!StringUtils.hasText(roleStr))
            return List.of();
        List<String> tokens = new ArrayList<>();
        for (String raw : roleStr.split(",")) {
            String t = raw == null ? "" : raw.trim().toUpperCase();
            if (!t.isEmpty())
                tokens.add(t);
        }
        return tokens;
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
            r.setCommaSeparatedPreferredCountry(cfg.getCommaSeparatedPreferredCountry());
            r.setHideInstituteName(cfg.getHideInstituteName());
            r.setLogoWidthPx(cfg.getLogoWidthPx());
            r.setLogoHeightPx(cfg.getLogoHeightPx());
            r.setStackNameBelowLogo(cfg.getStackNameBelowLogo());
        } else {
            r.setAllowUsernamePasswordAuth(true);
            r.setConvertUsernamePasswordToLowercase(false);
        }
        return r;
    }
}
