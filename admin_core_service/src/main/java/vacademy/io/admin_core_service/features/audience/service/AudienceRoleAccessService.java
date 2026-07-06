package vacademy.io.admin_core_service.features.audience.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import vacademy.io.admin_core_service.features.audience.dto.AudienceRoleAccessDto;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Resolves the effective Audience access mode for a request, based on the
 * caller's roles and the per-institute audience-role-access setting (stored
 * inside {@code ROLE_DISPLAY_SETTINGS.audienceRoleAccess}, with fallback to
 * the legacy {@code AUDIENCE_ROLE_ACCESS} key).
 *
 * <p>Resolution rules:
 * <ul>
 *   <li>{@code ADMIN} authority → {@link Mode#DEFAULT} (institute admins
 *       always see everything; not configurable via this setting).</li>
 *   <li>Note: we deliberately do NOT short-circuit on
 *       {@code CustomUserDetails#isRootUser()}. In this tenant the
 *       auth-service flags virtually every user as {@code root_user: true}
 *       (see {@code AuthService.createUserForLearnerEnrollment}), so it
 *       can't be used as an "institute owner" signal. The presence of the
 *       {@code ADMIN} role in JWT authorities is the actual differentiator.</li>
 *   <li>Otherwise look up the configured rule for each of the caller's role
 *       authorities (skipping unconfigured roles).</li>
 *   <li>If no role of the caller is configured → {@link Mode#DEFAULT}.</li>
 *   <li>Most-permissive wins among configured roles:
 *       any {@code DEFAULT} → DEFAULT;
 *       else any {@code AUDIENCE_LIST} → AUDIENCE_LIST with the union of
 *       configured audience_ids;
 *       else any {@code COUNSELOR} → COUNSELOR.</li>
 *   <li>Failures reading the setting fail open to DEFAULT so a malformed
 *       blob can't lock every non-admin user out of the leads endpoints.</li>
 * </ul>
 */
@Service
public class AudienceRoleAccessService {

    private static final Logger logger = LoggerFactory.getLogger(AudienceRoleAccessService.class);

    @Autowired
    private InstituteSettingService instituteSettingService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public enum Mode { DEFAULT, COUNSELOR, AUDIENCE_LIST }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EffectiveAccess {
        private Mode mode;
        /** Only populated when {@link #mode} == {@link Mode#AUDIENCE_LIST}. */
        private List<String> allowedAudienceIds;

        public static EffectiveAccess defaultMode() {
            return new EffectiveAccess(Mode.DEFAULT, Collections.emptyList());
        }
    }

    /**
     * Resolve the caller's effective access for the given institute. Returns
     * {@link Mode#DEFAULT} for null users / null institute id / read errors.
     */
    public EffectiveAccess resolveForCaller(CustomUserDetails user, String instituteId) {
        if (user == null) {
            logger.info("[audienceRoleAccess] caller=null → DEFAULT");
            return EffectiveAccess.defaultMode();
        }
        Set<String> callerRoles = resolvedCallerRoles(user, instituteId);
        logger.info("[audienceRoleAccess] caller userId={} root={} institute={} authorities={}",
                user.getUserId(), user.isRootUser(), instituteId, callerRoles);
        if (instituteId == null || instituteId.isBlank()) {
            logger.info("[audienceRoleAccess] instituteId blank → DEFAULT");
            return EffectiveAccess.defaultMode();
        }
        // ADMIN short-circuit — institute admins always see everything and
        // cannot be scoped via this setting. We check `callerRoles` (which
        // already includes the JWT-decode fallback) rather than the
        // CustomUserDetails-derived authorities, so an admin whose authorities
        // came back empty from loadUserByUsername (see the JwtAuthFilter
        // institute-resolution issue above) still gets the bypass.
        // We deliberately do NOT use CustomUserDetails#isRootUser() as a
        // signal here: in this tenant the auth-service marks virtually every
        // user as root_user=true (see AuthService.createUserForLearnerEnrollment),
        // so it doesn't actually differentiate institute owners from regular
        // accounts. The ADMIN role in (resolved) authorities is the real
        // differentiator.
        if (callerRoles.contains("ADMIN")) {
            logger.info("[audienceRoleAccess] caller has ADMIN → DEFAULT (short-circuit)");
            return EffectiveAccess.defaultMode();
        }

        AudienceRoleAccessDto config = readConfig(instituteId);
        if (config == null || config.getRoles() == null || config.getRoles().isEmpty()) {
            logger.info("[audienceRoleAccess] no config / empty roles → DEFAULT");
            return EffectiveAccess.defaultMode();
        }
        logger.info("[audienceRoleAccess] loaded config roles keys={}", config.getRoles().keySet());

        List<AudienceRoleAccessDto.RoleAccessConfig> matched = new ArrayList<>();
        for (Map.Entry<String, AudienceRoleAccessDto.RoleAccessConfig> entry : config.getRoles().entrySet()) {
            if (entry.getKey() == null) continue;
            if (callerRoles.contains(entry.getKey().toUpperCase()) && entry.getValue() != null) {
                matched.add(entry.getValue());
            }
        }
        if (matched.isEmpty()) {
            logger.info("[audienceRoleAccess] no caller role matched config → DEFAULT (callerRoles={}, configKeys={})",
                    callerRoles, config.getRoles().keySet());
            return EffectiveAccess.defaultMode();
        }

        // Most permissive wins.
        boolean anyDefault = matched.stream().anyMatch(c -> normalizeMode(c.getMode()) == Mode.DEFAULT);
        if (anyDefault) {
            logger.info("[audienceRoleAccess] matched contains DEFAULT → DEFAULT");
            return EffectiveAccess.defaultMode();
        }
        boolean anyList = matched.stream().anyMatch(c -> normalizeMode(c.getMode()) == Mode.AUDIENCE_LIST);
        if (anyList) {
            // Union the configured audience ids across matching role configs.
            Set<String> union = new LinkedHashSet<>();
            for (AudienceRoleAccessDto.RoleAccessConfig c : matched) {
                if (normalizeMode(c.getMode()) == Mode.AUDIENCE_LIST && c.getAudienceIds() != null) {
                    for (String id : c.getAudienceIds()) {
                        if (id != null && !id.isBlank()) union.add(id);
                    }
                }
            }
            logger.info("[audienceRoleAccess] resolved → AUDIENCE_LIST allowedIds={}", union);
            // Empty list = lock the user out entirely (admin-set restriction).
            return new EffectiveAccess(Mode.AUDIENCE_LIST, new ArrayList<>(union));
        }
        boolean anyCounselor = matched.stream().anyMatch(c -> normalizeMode(c.getMode()) == Mode.COUNSELOR);
        if (anyCounselor) {
            logger.info("[audienceRoleAccess] resolved → COUNSELOR");
            return new EffectiveAccess(Mode.COUNSELOR, Collections.emptyList());
        }
        logger.info("[audienceRoleAccess] no matched mode produced a non-DEFAULT result → DEFAULT");
        return EffectiveAccess.defaultMode();
    }

    /**
     * The caller's uppercase role/permission names for the institute, resolved
     * from {@code CustomUserDetails.getAuthorities()} with a JWT-decode
     * fallback. The fallback covers requests where JwtAuthFilter couldn't
     * determine the institute (e.g. institute_id only in a POST body) and
     * loadUserByUsername came back with empty authorities. We can't query the
     * DB instead — user_role lives in the auth_service database, not this
     * service's (`relation "user_role" does not exist`).
     *
     * <p>Shared with {@code CounsellorScopeService}, which needs the same
     * ADMIN/COUNSELLOR differentiation for CRM-Leads RBAC scoping.
     */
    public Set<String> resolvedCallerRoles(CustomUserDetails user, String instituteId) {
        if (user == null) return Collections.emptySet();
        Set<String> callerRoles = user.getAuthorities() == null ? new java.util.HashSet<>()
                : user.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .filter(Objects::nonNull)
                        .map(String::toUpperCase)
                        .collect(Collectors.toSet());
        if (callerRoles.isEmpty() && instituteId != null && !instituteId.isBlank()) {
            callerRoles = new java.util.HashSet<>(readRolesFromJwt(instituteId));
        }
        return callerRoles;
    }

    /**
     * Role names of the CURRENT request's JWT for the institute — for callers
     * that don't have the {@code CustomUserDetails} in hand (e.g. the
     * CounsellorScopeService gate, which most consumers invoke with just a
     * user id). Empty outside a request context (schedulers, HMAC-internal),
     * which callers must treat as "no privileged role" — the safe direction.
     */
    public Set<String> currentRequestRoles(String instituteId) {
        if (instituteId == null || instituteId.isBlank()) return Collections.emptySet();
        return readRolesFromJwt(instituteId);
    }

    private AudienceRoleAccessDto readConfig(String instituteId) {
        // Primary source: nested under ROLE_DISPLAY_SETTING.audienceRoleAccess.
        // The frontend writes here so the audience-access config lives next to
        // the rest of the role-display config in the same setting blob.
        AudienceRoleAccessDto fromDisplaySetting = readFromRoleDisplaySetting(instituteId);
        if (fromDisplaySetting != null) {
            return fromDisplaySetting;
        }
        // Backward-compat: configs saved before consolidation lived in their
        // own AUDIENCE_ROLE_ACCESS setting key. Read those too so existing
        // installs aren't broken on upgrade. Once the admin re-saves from the
        // UI, the data moves into ROLE_DISPLAY_SETTING.audienceRoleAccess.
        return readFromLegacyKey(instituteId);
    }

    // The institute-settings store is keyed by raw string. The FE writes
    // role/display config under "ROLE_DISPLAY_SETTINGS" (plural — matches the
    // existing storage.ts constant that all the existing display-settings
    // surfaces use). The Java enum spells it singular (ROLE_DISPLAY_SETTING),
    // so we hardcode the plural literal here to match what the FE actually
    // persists to the DB.
    private static final String ROLE_DISPLAY_SETTINGS_KEY = "ROLE_DISPLAY_SETTINGS";
    private static final String AUDIENCE_ROLE_ACCESS_FIELD = "audienceRoleAccess";

    @SuppressWarnings("unchecked")
    private AudienceRoleAccessDto readFromRoleDisplaySetting(String instituteId) {
        try {
            Object data = instituteSettingService.getSettingByInstituteIdAndKey(
                    instituteId, ROLE_DISPLAY_SETTINGS_KEY);
            if (data == null) return null;
            // ROLE_DISPLAY_SETTINGS is a map keyed by role-UUID for display
            // config plus a top-level "audienceRoleAccess" sibling we own.
            // Pluck only that field rather than mapping the entire blob.
            if (!(data instanceof java.util.Map)) return null;
            Object section = ((java.util.Map<String, Object>) data).get(AUDIENCE_ROLE_ACCESS_FIELD);
            if (section == null) return null;
            return objectMapper.convertValue(section, AudienceRoleAccessDto.class);
        } catch (Exception e) {
            logger.warn("Failed to read audienceRoleAccess from ROLE_DISPLAY_SETTINGS for institute {}: {}",
                    instituteId, e.getMessage());
            return null;
        }
    }

    private AudienceRoleAccessDto readFromLegacyKey(String instituteId) {
        try {
            Object data = instituteSettingService.getSettingByInstituteIdAndKey(
                    instituteId, SettingKeyEnums.AUDIENCE_ROLE_ACCESS.name());
            if (data == null) return null;
            return objectMapper.convertValue(data, AudienceRoleAccessDto.class);
        } catch (Exception e) {
            // Swallow: fail open to DEFAULT so a malformed setting doesn't lock
            // every non-root user out of the leads endpoints.
            logger.warn("Failed to read legacy AUDIENCE_ROLE_ACCESS for institute {}: {}", instituteId, e.getMessage());
            return null;
        }
    }

    private static Mode normalizeMode(String mode) {
        if (mode == null) return Mode.DEFAULT;
        switch (mode.trim().toUpperCase()) {
            case "COUNSELOR":      return Mode.COUNSELOR;
            case "AUDIENCE_LIST":  return Mode.AUDIENCE_LIST;
            default:               return Mode.DEFAULT;
        }
    }

    /**
     * Decode the JWT from the current request's Authorization header and pull
     * out {@code authorities.<instituteId>.roles} as a Set of uppercase role
     * names. Used as a fallback when {@code CustomUserDetails.getAuthorities()}
     * returns empty (which happens when JwtAuthFilter can't determine the
     * institute and loads the user with the literal string "null" as
     * institute id).
     *
     * <p>We do NOT re-validate the JWT signature here — Spring's JwtAuthFilter
     * has already done that earlier in the chain; we're only re-reading the
     * payload that was already trusted.
     *
     * <p>Returns an empty set on any error (no header, malformed, etc.) so
     * the caller falls through to DEFAULT instead of throwing.
     */
    private Set<String> readRolesFromJwt(String instituteId) {
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder
                    .getRequestAttributes();
            if (attrs == null) return Collections.emptySet();
            HttpServletRequest request = attrs.getRequest();
            String header = request.getHeader("Authorization");
            if (header == null || !header.startsWith("Bearer ")) {
                return Collections.emptySet();
            }
            String token = header.substring("Bearer ".length()).trim();
            String[] parts = token.split("\\.");
            if (parts.length < 2) return Collections.emptySet();
            byte[] payload = Base64.getUrlDecoder().decode(parts[1]);
            JsonNode root = objectMapper.readTree(new String(payload, StandardCharsets.UTF_8));
            JsonNode authorities = root.get("authorities");
            if (authorities == null || !authorities.isObject()) {
                return Collections.emptySet();
            }
            JsonNode forInstitute = authorities.get(instituteId);
            if (forInstitute == null || !forInstitute.isObject()) {
                return Collections.emptySet();
            }
            JsonNode roles = forInstitute.get("roles");
            if (roles == null || !roles.isArray()) {
                return Collections.emptySet();
            }
            Set<String> out = new LinkedHashSet<>();
            roles.forEach(r -> {
                String s = r.asText();
                if (s != null && !s.isBlank()) {
                    out.add(s.toUpperCase());
                }
            });
            // Also include the per-institute permissions, since those land in
            // CustomUserDetails.storedAuthorities alongside role names — keeps
            // the JWT-fallback set consistent with the loadUserByUsername-derived
            // set in the happy path.
            JsonNode perms = forInstitute.get("permissions");
            if (perms != null && perms.isArray()) {
                perms.forEach(p -> {
                    String s = p.asText();
                    if (s != null && !s.isBlank()) {
                        out.add(s.toUpperCase());
                    }
                });
            }
            return out;
        } catch (Exception e) {
            logger.warn("[audienceRoleAccess] failed to decode JWT for fallback roles: {}",
                    e.getMessage());
            return Collections.emptySet();
        }
    }

}
