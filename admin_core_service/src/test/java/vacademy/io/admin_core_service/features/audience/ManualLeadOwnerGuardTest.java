package vacademy.io.admin_core_service.features.audience;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.audience.dto.SubmitLeadRequestDTO;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository.LeadOwnerRow;
import vacademy.io.admin_core_service.features.audience.service.LeadDeduplicationService;
import vacademy.io.admin_core_service.features.audience.service.ManualLeadOwnerGuard;
import vacademy.io.admin_core_service.features.counsellor_workbench.service.CounsellorScopeService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** A counsellor cannot add by hand a lead another counsellor owns; everyone else can. */
class ManualLeadOwnerGuardTest {

    private LeadDeduplicationService dedup;
    private CounsellorScopeService scope;
    private ManualLeadOwnerGuard guard;
    private CustomUserDetails caller;

    @BeforeEach
    void setUp() {
        AudienceRepository audiences = mock(AudienceRepository.class);
        dedup = mock(LeadDeduplicationService.class);
        scope = mock(CounsellorScopeService.class);
        guard = new ManualLeadOwnerGuard(audiences, dedup, scope);

        Audience audience = new Audience();
        audience.setId("aud-1");
        audience.setInstituteId("inst-1");
        when(audiences.findById("aud-1")).thenReturn(Optional.of(audience));

        caller = mock(CustomUserDetails.class);
        when(caller.getUserId()).thenReturn("counsellor-me");
        when(scope.allCounsellorUserIds("inst-1")).thenReturn(List.of("counsellor-me", "counsellor-other"));
    }

    private SubmitLeadRequestDTO request(String phone) {
        SubmitLeadRequestDTO dto = new SubmitLeadRequestDTO();
        dto.setAudienceId("aud-1");
        UserDTO user = new UserDTO();
        user.setMobileNumber(phone);
        dto.setUserDTO(user);
        return dto;
    }

    private void ownedBy(String counsellorId, String name) {
        LeadOwnerRow row = mock(LeadOwnerRow.class);
        when(row.getCounsellorId()).thenReturn(counsellorId);
        when(row.getCounsellorName()).thenReturn(name);
        when(dedup.findCurrentOwnerByPhone("inst-1", "aud-1", "9876543210")).thenReturn(Optional.of(row));
    }

    @Test
    void anotherCounsellorsLeadIsRefusedWithTheirName() {
        ownedBy("counsellor-other", "Shruti");

        VacademyException e = assertThrows(VacademyException.class,
                () -> guard.checkCanAdd(request("9876543210"), caller));
        assertTrue(e.getMessage().contains("Shruti"));
    }

    @Test
    void ownLeadNewPhoneAndAdminsGoThrough() {
        ownedBy("counsellor-me", "Me");
        assertDoesNotThrow(() -> guard.checkCanAdd(request("9876543210"), caller));

        when(dedup.findCurrentOwnerByPhone(any(), any(), any())).thenReturn(Optional.empty());
        assertDoesNotThrow(() -> guard.checkCanAdd(request("9876543210"), caller));

        ownedBy("counsellor-other", "Shruti");
        when(scope.hasAdminRole(caller, "inst-1")).thenReturn(true);
        assertDoesNotThrow(() -> guard.checkCanAdd(request("9876543210"), caller));
    }

    @Test
    void ownerWhoIsNoLongerACounsellorDoesNotBlock() {
        ownedBy("counsellor-removed", "Gone");
        assertDoesNotThrow(() -> guard.checkCanAdd(request("9876543210"), caller));
    }

    @Test
    void noPhoneOrAFailedLookupLetsTheAddThrough() {
        assertDoesNotThrow(() -> guard.checkCanAdd(request(null), caller));
        verifyNoInteractions(dedup);

        when(dedup.findCurrentOwnerByPhone(any(), any(), any())).thenThrow(new RuntimeException("db down"));
        assertDoesNotThrow(() -> guard.checkCanAdd(request("9876543210"), caller));
    }
}
