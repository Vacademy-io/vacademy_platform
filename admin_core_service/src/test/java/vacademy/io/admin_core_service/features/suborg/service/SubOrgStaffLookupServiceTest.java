package vacademy.io.admin_core_service.features.suborg.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link SubOrgStaffLookupService} — the resolver that answers "which sub-org staff
 * should hear about a sub-org learner's action". Locks the two behaviours most likely to regress:
 * (1) a batch-carrying event resolves the sub-org STRICTLY through its own batch with NO
 * institute-wide fallback (the over-reach that would mis-attribute a parent-batch doubt), and
 * (2) the ADMINS_ONLY vs ALL_TEAM audience gating.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SubOrgStaffLookupServiceTest {

    private static final String USER = "learner-1";
    private static final String INST = "inst-1";
    private static final String PS = "ps-1";
    private static final List<String> ACTIVE = List.of("ACTIVE");

    @Mock private FacultySubjectPackageSessionMappingRepository facultyMappingRepository;
    @Mock private StudentSessionInstituteGroupMappingRepository studentMappingRepository;

    @InjectMocks private SubOrgStaffLookupService service;

    @Test
    @DisplayName("batch event → resolves via the package-session query only")
    void batchEventUsesPackageSessionQuery() {
        when(studentMappingRepository.findActiveSubOrgIdsForUserInPackageSession(USER, PS))
                .thenReturn(List.of("so-1"));

        List<String> result = service.resolveLearnerSubOrgIds(USER, INST, PS);

        assertEquals(List.of("so-1"), result);
        verify(studentMappingRepository, never()).findActiveSubOrgIdsForUserInInstitute(any(), any());
    }

    @Test
    @DisplayName("batch event with no sub-org on THAT batch → empty, never falls back to institute-wide")
    void batchEventNoSubOrgDoesNotFallBackToInstitute() {
        // The learner may be a sub-org member of a *different* batch; the institute-wide fallback
        // would wrongly pull that in and (in exclusive mode) silence the real parent-batch staff.
        when(studentMappingRepository.findActiveSubOrgIdsForUserInPackageSession(USER, PS))
                .thenReturn(List.of());

        List<String> result = service.resolveLearnerSubOrgIds(USER, INST, PS);

        assertTrue(result.isEmpty());
        verify(studentMappingRepository, never()).findActiveSubOrgIdsForUserInInstitute(any(), any());
    }

    @Test
    @DisplayName("batch-less (general) query → uses institute-wide membership")
    void generalQueryUsesInstituteWide() {
        when(studentMappingRepository.findActiveSubOrgIdsForUserInInstitute(USER, INST))
                .thenReturn(List.of("so-2"));

        List<String> result = service.resolveLearnerSubOrgIds(USER, INST, /* no batch */ null);

        assertEquals(List.of("so-2"), result);
        verify(studentMappingRepository, never()).findActiveSubOrgIdsForUserInPackageSession(any(), any());
    }

    @Test
    @DisplayName("blank user → empty, no queries")
    void blankUserReturnsEmpty() {
        assertTrue(service.resolveLearnerSubOrgIds("  ", INST, PS).isEmpty());
        verify(studentMappingRepository, never()).findActiveSubOrgIdsForUserInPackageSession(any(), any());
        verify(studentMappingRepository, never()).findActiveSubOrgIdsForUserInInstitute(any(), any());
    }

    @Test
    @DisplayName("ADMINS_ONLY → queries only the sub-org admins, never the team")
    void adminsOnlyAudienceSkipsTeam() {
        when(studentMappingRepository.findActiveAdminUserIdsBySubOrg("so-1"))
                .thenReturn(List.of("admin-1", "admin-2"));

        List<String> staff = service.resolveStaffUserIds(List.of("so-1"),
                SubOrgStaffLookupService.Audience.ADMINS_ONLY);

        assertEquals(List.of("admin-1", "admin-2"), staff);
        verify(facultyMappingRepository, never())
                .findDistinctUserIdsBySubOrgIdAndLinkage(any(), any());
    }

    @Test
    @DisplayName("ALL_TEAM → unions admins + team members, de-duplicated")
    void allTeamAudienceUnionsAndDedupes() {
        when(studentMappingRepository.findActiveAdminUserIdsBySubOrg("so-1"))
                .thenReturn(List.of("admin-1", "shared"));
        when(facultyMappingRepository.findDistinctUserIdsBySubOrgIdAndLinkage("so-1", ACTIVE))
                .thenReturn(List.of("team-1", "shared"));

        List<String> staff = service.resolveStaffUserIds(List.of("so-1"),
                SubOrgStaffLookupService.Audience.ALL_TEAM);

        // admin-1, shared (once), team-1 — "shared" appears in both sources but is de-duped.
        assertEquals(3, staff.size());
        assertTrue(staff.containsAll(List.of("admin-1", "shared", "team-1")));
        verify(facultyMappingRepository).findDistinctUserIdsBySubOrgIdAndLinkage(eq("so-1"), eq(ACTIVE));
    }

    @Test
    @DisplayName("empty sub-org list → empty, no lookups")
    void emptySubOrgListReturnsEmpty() {
        assertTrue(service.resolveStaffUserIds(List.of(),
                SubOrgStaffLookupService.Audience.ALL_TEAM).isEmpty());
        verify(studentMappingRepository, never()).findActiveAdminUserIdsBySubOrg(any());
    }
}
