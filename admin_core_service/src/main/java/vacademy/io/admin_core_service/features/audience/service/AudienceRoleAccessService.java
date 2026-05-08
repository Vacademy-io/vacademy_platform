package vacademy.io.admin_core_service.features.audience.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.dto.AudienceRoleAccessDto;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
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
 *   <li>{@code isRootUser()} → {@link Mode#DEFAULT} (sees everything; no
 *       scoping). Skips the setting lookup entirely. Note: this no longer
 *       short-circuits on the {@code ADMIN} authority — most non-root team
 *       accounts in this tenant carry ADMIN, and we want to be able to
 *       scope them via this setting.</li>
 *   <li>Otherwise look up the configured rule for each of the caller's role
 *       authorities (skipping unconfigured roles).</li>
 *   <li>If no role of the caller is configured → {@link Mode#DEFAULT}.
 *       This is the default-DEFAULT guarantee: an unconfigured user always
 *       sees everything, even if they have ADMIN.</li>
 *   <li>Most-permissive wins among configured roles:
 *       any {@code DEFAULT} → DEFAULT;
 *       else any {@code AUDIENCE_LIST} → AUDIENCE_LIST with the union of
 *       configured audience_ids;
 *       else any {@code COUNSELOR} → COUNSELOR.</li>
 *   <li>Failures reading the setting fail open to DEFAULT so a malformed
 *       blob can't lock every non-root user out of the leads endpoints.</li>
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
            return EffectiveAccess.defaultMode();
        }
        // Root short-circuit — institute owners (the original signup-root user)
        // always see everything regardless of saved settings.
        //
        // Note: we deliberately do NOT short-circuit on the ADMIN authority
        // here. In this tenant most non-root accounts (including team/junior
        // admins) carry the ADMIN role too, and we want admins to be able to
        // scope those accounts to specific audience lists via this setting.
        // The "ADMIN sees everything" guarantee still holds in practice when
        // the admin has no role configured in AUDIENCE_ROLE_ACCESS — the
        // resolver below falls through to DEFAULT in that case.
        if (user.isRootUser()) {
            return EffectiveAccess.defaultMode();
        }
        if (instituteId == null || instituteId.isBlank()) {
            return EffectiveAccess.defaultMode();
        }

        AudienceRoleAccessDto config = readConfig(instituteId);
        if (config == null || config.getRoles() == null || config.getRoles().isEmpty()) {
            return EffectiveAccess.defaultMode();
        }

        // Collect the configured rule for each role the caller carries.
        Set<String> callerRoles = user.getAuthorities() == null ? Collections.emptySet()
                : user.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .filter(Objects::nonNull)
                        .map(String::toUpperCase)
                        .collect(Collectors.toSet());

        List<AudienceRoleAccessDto.RoleAccessConfig> matched = new ArrayList<>();
        for (Map.Entry<String, AudienceRoleAccessDto.RoleAccessConfig> entry : config.getRoles().entrySet()) {
            if (entry.getKey() == null) continue;
            if (callerRoles.contains(entry.getKey().toUpperCase()) && entry.getValue() != null) {
                matched.add(entry.getValue());
            }
        }
        if (matched.isEmpty()) {
            return EffectiveAccess.defaultMode();
        }

        // Most permissive wins.
        boolean anyDefault = matched.stream().anyMatch(c -> normalizeMode(c.getMode()) == Mode.DEFAULT);
        if (anyDefault) {
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
            // Empty list = lock the user out entirely (admin-set restriction).
            return new EffectiveAccess(Mode.AUDIENCE_LIST, new ArrayList<>(union));
        }
        boolean anyCounselor = matched.stream().anyMatch(c -> normalizeMode(c.getMode()) == Mode.COUNSELOR);
        if (anyCounselor) {
            return new EffectiveAccess(Mode.COUNSELOR, Collections.emptyList());
        }
        return EffectiveAccess.defaultMode();
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

}
