package vacademy.io.admin_core_service.features.offline_payment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.offline_payment.dto.OfflinePaymentDetailsDTO;
import vacademy.io.admin_core_service.features.offline_payment.dto.OfflinePaymentModesDTO;
import vacademy.io.admin_core_service.features.offline_payment.repository.InstituteOfflinePaymentSettingRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OfflinePaymentServicesTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private OfflinePaymentDetailsService detailsService(OfflinePaymentModesDTO modes, PaymentLogRepository logs) {
        OfflinePaymentModeService modeService = mock(OfflinePaymentModeService.class);
        when(modeService.getEffective(any())).thenReturn(modes);
        return new OfflinePaymentDetailsService(modeService, logs);
    }

    private static OfflinePaymentDetailsDTO details(String mode, String sub, String ref) {
        return OfflinePaymentDetailsDTO.builder().mode(mode).subMode(sub).reference(ref).build();
    }

    // ---------------- settings ----------------

    @Test
    @DisplayName("System defaults offer cash, UPI with PhonePe/GPay/Paytm, bank transfer, cheque, DD, card")
    void systemDefaults() {
        OfflinePaymentModesDTO d = OfflinePaymentModeService.systemDefaults();
        assertEquals(List.of("CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "DD", "CARD_POS"),
                d.getModes().stream().map(OfflinePaymentModesDTO.Mode::getCode).toList());
        assertEquals("CASH", d.getDefaultMode());
        assertEquals(3, d.getModes().get(1).getSubModes().size());
    }

    @Test
    @DisplayName("Saving derives codes from labels, trims text and keeps only known extra fields")
    void normalizeDerivesCodes() {
        OfflinePaymentModesDTO in = OfflinePaymentModesDTO.builder()
                .defaultMode("upi")
                .modes(List.of(OfflinePaymentModesDTO.Mode.builder()
                        .label("  UPI  ").active(true).extraFields(List.of("payer_name"))
                        .subModes(List.of(OfflinePaymentModesDTO.SubMode.builder().label("HDFC current ••4321").active(true).build()))
                        .build()))
                .build();
        OfflinePaymentModesDTO out = OfflinePaymentModeService.normalize(in);
        assertEquals("UPI", out.getModes().get(0).getCode());
        assertEquals("UPI", out.getModes().get(0).getLabel());
        assertEquals("HDFC_CURRENT_4321", out.getModes().get(0).getSubModes().get(0).getCode());
        assertEquals("UPI", out.getDefaultMode());
    }

    @Test
    @DisplayName("Saving rejects duplicate codes, unknown extras, a bad default and no active mode")
    void normalizeRejects() {
        OfflinePaymentModesDTO.Mode cash = OfflinePaymentModesDTO.Mode.builder().code("CASH").label("Cash").active(true).build();
        assertThrows(VacademyException.class, () -> OfflinePaymentModeService.normalize(
                OfflinePaymentModesDTO.builder().modes(List.of(cash, cash)).build()));
        assertThrows(VacademyException.class, () -> OfflinePaymentModeService.normalize(
                OfflinePaymentModesDTO.builder().modes(List.of(OfflinePaymentModesDTO.Mode.builder()
                        .label("Cheque").active(true).extraFields(List.of("ifsc")).build())).build()));
        assertThrows(VacademyException.class, () -> OfflinePaymentModeService.normalize(
                OfflinePaymentModesDTO.builder().defaultMode("UPI").modes(List.of(cash)).build()));
        assertThrows(VacademyException.class, () -> OfflinePaymentModeService.normalize(
                OfflinePaymentModesDTO.builder().modes(List.of(OfflinePaymentModesDTO.Mode.builder()
                        .code("CASH").label("Cash").active(false).build())).build()));
    }

    @Test
    @DisplayName("Stored JSON round-trips, including switched-off options")
    void storedJsonRoundTrips() throws Exception {
        OfflinePaymentModesDTO d = OfflinePaymentModeService.systemDefaults();
        d.getModes().get(1).getSubModes().get(2).setActive(false);
        OfflinePaymentModesDTO back = MAPPER.readValue(MAPPER.writeValueAsString(d), OfflinePaymentModesDTO.class);
        assertEquals(d, back);
        assertTrue(MAPPER.writeValueAsString(d).contains("\"sub_modes\""));
    }

    @Test
    @DisplayName("Missing 'active' in stored JSON means on")
    void activeDefaultsToTrue() throws Exception {
        OfflinePaymentModesDTO back = MAPPER.readValue(
                "{\"modes\":[{\"code\":\"CASH\",\"label\":\"Cash\",\"sub_modes\":[{\"code\":\"A\",\"label\":\"A\"}]}]}",
                OfflinePaymentModesDTO.class);
        assertTrue(back.getModes().get(0).isActive());
        assertTrue(back.getModes().get(0).getSubModes().get(0).isActive());
    }

    @Test
    @DisplayName("Unreadable stored JSON falls back to the defaults")
    void unreadableFallsBack() {
        InstituteOfflinePaymentSettingRepository repo = mock(InstituteOfflinePaymentSettingRepository.class);
        var row = new vacademy.io.admin_core_service.features.offline_payment.entity.InstituteOfflinePaymentSetting();
        row.setInstituteId("i");
        row.setSettingJson("not json");
        when(repo.findById("i")).thenReturn(Optional.of(row));
        assertEquals(6, new OfflinePaymentModeService(repo).getEffective("i").getModes().size());
    }

    // ---------------- resolve ----------------

    @Test
    @DisplayName("A known mode and option resolve with their labels")
    void resolvesModeAndSubMode() {
        OfflinePaymentDetailsService.Resolved r = detailsService(OfflinePaymentModeService.systemDefaults(), null)
                .resolve("i", details("upi", "phonepe", " 4182 "), null);
        assertEquals("UPI", r.mode());
        assertEquals("PHONEPE", r.subMode());
        assertEquals("4182", r.reference());
        assertEquals("UPI · PhonePe", r.describe());
    }

    @Test
    @DisplayName("Unknown or switched-off modes and options are rejected")
    void rejectsUnknownAndInactive() {
        OfflinePaymentModesDTO modes = OfflinePaymentModeService.systemDefaults();
        modes.getModes().get(4).setActive(false); // DD
        modes.getModes().get(1).getSubModes().get(2).setActive(false); // Paytm
        OfflinePaymentDetailsService svc = detailsService(modes, null);
        assertThrows(VacademyException.class, () -> svc.resolve("i", details("BITCOIN", null, null), null));
        assertThrows(VacademyException.class, () -> svc.resolve("i", details("DD", null, null), null));
        assertThrows(VacademyException.class, () -> svc.resolve("i", details("UPI", "PAYTM", null), null));
        assertThrows(VacademyException.class, () -> svc.resolve("i", details("UPI", "AMAZONPAY", null), null));
        assertThrows(VacademyException.class, () -> svc.resolve("i", details(null, "PHONEPE", null), null));
    }

    @Test
    @DisplayName("Required mode, reference and proof are enforced")
    void enforcesRequirements() {
        OfflinePaymentModesDTO modes = OfflinePaymentModeService.systemDefaults();
        modes.setRequireMode(true);
        modes.getModes().get(3).setReferenceRequired(true); // CHEQUE
        modes.getModes().get(2).setProofRequired(true); // BANK_TRANSFER
        OfflinePaymentDetailsService svc = detailsService(modes, null);
        assertThrows(VacademyException.class, () -> svc.resolve("i", null, "ref-only"));
        assertThrows(VacademyException.class, () -> svc.resolve("i", details("CHEQUE", null, null), null));
        assertEquals("000123", svc.resolve("i", details("CHEQUE", null, null), "000123").reference());
        assertThrows(VacademyException.class, () -> svc.resolve("i", details("BANK_TRANSFER", null, "UTR1"), null));
    }

    @Test
    @DisplayName("Without a mode, a legacy reference alone is still recorded; nothing at all returns null")
    void legacyReferenceOnly() {
        OfflinePaymentDetailsService svc = detailsService(OfflinePaymentModeService.systemDefaults(), null);
        assertNull(svc.resolve("i", null, null));
        OfflinePaymentDetailsService.Resolved r = svc.resolve("i", null, "TXN-9");
        assertNull(r.mode());
        assertEquals("TXN-9", r.reference());
        assertNull(r.describe());
    }

    @Test
    @DisplayName("Only the extras the mode asks for are kept")
    void keepsOnlyModeExtras() {
        OfflinePaymentDetailsDTO d = details("CHEQUE", null, "000123");
        d.setExtra(Map.of("cheque_date", "2026-10-10", "bank_name", "HDFC", "payer_name", "ignored"));
        OfflinePaymentDetailsService.Resolved r = detailsService(OfflinePaymentModeService.systemDefaults(), null)
                .resolve("i", d, null);
        assertEquals(Map.of("cheque_date", "2026-10-10", "bank_name", "HDFC"), r.extra());
    }

    // ---------------- apply ----------------

    @Test
    @DisplayName("apply writes the columns, label snapshot and keeps transaction_id for older readers")
    void applyWritesColumns() throws Exception {
        PaymentLogRepository logs = mock(PaymentLogRepository.class);
        PaymentLog log = new PaymentLog();
        log.setId("pl-1");
        log.setPaymentSpecificData("{\"source\":\"SIDE_VIEW_CPO\"}");
        when(logs.findById("pl-1")).thenReturn(Optional.of(log));
        OfflinePaymentDetailsDTO d = details("UPI", "GPAY", "UPI-77");
        d.setNotes("Paid by father");
        d.setPaymentDate(LocalDate.of(2026, 10, 12));
        OfflinePaymentDetailsService svc = detailsService(OfflinePaymentModeService.systemDefaults(), logs);

        svc.apply("pl-1", svc.resolve("i", d, null), "admin-1");

        assertEquals("UPI", log.getPaymentMode());
        assertEquals("GPAY", log.getPaymentSubMode());
        assertEquals("UPI-77", log.getPaymentReference());
        assertEquals("admin-1", log.getRecordedByUserId());
        JsonNode json = MAPPER.readTree(log.getPaymentDetailsJson());
        assertEquals("Google Pay", json.path("sub_mode_label").asText());
        assertEquals("Paid by father", json.path("notes").asText());
        JsonNode specific = MAPPER.readTree(log.getPaymentSpecificData());
        assertEquals("UPI-77", specific.path("transaction_id").asText());
        assertEquals("SIDE_VIEW_CPO", specific.path("source").asText());
        assertEquals("UPI-77", log.mapToDTO().getTransactionId());
    }
}
