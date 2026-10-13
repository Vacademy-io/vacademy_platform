package vacademy.io.admin_core_service.features.telephony.publicapi;

import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.telephony.core.AiCallService;
import vacademy.io.admin_core_service.features.telephony.enums.CallTrigger;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AiAgent;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.AiAgentRepository;
import vacademy.io.admin_core_service.features.telephony.publicapi.entity.AiCallApiCall;
import vacademy.io.admin_core_service.features.telephony.publicapi.repository.AiCallApiCallRepository;
import vacademy.io.common.exceptions.ConflictException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

class AiCallingApiServiceTest {

    private final AiCallingApiService service = new AiCallingApiService(null, null, null, null, null, null, null);

    private static AiAgent agent() {
        AiAgent a = new AiAgent();
        a.setId("agent-1");
        a.setEnabled(true);
        a.setDirection("OUTBOUND");
        return a;
    }

    @Test
    void phoneNumbersMustBeE164AfterRemovingFormatting() {
        assertEquals("+919876543210", AiCallingApiService.normalisePhone("+91 98765-43210"));
        assertEquals("+919876543210", AiCallingApiService.normalisePhone("+91 (98765) 43210"));
        assertEquals("+14155552671", AiCallingApiService.normalisePhone("0014155552671"));
        assertNull(AiCallingApiService.normalisePhone("9876543210"));       // no country code
        assertNull(AiCallingApiService.normalisePhone("+0123456789"));      // country code cannot start with 0
        assertNull(AiCallingApiService.normalisePhone("+12"));              // too short
        assertNull(AiCallingApiService.normalisePhone("+9198765432101234")); // too long
        assertNull(AiCallingApiService.normalisePhone(null));
    }

    @Test
    void theContactUserIdIsStablePerInstituteAndNumber() {
        String a = AiCallingApiService.contactUserId("inst-1", "+919876543210");
        assertEquals(a, AiCallingApiService.contactUserId("inst-1", "+919876543210"));
        assertNotEquals(a, AiCallingApiService.contactUserId("inst-2", "+919876543210"));
        assertNotEquals(a, AiCallingApiService.contactUserId("inst-1", "+919876543211"));
    }

    @Test
    void placeholdersAreFoundInOpeningAndPrompt() {
        Set<String> found = AiCallingApiService.placeholders("Hi {{name}}, about {{ Course }}", "City: {{city}} {{course}}");
        assertEquals(Set.of("name", "course", "city"), found);
    }

    @Test
    void aValidCallPasses() {
        Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("course", "NEET");
        vars.put("seats left", 12);
        vars.put("paid", true);
        AiCallingApiService.Validated v = service.validate("inst-1", new AiCallingApiService.CallInput(
                "agent-1", "+91 98765 43210", "  Ravi Kumar ", "ravi@example.com", "crm-42", vars,
                Map.of("deal", "D-9")), agent());
        assertTrue(v.errors().isEmpty(), v.errors().toString());
        assertEquals("+919876543210", v.phone());
        assertEquals("Ravi Kumar", v.name());
        assertEquals(Map.of("course", "NEET", "seats left", "12", "paid", "true"), v.variables());
        assertEquals(Map.of("deal", "D-9"), v.metadata());
    }

    @Test
    void badFieldsAreAllReportedWithTheirNames() {
        Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("9lives", "x");                 // must start with a letter
        vars.put("nested", Map.of("a", "b"));    // values are scalars
        vars.put("long", "x".repeat(501));       // too long
        AiCallingApiService.Validated v = service.validate("inst-1", new AiCallingApiService.CallInput(
                "agent-1", "12345", null, "not-an-email", null, vars, null), agent());
        List<String> fields = v.errors().stream().map(e -> e.get("field")).toList();
        assertTrue(fields.contains("phone_number"), fields.toString());
        assertTrue(fields.contains("contact.email"), fields.toString());
        assertTrue(fields.contains("variables.9lives"), fields.toString());
        assertTrue(fields.contains("variables.nested"), fields.toString());
        assertTrue(fields.contains("variables.long"), fields.toString());
    }

    @Test
    void oversizedMetadataIsRefused() {
        AiCallingApiService.Validated v = service.validate("inst-1", new AiCallingApiService.CallInput(
                "agent-1", "+919876543210", null, null, null, null, Map.of("blob", "x".repeat(9000))), agent());
        assertEquals("metadata", v.errors().get(0).get("field"));
    }

    @Test
    void idsCarryTheirPrefix() {
        assertTrue(AiCallingApiService.newId("call_").matches("^call_[0-9a-f]{24}$"));
        assertTrue(AiCallingApiService.newId("batch_").matches("^batch_[0-9a-f]{24}$"));
    }

    @Test
    void idempotencyKeysAreTrimmedAndBounded() {
        assertNull(AiCallingApiService.normaliseIdempotencyKey("  "));
        assertEquals("abc", AiCallingApiService.normaliseIdempotencyKey(" abc "));
        assertThrows(AiCallingApiException.class, () -> AiCallingApiService.normaliseIdempotencyKey("k".repeat(256)));
    }

    @Test
    void aTestCallThatCannotBePlacedLeavesNoRowBehind() {
        AiAgentRepository agents = mock(AiAgentRepository.class);
        AiCallApiCallRepository calls = mock(AiCallApiCallRepository.class);
        AiCallService aiCalls = mock(AiCallService.class);
        when(agents.findByIdAndInstituteId("agent-1", "inst-1")).thenReturn(Optional.of(agent()));
        when(calls.findByInstituteIdAndIdempotencyKey("inst-1", "k-1")).thenReturn(Optional.empty());
        when(calls.saveAndFlush(any(AiCallApiCall.class))).thenAnswer(i -> i.getArgument(0));
        when(aiCalls.placeCall(any(), isNull(), eq(CallTrigger.API))).thenThrow(new ConflictException("out of credits"));
        AiCallingApiService svc = new AiCallingApiService(agents, calls, null, null, null, aiCalls, null);

        assertThrows(ConflictException.class, () -> svc.createCall(
                new AiCallingApiAuth.Principal("inst-1", "key-1", List.of("calls:write")),
                new AiCallingApiService.CallInput("agent-1", "+919876543210", "Asha", null, null, null, null),
                true, "k-1"));
        // Without the delete, a retry with Idempotency-Key k-1 would replay a call that never happened.
        verify(calls).delete(any(AiCallApiCall.class));
    }
}
