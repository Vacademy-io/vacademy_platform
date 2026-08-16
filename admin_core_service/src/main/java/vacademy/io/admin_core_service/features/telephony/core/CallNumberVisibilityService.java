package vacademy.io.admin_core_service.features.telephony.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.service.AudienceRoleAccessService;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.telephony.core.dto.CallNumberVisibilityDto;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * Decides whether a Call Log viewer sees full phone numbers or the masked form
 * ({@code *******1234}).
 *
 * <p><b>Why this exists.</b> The gate used to be the single JWT authority
 * {@code VIEW_CALL_NUMBERS}. That authority is never provisioned — it exists in
 * no migration and in no {@code permissions} row — so the check could only ever
 * evaluate false, and EVERY viewer (institute admins included) saw masked
 * numbers with no way to turn that off. Worse, the masked string is what the
 * dashboard then hands to the lead side-sheet, so "call back this lead" and
 * "message this lead" silently operated on {@code *******1234}.
 *
 * <p><b>The setting.</b> Per-role, admin-configurable, stored alongside the rest
 * of the role display config:
 *
 * <pre>
 * ROLE_DISPLAY_SETTINGS.callNumberVisibility = {
 *   "roles": { "ADMIN": {"mode": "FULL"}, "COUNSELLOR": {"mode": "MASKED"} }
 * }
 * </pre>
 *
 * <p><b>Resolution order</b> (first match wins):
 * <ol>
 *   <li>{@code VIEW_CALL_NUMBERS} authority ⇒ FULL. Kept so that if the
 *       permission is ever actually provisioned it keeps meaning what it says.</li>
 *   <li>Any of the caller's roles explicitly set to {@code FULL} ⇒ FULL. Most
 *       permissive explicit rule wins, as in {@code AudienceRoleAccessService}.</li>
 *   <li>Everything else ⇒ MASKED.</li>
 * </ol>
 *
 * <p><b>The unconfigured default is MASKED for every role, admins included</b> —
 * byte-for-byte the behaviour institutes have today, since the old authority gate
 * could only ever evaluate false. Unmasking is therefore strictly opt-in: nothing
 * changes for anyone until an admin picks "Show full numbers" for a role. That is
 * deliberate. An institute-admin-defaults-to-FULL rule is defensible (they are the
 * ones who ring the lead back) but it would widen access on every existing tenant
 * at deploy time without anyone asking for it.
 *
 * <p><b>Scope.</b> This governs the Call Log surface: the table, the CSV/XLSX
 * export, the per-call detail popover and the technical diagnostics blob. It is a
 * DISPLAY choice for that surface, not an access-control boundary — the same
 * numbers are shown unmasked on Recent Leads, Lead List, Lead Board, Follow-ups
 * and the lead's own profile. Making it a real boundary means applying it across
 * all of those, which is a separate product decision.
 *
 * <p>Any read failure falls back to the unconfigured defaults rather than
 * throwing — a malformed settings blob must not break the call dashboard.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CallNumberVisibilityService {

    /**
     * Legacy authority. Never provisioned in this deployment, but still honored:
     * if an institute does create the permission, it grants full numbers.
     */
    public static final String VIEW_CALL_NUMBERS = "VIEW_CALL_NUMBERS";

    /**
     * The FE persists role/display config under the PLURAL key; the Java
     * {@code SettingKeyEnums} spells it singular. Same literal (and same reason)
     * as {@code AudienceRoleAccessService}.
     */
    private static final String ROLE_DISPLAY_SETTINGS_KEY = "ROLE_DISPLAY_SETTINGS";
    private static final String CALL_NUMBER_VISIBILITY_FIELD = "callNumberVisibility";

    private static final String MODE_FULL = "FULL";
    /** Only meaningful as an explicit choice — it is also the unconfigured default. */
    private static final String MODE_MASKED = "MASKED";

    private final InstituteSettingService instituteSettingService;
    private final AudienceRoleAccessService audienceRoleAccessService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** True when this caller may see verbatim phone numbers for the institute. */
    public boolean canViewFullNumbers(CustomUserDetails user, String instituteId) {
        if (user == null || instituteId == null || instituteId.isBlank()) return false;

        Set<String> callerRoles = audienceRoleAccessService.resolvedCallerRoles(user, instituteId);
        if (callerRoles.contains(VIEW_CALL_NUMBERS)) return true;

        Map<String, CallNumberVisibilityDto.RoleNumberVisibility> configured = readConfig(instituteId);

        // Most permissive EXPLICIT rule wins — the same precedence
        // AudienceRoleAccessService applies across a multi-role caller. An explicit
        // FULL on any role the caller holds is the ONLY route to unmasked numbers,
        // so an unconfigured institute keeps exactly the behaviour it has today.
        for (String role : callerRoles) {
            if (MODE_FULL.equals(modeFor(configured, role))) return true;
        }
        return false;
    }

    /**
     * The rule for one role, normalized to {@code FULL} / {@code MASKED}, or null
     * when that role has no rule (⇒ the masked default).
     *
     * <p>Both sides are upper-cased before matching. This institute's role names are
     * genuinely mixed case — {@code Admin} and {@code ADMIN} exist as separate rows,
     * alongside {@code Crm}, {@code Coordinator}, {@code Dev} — and a case-sensitive
     * comparison here would silently ignore a saved choice (the role falls back to
     * masked and nothing reports why). Same defence
     * {@code AudienceRoleAccessService} applies to its own role map.
     */
    private static String modeFor(
            Map<String, CallNumberVisibilityDto.RoleNumberVisibility> configured, String role) {
        if (configured == null || role == null) return null;
        CallNumberVisibilityDto.RoleNumberVisibility rule = configured.get(role.toUpperCase());
        if (rule == null || rule.getMode() == null) return null;
        String mode = rule.getMode().trim().toUpperCase();
        return MODE_FULL.equals(mode) || MODE_MASKED.equals(mode) ? mode : null;
    }

    @SuppressWarnings("unchecked")
    private Map<String, CallNumberVisibilityDto.RoleNumberVisibility> readConfig(String instituteId) {
        try {
            Object data = instituteSettingService.getSettingByInstituteIdAndKey(
                    instituteId, ROLE_DISPLAY_SETTINGS_KEY);
            if (!(data instanceof Map)) return Map.of();
            Object section = ((Map<String, Object>) data).get(CALL_NUMBER_VISIBILITY_FIELD);
            if (section == null) return Map.of();
            CallNumberVisibilityDto dto =
                    objectMapper.convertValue(section, CallNumberVisibilityDto.class);
            if (dto == null || dto.getRoles() == null) return Map.of();
            return upperCaseKeys(dto.getRoles());
        } catch (Exception e) {
            log.warn("[callNumberVisibility] read failed for institute {}: {}", instituteId, e.getMessage());
            return Map.of();
        }
    }

    /**
     * Re-key the stored map upper-case so {@link #modeFor}'s lookup can't miss.
     * The settings card always writes upper-case keys, but the blob is hand-editable
     * JSON in {@code institutes.setting_json} and this is the difference between a
     * saved choice working and being silently dropped. On a collision (both
     * {@code Admin} and {@code ADMIN} configured) the more permissive rule wins, so
     * a duplicate can never quietly revoke a grant.
     */
    private static Map<String, CallNumberVisibilityDto.RoleNumberVisibility> upperCaseKeys(
            Map<String, CallNumberVisibilityDto.RoleNumberVisibility> raw) {
        Map<String, CallNumberVisibilityDto.RoleNumberVisibility> out = new HashMap<>();
        raw.forEach((key, rule) -> {
            if (key == null || rule == null) return;
            out.merge(key.trim().toUpperCase(), rule, (existing, incoming) ->
                    MODE_FULL.equalsIgnoreCase(safeMode(existing)) ? existing : incoming);
        });
        return out;
    }

    private static String safeMode(CallNumberVisibilityDto.RoleNumberVisibility rule) {
        return rule == null || rule.getMode() == null ? "" : rule.getMode().trim();
    }
}
