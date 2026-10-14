package vacademy.io.admin_core_service.features.super_admin.service;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * The health dashboard's revenue estimate for a call the ledger has not charged yet
 * must price it the way CallBillingService does: 30-second pulses, both meters, the
 * engine surcharge on the AI leg. It used ceil-MINUTES and booked a 77 s call at
 * 12 credits; the wallet took 9.
 */
class SuperAdminBilledEstimateTest {

    private final SuperAdminCallService svc = new SuperAdminCallService();
    private final Map<String, Double> card = Map.of("credit_inr", 1.0);
    private final Map<String, double[]> pricing = Map.of(
            "voice_call_out", new double[]{1.0, 0.0},
            "ai_call_out", new double[]{5.0, 0.0});
    private final Map<String, Double> surcharge = Map.of("sarvam", 4.0, "sarvam_v4", 0.0);

    @Test
    void billsInThirtySecondPulsesLikeTheWallet() {
        // 77 s = 3 pulses = 1.5 min: voice 1.5 + AI 7.5 = 9 credits.
        assertEquals(9.0, svc.billedInr(card, surcharge, pricing, "navana", "OUTBOUND", "VACADEMY_AI", 77), 1e-9);
        // 30 s is one pulse, not a whole minute.
        assertEquals(3.0, svc.billedInr(card, surcharge, pricing, "navana", "OUTBOUND", "VACADEMY_AI", 30), 1e-9);
        assertEquals(0.0, svc.billedInr(card, surcharge, pricing, "navana", "OUTBOUND", "VACADEMY_AI", 0), 1e-9);
    }

    @Test
    void engineSurchargeRidesTheAiLeg() {
        // Sarvam v3 carries +4/min; v4 Flash carries none.
        assertEquals(1.0 + 9.0, svc.billedInr(card, surcharge, pricing, "sarvam", "OUTBOUND", "VACADEMY_AI", 60), 1e-9);
        assertEquals(1.0 + 5.0, svc.billedInr(card, surcharge, pricing, "sarvam_v4", "OUTBOUND", "VACADEMY_AI", 60), 1e-9);
    }
}
