package vacademy.io.admin_core_service.features.audience;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import vacademy.io.admin_core_service.features.audience.service.AudienceRoleAccessService;
import vacademy.io.admin_core_service.features.audience.service.AudienceRoleAccessService.EffectiveAccess;
import vacademy.io.admin_core_service.features.audience.service.AudienceRoleAccessService.Mode;
import vacademy.io.admin_core_service.features.counselor_pool.repository.CounselorPoolRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The AUDIENCE_LIST "only leads assigned to this role" option.
 *
 * <p>Two things make it worth pinning. It hides leads — a wrong {@code true}
 * empties a counsellor's list, and a wrong {@code false} leaks the whole lead
 * pool to a role the admin meant to fence in. And it is gated on the institute
 * having no counsellor pool, a condition that lives nowhere near the setting
 * itself, so it is exactly the kind of rule a later refactor drops silently.
 */
class AudienceRoleAccessServiceAssignedOnlyTest {

    private static final String INSTITUTE = "inst-1";

    private InstituteSettingService settingService;
    private CounselorPoolRepository poolRepository;
    private AudienceRoleAccessService service;

    @BeforeEach
    void setUp() {
        settingService = mock(InstituteSettingService.class);
        poolRepository = mock(CounselorPoolRepository.class);
        service = new AudienceRoleAccessService(settingService, poolRepository);
    }

    private CustomUserDetails caller(String... roles) {
        CustomUserDetails user = mock(CustomUserDetails.class);
        doReturn(Arrays.stream(roles).map(SimpleGrantedAuthority::new).collect(Collectors.toList()))
                .when(user).getAuthorities();
        when(user.getUserId()).thenReturn("user-1");
        return user;
    }

    /** Stub ROLE_DISPLAY_SETTINGS.audienceRoleAccess exactly as the FE persists it. */
    private void withRoles(Map<String, Object> roles) {
        when(settingService.getSettingByInstituteIdAndKey(eq(INSTITUTE), eq("ROLE_DISPLAY_SETTINGS")))
                .thenReturn(Map.of("audienceRoleAccess", Map.of("roles", roles)));
    }

    private static Map<String, Object> listRule(boolean assignedOnly, String... audienceIds) {
        return Map.of(
                "mode", "AUDIENCE_LIST",
                "audience_ids", List.of(audienceIds),
                "assigned_only", assignedOnly);
    }

    private void withPools(boolean present) {
        when(poolRepository.existsByInstituteId(anyString())).thenReturn(present);
    }

    @Test
    void assignedOnlyAppliesWhenOptedInAndNoPoolExists() {
        withRoles(Map.of("COUNSELLOR", listRule(true, "aud-1")));
        withPools(false);

        EffectiveAccess access = service.resolveForCaller(caller("COUNSELLOR"), INSTITUTE);

        assertEquals(Mode.AUDIENCE_LIST, access.getMode());
        assertEquals(List.of("aud-1"), access.getAllowedAudienceIds());
        assertTrue(access.isAssignedOnly());
    }

    /** A pool owns lead ownership, so the option goes inert — but the list grant stays. */
    @Test
    void counsellorPoolMakesAssignedOnlyInertWithoutLosingTheListGrant() {
        withRoles(Map.of("COUNSELLOR", listRule(true, "aud-1")));
        withPools(true);

        EffectiveAccess access = service.resolveForCaller(caller("COUNSELLOR"), INSTITUTE);

        assertEquals(Mode.AUDIENCE_LIST, access.getMode());
        assertEquals(List.of("aud-1"), access.getAllowedAudienceIds());
        assertFalse(access.isAssignedOnly());
    }

    @Test
    void audienceListWithoutTheFlagIsUnchanged() {
        withRoles(Map.of("COUNSELLOR", Map.of("mode", "AUDIENCE_LIST", "audience_ids", List.of("aud-1"))));
        withPools(false);

        EffectiveAccess access = service.resolveForCaller(caller("COUNSELLOR"), INSTITUTE);

        assertEquals(Mode.AUDIENCE_LIST, access.getMode());
        assertFalse(access.isAssignedOnly());
    }

    /**
     * Most-permissive-wins, same rule the mode resolution uses: a second role
     * granted the whole list keeps the caller seeing the whole list.
     */
    @Test
    void aSecondRoleWithoutTheFlagWidensTheCallerBackToTheFullLists() {
        withRoles(Map.of(
                "COUNSELLOR", listRule(true, "aud-1"),
                "TEAM_PT", listRule(false, "aud-2")));
        withPools(false);

        EffectiveAccess access = service.resolveForCaller(caller("COUNSELLOR", "TEAM_PT"), INSTITUTE);

        assertEquals(Mode.AUDIENCE_LIST, access.getMode());
        assertEquals(2, access.getAllowedAudienceIds().size());
        assertFalse(access.isAssignedOnly());
    }

    /** ADMIN short-circuits to DEFAULT before the flag is ever considered. */
    @Test
    void adminIsNeverAssignedOnly() {
        withRoles(Map.of("ADMIN", listRule(true, "aud-1")));
        withPools(false);

        EffectiveAccess access = service.resolveForCaller(caller("ADMIN"), INSTITUTE);

        assertEquals(Mode.DEFAULT, access.getMode());
        assertFalse(access.isAssignedOnly());
    }

    /**
     * A pool lookup that blows up must not quietly hand the role a narrower view
     * than it had — fail towards "a pool might exist", i.e. inert.
     */
    @Test
    void poolLookupFailureLeavesTheOptionInert() {
        withRoles(Map.of("COUNSELLOR", listRule(true, "aud-1")));
        when(poolRepository.existsByInstituteId(anyString()))
                .thenThrow(new RuntimeException("db down"));

        EffectiveAccess access = service.resolveForCaller(caller("COUNSELLOR"), INSTITUTE);

        assertEquals(Mode.AUDIENCE_LIST, access.getMode());
        assertFalse(access.isAssignedOnly());
    }

    /** COUNSELOR mode is untouched by the new flag. */
    @Test
    void counselorModeIsUnaffected() {
        withRoles(Map.of("COUNSELLOR", Map.of("mode", "COUNSELOR")));
        withPools(false);

        EffectiveAccess access = service.resolveForCaller(caller("COUNSELLOR"), INSTITUTE);

        assertEquals(Mode.COUNSELOR, access.getMode());
        assertFalse(access.isAssignedOnly());
    }
}
