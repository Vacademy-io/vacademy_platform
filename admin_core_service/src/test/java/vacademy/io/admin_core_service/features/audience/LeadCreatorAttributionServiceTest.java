package vacademy.io.admin_core_service.features.audience;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.audience.dto.BulkSubmitLeadRequestDTO;
import vacademy.io.admin_core_service.features.audience.dto.SubmitLeadRequestDTO;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.service.AudienceRoleAccessService;
import vacademy.io.admin_core_service.features.audience.service.AudienceRoleAccessService.EffectiveAccess;
import vacademy.io.admin_core_service.features.audience.service.AudienceRoleAccessService.Mode;
import vacademy.io.admin_core_service.features.audience.service.LeadCreatorAttributionService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Who owns a lead an admin-panel user just typed in.
 *
 * <p>This is the half of the assigned-only option that writes data rather than
 * filtering it, so getting it wrong is not a display bug: stamp too eagerly and
 * leads that belonged in the shared pool get silently claimed by whoever entered
 * them; stamp too rarely and a scoped counsellor watches their own lead vanish
 * the moment they save it.
 */
class LeadCreatorAttributionServiceTest {

    private static final String AUDIENCE = "aud-1";
    private static final String INSTITUTE = "inst-1";
    private static final String CALLER = "user-1";

    private AudienceRoleAccessService roleAccessService;
    private AudienceRepository audienceRepository;
    private LeadCreatorAttributionService service;
    private CustomUserDetails caller;

    @BeforeEach
    void setUp() {
        roleAccessService = mock(AudienceRoleAccessService.class);
        audienceRepository = mock(AudienceRepository.class);
        service = new LeadCreatorAttributionService(roleAccessService, audienceRepository);

        caller = mock(CustomUserDetails.class);
        when(caller.getUserId()).thenReturn(CALLER);
        when(audienceRepository.findById(AUDIENCE))
                .thenReturn(Optional.of(Audience.builder().id(AUDIENCE).instituteId(INSTITUTE).build()));
    }

    private void withAccess(Mode mode, boolean assignedOnly) {
        when(roleAccessService.resolveForCaller(any(), anyString()))
                .thenReturn(new EffectiveAccess(mode, List.of(AUDIENCE), assignedOnly));
    }

    private static SubmitLeadRequestDTO row(String counsellorId) {
        SubmitLeadRequestDTO dto = new SubmitLeadRequestDTO();
        dto.setAudienceId(AUDIENCE);
        dto.setCounsellorId(counsellorId);
        return dto;
    }

    @Test
    void stampsTheCreatorWhenAssignedOnlyIsInEffect() {
        withAccess(Mode.AUDIENCE_LIST, true);
        SubmitLeadRequestDTO dto = row(null);

        service.applyCreatorAsCounsellor(dto, caller);

        assertEquals(CALLER, dto.getCounsellorId());
    }

    @Test
    void leavesAnExplicitlyChosenOwnerAlone() {
        withAccess(Mode.AUDIENCE_LIST, true);
        SubmitLeadRequestDTO dto = row("someone-else");

        service.applyCreatorAsCounsellor(dto, caller);

        assertEquals("someone-else", dto.getCounsellorId());
    }

    /** Without the opt-in the lead stays unowned, so the normal pipeline decides. */
    @Test
    void doesNothingWhenTheRoleOnlyHasPlainListAccess() {
        withAccess(Mode.AUDIENCE_LIST, false);
        SubmitLeadRequestDTO dto = row(null);

        service.applyCreatorAsCounsellor(dto, caller);

        assertNull(dto.getCounsellorId());
    }

    @Test
    void doesNothingForDefaultAccess() {
        withAccess(Mode.DEFAULT, false);
        SubmitLeadRequestDTO dto = row(null);

        service.applyCreatorAsCounsellor(dto, caller);

        assertNull(dto.getCounsellorId());
    }

    @Test
    void doesNothingWhenTheAudienceIsUnknown() {
        withAccess(Mode.AUDIENCE_LIST, true);
        when(audienceRepository.findById("missing")).thenReturn(Optional.empty());
        SubmitLeadRequestDTO dto = new SubmitLeadRequestDTO();
        dto.setAudienceId("missing");

        service.applyCreatorAsCounsellor(dto, caller);

        assertNull(dto.getCounsellorId());
    }

    @Test
    void bulkImportStampsOwnerlessRowsAndKeepsTheOwnerColumn() {
        withAccess(Mode.AUDIENCE_LIST, true);
        SubmitLeadRequestDTO ownerless = row(null);
        SubmitLeadRequestDTO owned = row("someone-else");
        BulkSubmitLeadRequestDTO request = BulkSubmitLeadRequestDTO.builder()
                .audienceId(AUDIENCE)
                .rows(List.of(ownerless, owned))
                .build();

        service.applyCreatorAsCounsellor(request, caller);

        assertEquals(CALLER, ownerless.getCounsellorId());
        assertEquals("someone-else", owned.getCounsellorId());
    }

    /** Rows carry the audience when the root omits it — resolution must still find the institute. */
    @Test
    void bulkImportResolvesTheAudienceFromTheRowsWhenTheRootOmitsIt() {
        withAccess(Mode.AUDIENCE_LIST, true);
        SubmitLeadRequestDTO ownerless = row(null);
        BulkSubmitLeadRequestDTO request = BulkSubmitLeadRequestDTO.builder()
                .rows(List.of(ownerless))
                .build();

        service.applyCreatorAsCounsellor(request, caller);

        assertEquals(CALLER, ownerless.getCounsellorId());
    }

    /** Anonymous intake has no creator — the public endpoints must stay unaffected. */
    @Test
    void doesNothingWithoutACaller() {
        withAccess(Mode.AUDIENCE_LIST, true);
        SubmitLeadRequestDTO dto = row(null);

        service.applyCreatorAsCounsellor(dto, null);

        assertNull(dto.getCounsellorId());
    }
}
