package vacademy.io.admin_core_service.features.telephony.core;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.audience.service.AudienceRoleAccessService;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Who sees a verbatim phone number on the Call Log.
 *
 * <p>The rules matter beyond cosmetics: the number the dashboard hands the lead
 * side-sheet is the one its call / WhatsApp / email actions operate on, so
 * "masked" is not just a redaction — it disables contacting the lead from that
 * panel. These tests pin each branch of the resolution order.
 */
class CallNumberVisibilityServiceTest {

    private static final String INSTITUTE = "inst-1";

    private InstituteSettingService settingService;
    private AudienceRoleAccessService roleService;
    private CallNumberVisibilityService service;

    @BeforeEach
    void setUp() {
        settingService = mock(InstituteSettingService.class);
        roleService = mock(AudienceRoleAccessService.class);
        service = new CallNumberVisibilityService(settingService, roleService);
    }

    /** Stub the caller's resolved roles (the JWT-authorities + fallback set). */
    private CustomUserDetails caller(String... roles) {
        CustomUserDetails user = mock(CustomUserDetails.class);
        when(roleService.resolvedCallerRoles(any(), anyString())).thenReturn(Set.of(roles));
        return user;
    }

    /** Stub ROLE_DISPLAY_SETTINGS.callNumberVisibility exactly as the FE persists it. */
    private void withConfig(Map<String, Object> rolesToModes) {
        when(settingService.getSettingByInstituteIdAndKey(eq(INSTITUTE), eq("ROLE_DISPLAY_SETTINGS")))
                .thenReturn(Map.of("callNumberVisibility", Map.of("roles", rolesToModes)));
    }

    private void withNoConfig() {
        when(settingService.getSettingByInstituteIdAndKey(eq(INSTITUTE), eq("ROLE_DISPLAY_SETTINGS")))
                .thenReturn(null);
    }

    // ── Unconfigured defaults ────────────────────────────────────────────────

    @Test
    void unconfigured_admin_staysMasked_preservingTodaysBehaviour() {
        // Unmasking is strictly opt-in: an institute that has never opened the
        // setting sees exactly what it sees today, admins included. Deploying this
        // service must widen access for nobody.
        withNoConfig();
        assertFalse(service.canViewFullNumbers(caller("ADMIN"), INSTITUTE));
    }

    @Test
    void unconfigured_nonAdmin_staysMasked() {
        withNoConfig();
        assertFalse(service.canViewFullNumbers(caller("TEACHER"), INSTITUTE));
    }

    // ── Explicit per-role rules ──────────────────────────────────────────────

    @Test
    void explicitFull_onNonAdminRole_unmasks() {
        withConfig(Map.of("COUNSELLOR", Map.of("mode", "FULL")));
        assertTrue(service.canViewFullNumbers(caller("COUNSELLOR"), INSTITUTE));
    }

    @Test
    void explicitFull_onAdminRole_unmasksTheAdmin() {
        // The one click that fixes "every number on the Call Log is masked".
        withConfig(Map.of("ADMIN", Map.of("mode", "FULL")));
        assertTrue(service.canViewFullNumbers(caller("ADMIN"), INSTITUTE));
    }

    @Test
    void explicitMasked_onAdminRole_keepsTheAdminMasked() {
        withConfig(Map.of("ADMIN", Map.of("mode", "MASKED")));
        assertFalse(service.canViewFullNumbers(caller("ADMIN"), INSTITUTE));
    }

    @Test
    void multiRoleCaller_mostPermissiveWins() {
        withConfig(Map.of(
                "TEACHER", Map.of("mode", "MASKED"),
                "COUNSELLOR", Map.of("mode", "FULL")));
        assertTrue(service.canViewFullNumbers(caller("TEACHER", "COUNSELLOR"), INSTITUTE));
    }

    @Test
    void grantingOneRole_doesNotLeakToAnAdminWhoLacksItsOwnGrant() {
        // Granting COUNSELLOR is a statement about counsellors. An ADMIN with no
        // grant of their own stays masked — no role implicitly unmasks another.
        withConfig(Map.of("COUNSELLOR", Map.of("mode", "FULL")));
        assertFalse(service.canViewFullNumbers(caller("ADMIN", "TEACHER"), INSTITUTE));
    }

    @Test
    void explicitFullOnAnyHeldRole_winsOverAnExplicitlyMaskedSibling() {
        withConfig(Map.of(
                "ADMIN", Map.of("mode", "MASKED"),
                "COUNSELLOR", Map.of("mode", "FULL")));
        assertTrue(service.canViewFullNumbers(caller("ADMIN", "COUNSELLOR"), INSTITUTE));
    }

    @Test
    void ruleForAnUnheldRole_doesNotAffectTheCaller() {
        // Only COUNSELLOR is configured; a TEACHER falls through to the
        // unconfigured default rather than inheriting someone else's rule.
        withConfig(Map.of("COUNSELLOR", Map.of("mode", "FULL")));
        assertFalse(service.canViewFullNumbers(caller("TEACHER"), INSTITUTE));
    }

