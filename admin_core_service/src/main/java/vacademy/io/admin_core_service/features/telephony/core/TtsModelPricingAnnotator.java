package vacademy.io.admin_core_service.features.telephony.core;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Stamps each TTS engine with what a minute on it actually costs the institute.
 *
 * <p>Choosing an engine in the agent editor IS a pricing decision, and the only
 * hint used to be a hand-written "+4 credits per minute" on Sarvam — which is
 * the SMALLEST part of the bill. A minute is billed twice before any surcharge:
 * the telephony leg ({@code voice_call_out/in}) and the AI leg
 * ({@code ai_call_out/in}). The honest figure is 6 credits/min on most engines
 * and 10 on Sarvam.
 *
 * <p>Read from credit_pricing and ai_tts_model_pricing — the same two tables
 * CallBillingService charges from — so the number under the dropdown cannot
 * drift from the number on the invoice. Hard-coding it in the frontend would
 * have drifted the first time a rate changed.
 */
@Slf4j
@Component
public class TtsModelPricingAnnotator {

    @PersistenceContext
    private EntityManager em;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> annotate(List<Map<String, Object>> models) {
        double voice;
        double ai;
        Map<String, Double> surcharge = new LinkedHashMap<>();
        try {
            voice = rate("voice_call_out");
            ai = rate("ai_call_out");
            List<Object[]> rows = em.createNativeQuery(
                            "SELECT model, surcharge_credits_per_min FROM ai_tts_model_pricing WHERE is_active")
                    .getResultList();
            for (Object[] r : rows) {
                surcharge.put((String) r[0], ((Number) r[1]).doubleValue());
            }
        } catch (Exception e) {
            // Degrade, never fail: an agent editor that 500s because one rate row
            // is missing helps nobody. The UI falls back to the prose note.
            log.warn("tts-models: pricing unreadable, serving catalog unannotated: {}", e.getMessage());
            return models;
        }
        for (Map<String, Object> m : models) {
            double tts = surcharge.getOrDefault(String.valueOf(m.get("id")), 0d);
            m.put("ttsCreditsPerMin", round(tts));
            m.put("callCreditsPerMin", round(voice + ai));
            m.put("totalCreditsPerMin", round(voice + ai + tts));
        }
        return models;
    }

    private double rate(String requestType) {
        List<?> rows = em.createNativeQuery(
                        "SELECT token_rate FROM credit_pricing WHERE request_type = :rt AND is_active")
                .setParameter("rt", requestType).getResultList();
        return rows.isEmpty() ? 0d : ((Number) rows.get(0)).doubleValue();
    }

    private static double round(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
