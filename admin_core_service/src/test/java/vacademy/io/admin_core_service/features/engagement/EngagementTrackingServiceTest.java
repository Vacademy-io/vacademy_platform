package vacademy.io.admin_core_service.features.engagement;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementAttempt;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementItem;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementPlan;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementSlot;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementAttemptRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementItemRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementPlanRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementSlotRepository;
import vacademy.io.admin_core_service.features.engagement.service.EngagementScheduleResolver;
import vacademy.io.admin_core_service.features.engagement.service.EngagementTrackingService;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.common.auth.dto.UserDTO;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The item CSV export is opened in Excel / Sheets by teachers, and names and answers in
 * it are typed by learners. A learner called "=HYPERLINK(...)" must come out as text,
 * not as a live formula, and Hindi / Arabic names must survive the round trip.
 */
class EngagementTrackingServiceTest {

    @Test
    @DisplayName("csvCell quotes plain values and doubles embedded quotes")
    void quotesPlainValues() {
        assertEquals("\"Asha\"", EngagementTrackingService.csvCell("Asha"));
        assertEquals("\"Rao, Asha\"", EngagementTrackingService.csvCell("Rao, Asha"));
        assertEquals("\"say \"\"hi\"\"\"", EngagementTrackingService.csvCell("say \"hi\""));
    }

    @Test
    @DisplayName("csvCell writes null and empty as an empty cell")
    void nullAndEmpty() {
        assertEquals("", EngagementTrackingService.csvCell(null));
        assertEquals("", EngagementTrackingService.csvCell(""));
    }

    @Test
    @DisplayName("csvCell prefixes an apostrophe to every formula trigger")
    void neutralisesFormulaTriggers() {
        assertEquals("\"'=1+1\"", EngagementTrackingService.csvCell("=1+1"));
        assertEquals("\"'+91 98765\"", EngagementTrackingService.csvCell("+91 98765"));
        assertEquals("\"'-2+3\"", EngagementTrackingService.csvCell("-2+3"));
        assertEquals("\"'@SUM(A1)\"", EngagementTrackingService.csvCell("@SUM(A1)"));
        assertEquals("\"'\tcmd\"", EngagementTrackingService.csvCell("\tcmd"));
        assertEquals("\"'\rcmd\"", EngagementTrackingService.csvCell("\rcmd"));
        // The quote-doubling still applies after the prefix.
        assertEquals("\"'=HYPERLINK(\"\"x\"\")\"",
                EngagementTrackingService.csvCell("=HYPERLINK(\"x\")"));
    }

    @Test
    @DisplayName("csvCell leaves a trigger character alone when it is not the first character")
    void triggerMidValueIsFine() {
        assertEquals("\"a=b\"", EngagementTrackingService.csvCell("a=b"));
        assertEquals("\"नमस्ते\"", EngagementTrackingService.csvCell("नमस्ते"));
    }

    @Test
    @DisplayName("exportItemCsv starts with a UTF-8 BOM and escapes a formula-shaped name")
    void exportHasBomAndEscapedCells() {
        EngagementItemRepository items = mock(EngagementItemRepository.class);
        EngagementSlotRepository slots = mock(EngagementSlotRepository.class);
        EngagementPlanRepository plans = mock(EngagementPlanRepository.class);
        EngagementAttemptRepository attempts = mock(EngagementAttemptRepository.class);
        AuthService auth = mock(AuthService.class);

        EngagementItem item = new EngagementItem();
        item.setId("item-1");
        item.setSlotId("slot-1");
        EngagementSlot slot = new EngagementSlot();
        slot.setId("slot-1");
        slot.setPlanId("plan-1");
        EngagementPlan plan = new EngagementPlan();
        plan.setId("plan-1");
        plan.setInstituteId("inst-1");
        when(items.findById("item-1")).thenReturn(Optional.of(item));
        when(slots.findById("slot-1")).thenReturn(Optional.of(slot));
        when(plans.findById("plan-1")).thenReturn(Optional.of(plan));

        EngagementAttempt attempt = new EngagementAttempt();
        attempt.setUserId("u-1");
        attempt.setItemId("item-1");
        attempt.setStatus("COMPLETED");
        attempt.setResponseJson("{\"textAnswer\":\"@cmd\"}");
        when(attempts.findByItem("item-1")).thenReturn(List.of(attempt));

        UserDTO user = new UserDTO();
        user.setId("u-1");
        user.setFullName("=1+1");
        user.setUsername("asha");
        when(auth.getUsersFromAuthServiceByUserIds(anyList())).thenReturn(List.of(user));

        EngagementTrackingService service = new EngagementTrackingService(
                items, slots, plans, attempts, auth,
                mock(EngagementScheduleResolver.class),
                mock(StudentSessionInstituteGroupMappingRepository.class),
                new ObjectMapper());

        String csv = service.exportItemCsv("item-1", "inst-1");
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
        assertArrayEquals(new byte[] {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF},
                new byte[] {bytes[0], bytes[1], bytes[2]});

        String[] lines = csv.substring(1).split("\n");
        assertTrue(lines[0].startsWith("Name,Username,Email"));
        assertTrue(lines[1].startsWith("\"'=1+1\",\"asha\","), lines[1]);
        assertTrue(lines[1].contains(",\"'@cmd\","), lines[1]);
    }
}