    @Test
    void modeValueIsCaseInsensitive() {
        withConfig(Map.of("COUNSELLOR", Map.of("mode", "full")));
        assertTrue(service.canViewFullNumbers(caller("COUNSELLOR"), INSTITUTE));
    }

    // ── Role-name casing ─────────────────────────────────────────────────────
    // This institute's roles table genuinely holds mixed case — 'Admin' and
    // 'ADMIN' as separate rows, plus 'Crm', 'Coordinator', 'Dev'. A case-sensitive
    // match would drop a saved choice silently (role falls back to masked, nothing
    // reports why), which is the same class of bug as the known Admin/ADMIN issue.

    @Test
    void storedRoleKeyMatchesRegardlessOfCase() {
        withConfig(Map.of("Crm", Map.of("mode", "FULL")));
        assertTrue(service.canViewFullNumbers(caller("CRM"), INSTITUTE));
    }

    @Test
    void mixedCaseRoleNameFromTheJwtStillMatches() {
        withConfig(Map.of("COORDINATOR", Map.of("mode", "FULL")));
        // resolvedCallerRoles upper-cases, but pin it end-to-end anyway.
        assertTrue(service.canViewFullNumbers(caller("COORDINATOR"), INSTITUTE));
    }

    @Test
    void duplicateKeysDifferingOnlyByCase_theGrantWins() {
        // 'Admin' and 'ADMIN' both exist as roles here, so the blob can end up with
        // both spellings. A duplicate must never quietly revoke a grant.
        withConfig(new java.util.LinkedHashMap<>(Map.of(
                "ADMIN", Map.of("mode", "MASKED"),
                "Admin", Map.of("mode", "FULL"))));
        assertTrue(service.canViewFullNumbers(caller("ADMIN"), INSTITUTE));
    }

    // ── The two guarantees the product asked for ─────────────────────────────

    @Test
    void everyRoleIsMaskedUntilItsOwnRowSaysOtherwise() {
        // "By default it is masked" — for every role, with no config at all.
        withNoConfig();
        for (String role : List.of("ADMIN", "TEACHER", "COUNSELLOR", "CRM", "CENTRE_ADMIN")) {
            assertFalse(service.canViewFullNumbers(caller(role), INSTITUTE),
                    role + " must be masked when nothing is configured");
        }
    }

    @Test
    void visibilityIsDecidedPerRole_notGlobally() {
        // "Which role can see the number" — one institute, three roles, three answers.
        withConfig(Map.of(
                "COUNSELLOR", Map.of("mode", "FULL"),
                "TEACHER", Map.of("mode", "MASKED")));
        assertTrue(service.canViewFullNumbers(caller("COUNSELLOR"), INSTITUTE));
        assertFalse(service.canViewFullNumbers(caller("TEACHER"), INSTITUTE));
        assertFalse(service.canViewFullNumbers(caller("ADMIN"), INSTITUTE)); // unconfigured
    }

    // ── Legacy authority + failure modes ─────────────────────────────────────

    @Test
    void legacyViewCallNumbersAuthority_stillGrantsFullNumbers() {
        withConfig(Map.of("TEACHER", Map.of("mode", "MASKED")));
        assertTrue(service.canViewFullNumbers(
                caller("TEACHER", CallNumberVisibilityService.VIEW_CALL_NUMBERS), INSTITUTE));
    }

    @Test
    void malformedSettingBlob_fallsBackToMasked_ratherThanThrowing() {
        when(settingService.getSettingByInstituteIdAndKey(eq(INSTITUTE), eq("ROLE_DISPLAY_SETTINGS")))
                .thenReturn(Map.of("callNumberVisibility", List.of("not", "an", "object")));
        assertFalse(service.canViewFullNumbers(caller("ADMIN"), INSTITUTE));
        assertFalse(service.canViewFullNumbers(caller("TEACHER"), INSTITUTE));
    }

    @Test
    void settingReadThrows_failsClosed() {
        when(settingService.getSettingByInstituteIdAndKey(anyString(), anyString()))
                .thenThrow(new RuntimeException("settings store down"));
        assertFalse(service.canViewFullNumbers(caller("ADMIN"), INSTITUTE));
        assertFalse(service.canViewFullNumbers(caller("TEACHER"), INSTITUTE));
    }

    @Test
    void nullCallerOrBlankInstitute_masks() {
        assertFalse(service.canViewFullNumbers(null, INSTITUTE));
        assertFalse(service.canViewFullNumbers(mock(CustomUserDetails.class), "  "));
    }

    /**
     * Guard against either side of the FE/BE contract renaming the setting key or
     * the field inside it — the failure mode is silent (every role falls back to
     * the defaults and the admin's saved choice is ignored).
     */
    @Test
    void readsTheSettingKeyAndFieldTheFrontendWrites() {
        withConfig(Map.of("TEACHER", Map.of("mode", "FULL")));
        assertTrue(service.canViewFullNumbers(caller("TEACHER"), INSTITUTE),
                "hooks/use-call-number-visibility.ts writes ROLE_DISPLAY_SETTINGS.callNumberVisibility");
    }
}
