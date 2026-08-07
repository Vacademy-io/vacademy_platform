package vacademy.io.admin_core_service.features.super_admin.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.super_admin.dto.SuperAdminCallDTO;
import vacademy.io.admin_core_service.features.super_admin.dto.SuperAdminCallSummaryDTO;
import vacademy.io.admin_core_service.features.super_admin.dto.SuperAdminPageResponse;

import java.math.BigDecimal;
import java.util.*;

/**
 * Every AI call across every institute, with what it cost and what it earned.
 *
 * <p>WHAT IS REAL AND WHAT IS NOT. Duration, disposition, health and the
 * diagnostics blob are recorded per call and are exact. Cost is NOT: the voice
 * bot does not report token or character usage (ai_token_usage holds no voice
 * rows) and telephony_call_log.price is null on all 9,690 rows — so every rupee
 * is duration x a voice_call_rate_card row. The DTO carries costIsModelled so
 * the UI can say so rather than imply a precision we do not have.
 *
 * <p>Recording lives on the JOINED telephony_call_log row (274 of 280 recent
 * calls have one); ai_call_result.recording_url is empty on every row.
 */
@Slf4j
@Service
public class SuperAdminCallService {

    @PersistenceContext
    private EntityManager em;

    // EVERY bind parameter is CAST explicitly. Postgres cannot infer a type for
    // `$1 IS NULL` — the null-safe optional-filter idiom — and fails the whole
    // statement with "could not determine data type of parameter $1", which the
    // global handler turns into a 511. Live symptom: /calls and /calls/summary
    // both 511'd while /calls/rate-card returned 200, because rate-card is the
    // only query here that binds nothing.
    private static final String BASE_FROM = """
            FROM ai_call_result r
            LEFT JOIN telephony_call_log l ON l.id = r.call_log_id
            LEFT JOIN ai_agent a ON a.id = r.campaign_id
            LEFT JOIN institutes i ON i.id = r.institute_id
            WHERE (CAST(:instituteId AS text) IS NULL OR r.institute_id = CAST(:instituteId AS text))
              AND (CAST(:fromTs AS text) IS NULL OR r.created_at >= CAST(:fromTs AS timestamp))
              AND (CAST(:toTs   AS text) IS NULL OR r.created_at <  CAST(:toTs   AS timestamp))
              AND (CAST(:health AS text) IS NULL OR r.diag_health = CAST(:health AS text))
              AND (CAST(:disposition AS text) IS NULL OR r.disposition = CAST(:disposition AS text))
              AND (CAST(:agentId AS text) IS NULL OR r.campaign_id = CAST(:agentId AS text))
            """;

    /** engine -> credits/min surcharge, read live so it cannot drift from billing. */
    @Transactional(readOnly = true)
    public Map<String, Double> ttsSurcharges() {
        Map<String, Double> out = new LinkedHashMap<>();
        List<Object[]> rows = em.createNativeQuery(
                "SELECT model, surcharge_credits_per_min FROM ai_tts_model_pricing WHERE is_active")
                .getResultList();
        for (Object[] r : rows) out.put((String) r[0], ((Number) r[1]).doubleValue());
        return out;
    }

    /** request_type -> (credits/min, per-call minimum), straight from credit_pricing. */
    @Transactional(readOnly = true)
    public Map<String, double[]> creditPricing() {
        Map<String, double[]> out = new LinkedHashMap<>();
        List<Object[]> rows = em.createNativeQuery(
                "SELECT request_type, token_rate, minimum_charge FROM credit_pricing WHERE is_active")
                .getResultList();
        for (Object[] r : rows) {
            out.put((String) r[0], new double[]{
                    ((Number) r[1]).doubleValue(), ((Number) r[2]).doubleValue()});
        }
        return out;
    }

    /**
     * What this call ACTUALLY billed, in rupees — mirroring CallBillingService.
     *
     * <p>Modelling this as a flat rupees-per-minute was wrong twice over, and the
     * founder caught both on a 30-second call the page priced at Rs 1.86 when the
     * wallet had really taken Rs 9.30:
     *
     * <ul>
     *   <li>Billing CEILS to whole minutes with a per-call floor —
     *       {@code max(minimum, ceil(secs/60) x perMinute)} — so a six-second call
     *       bills a full minute, not a tenth of one.</li>
     *   <li>There are TWO meters, not one: the telephony leg
     *       (voice_call_out/in, on Vacademy-paid trunks only) AND the AI leg
     *       (ai_call_out/in), and the TTS engine surcharge rides on the AI leg.</li>
     * </ul>
     *
     * <p>Rates come from credit_pricing and the surcharge from
     * ai_tts_model_pricing — the same two tables the billing path itself reads,
     * so this cannot drift from what the wallet actually charged. It is still a
     * RECONSTRUCTION, not the ledger: a negotiated per-institute override
     * suppresses the surcharge in the real path and is not modelled here.
     */
    private double billedInr(Map<String, Double> card, Map<String, Double> surcharge,
                             Map<String, double[]> pricing, String engine,
                             String direction, String providerType, int seconds) {
        if (seconds <= 0) return 0d;
        long minutes = (seconds + 59) / 60;                 // ceil, min 1 — as billed
        // A per-engine flat rupee rate overrides the credit computation entirely.
        // Edge is free to us, so it is sold at a cheaper flat rate rather than at
        // the standard voice+ai credit stack.
        String eng = (engine == null || engine.isBlank()) ? "sarvam" : engine.trim().toLowerCase();
        Double flat = card.get("billed_inr_per_min_" + eng);
        if (flat != null && flat > 0) return flat * minutes;
        boolean inbound = "INBOUND".equalsIgnoreCase(direction);
        String e = (engine == null || engine.isBlank()) ? "sarvam" : engine.trim().toLowerCase();

        double credits = 0d;
        // Telephony leg — only on trunks Vacademy pays for.
        String pt = providerType == null ? "" : providerType.toUpperCase();
        if (pt.contains("PLIVO") || pt.contains("VACADEMY")) {
            double[] v = pricing.get(inbound ? "voice_call_in" : "voice_call_out");
            if (v != null) credits += Math.max(v[1], v[0] * minutes);
        }
        // AI leg — engine surcharge rides here.
        double[] a = pricing.get(inbound ? "ai_call_in" : "ai_call_out");
        if (a != null) {
            credits += Math.max(a[1], (a[0] + surcharge.getOrDefault(e, 0d)) * minutes);
        }
        return credits * card.getOrDefault("credit_inr", 0d);
    }

    /** component -> INR/min, from the rate card. Missing component = 0, never a guess. */
    @Transactional(readOnly = true)
    public Map<String, Double> rateCard() {
        Map<String, Double> out = new LinkedHashMap<>();
        List<Object[]> rows = em.createNativeQuery(
                "SELECT component, inr_per_min FROM voice_call_rate_card WHERE is_active").getResultList();
        for (Object[] r : rows) {
            out.put((String) r[0], ((Number) r[1]).doubleValue());
        }
        return out;
    }

    /**
     * Per-component rupee cost.
     *
     * <p>Plivo is billed in WHOLE MINUTES — a six-second call still costs a full
     * minute — so it is ceiled. STT, TTS and the LLM are genuine usage meters
     * (per second, per character, per token) and stay fractional. Charging the
     * telephony leg fractionally understated every short call.
     */
    private Map<String, Double> breakdown(Map<String, Double> card, String ttsModel,
                                          double minutes, int seconds) {
        String engine = (ttsModel == null || ttsModel.isBlank()) ? "sarvam" : ttsModel.trim().toLowerCase();
        long billedMinutes = seconds <= 0 ? 0 : (seconds + 59) / 60;
        Map<String, Double> b = new LinkedHashMap<>();
        b.put("plivo", round(card.getOrDefault("plivo", 0d) * billedMinutes));
        b.put("stt", round(card.getOrDefault("stt_sarvam", 0d) * minutes));
        b.put("tts", round(card.getOrDefault("tts_" + engine, 0d) * minutes));
        b.put("llm", round(card.getOrDefault("llm", 0d) * minutes));
        return b;
    }

    private static double round(double v) {
        return BigDecimal.valueOf(v).setScale(2, java.math.RoundingMode.HALF_UP).doubleValue();
    }

    private void bind(Query q, String instituteId, String from, String to,
                      String health, String disposition, String agentId) {
        q.setParameter("instituteId", blank(instituteId));
        q.setParameter("fromTs", blank(from));
        q.setParameter("toTs", blank(to));
        q.setParameter("health", blank(health));
        q.setParameter("disposition", blank(disposition));
        q.setParameter("agentId", blank(agentId));
    }

    private static String blank(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    @Transactional(readOnly = true)
    public SuperAdminPageResponse<SuperAdminCallDTO> list(
            String instituteId, String from, String to, String health,
            String disposition, String agentId, int page, int size) {

        Map<String, Double> card = rateCard();
        Map<String, Double> surcharge = ttsSurcharges();
        Map<String, double[]> pricing = creditPricing();

        Query q = em.createNativeQuery("""
                SELECT r.id, r.correlation_id, r.institute_id, i.name,
                       r.campaign_id, a.name, a.tts_model, a.voice,
                       r.phone_number, r.customer_name, r.direction, r.status, r.disposition,
                       r.call_start, r.duration_seconds,
                       COALESCE(l.recording_url, r.recording_url),
                       r.diag_health, r.diag_faults, CAST(r.diagnostics AS text),
                       l.provider_type, COALESCE(l.provider_call_id, r.call_uuid)
                """ + BASE_FROM + " ORDER BY r.created_at DESC LIMIT :lim OFFSET :off");
        bind(q, instituteId, from, to, health, disposition, agentId);
        q.setParameter("lim", size);
        q.setParameter("off", (long) page * size);

        List<Object[]> rows = q.getResultList();
        List<SuperAdminCallDTO> content = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            int secs = r[14] == null ? 0 : ((Number) r[14]).intValue();
            double minutes = secs / 60.0;
            String tts = (String) r[6];
            Map<String, Double> b = breakdown(card, tts, minutes, secs);
            double cost = round(b.values().stream().mapToDouble(Double::doubleValue).sum());
            double billed = round(billedInr(card, surcharge, pricing, tts,
                    (String) r[10], (String) r[19], secs));
            double margin = round(billed - cost);
            String recording = (String) r[15];
            content.add(SuperAdminCallDTO.builder()
                    .id((String) r[0]).correlationId((String) r[1])
                    .instituteId((String) r[2]).instituteName((String) r[3])
                    .agentId((String) r[4]).agentName((String) r[5])
                    .ttsModel(tts == null ? "sarvam" : tts).voice((String) r[7])
                    .phoneNumber((String) r[8]).customerName((String) r[9])
                    .direction((String) r[10]).status((String) r[11]).disposition((String) r[12])
                    .callStart(toDate(r[13]))
                    .durationSeconds(secs)
                    .recordingUrl(recording).hasRecording(recording != null && !recording.isBlank())
                    .health((String) r[16])
                    .faults(splitFaults((String) r[17]))
                    .diagnostics((String) r[18])
                    .costInr(cost).billedInr(billed).marginInr(margin)
                    .marginPct(billed > 0 ? round(margin / billed * 100) : null)
                    .costBreakdown(b).costIsModelled(true)
                    .providerCallId((String) r[20])
                    .build());
        }

        Query cq = em.createNativeQuery("SELECT count(*) " + BASE_FROM);
        bind(cq, instituteId, from, to, health, disposition, agentId);
        long total = ((Number) cq.getSingleResult()).longValue();

        return SuperAdminPageResponse.<SuperAdminCallDTO>builder()
                .content(content).page(page).size(size)
                .totalElements(total)
                .totalPages((int) Math.ceil((double) total / Math.max(size, 1)))
                .build();
    }

    /**
     * A native query's timestamp column comes back as whatever the Hibernate
     * version feels like — Hibernate 6 hands back java.time.Instant, older ones
     * java.sql.Timestamp. Casting to one of them blew up in production with
     * "class java.time.Instant cannot be cast to class java.sql.Timestamp", so
     * accept all of them rather than bet on the mapping.
     */
    private static Date toDate(Object o) {
        if (o == null) return null;
        if (o instanceof Date d) return d;                       // covers java.sql.Timestamp
        if (o instanceof java.time.Instant i) return Date.from(i);
        if (o instanceof java.time.LocalDateTime ldt) {
            return Date.from(ldt.atZone(java.time.ZoneOffset.UTC).toInstant());
        }
        if (o instanceof java.time.OffsetDateTime odt) return Date.from(odt.toInstant());
        return null;
    }

    private static List<String> splitFaults(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split("[,\\s]+")).filter(s -> !s.isBlank()).toList();
    }

    /**
     * Totals for the filtered set. Aggregated in SQL per TTS engine, because the
     * TTS rate differs per engine and summing a blended average would quietly
     * misprice any institute running a mix.
     */
    @Transactional(readOnly = true)
    public SuperAdminCallSummaryDTO summary(String instituteId, String from, String to,
                                            String health, String disposition, String agentId) {
        Map<String, Double> card = rateCard();
        Map<String, Double> surcharge = ttsSurcharges();
        Map<String, double[]> pricing = creditPricing();
        Query q = em.createNativeQuery("""
                SELECT COALESCE(a.tts_model,'sarvam') AS engine,
                       count(*),
                       COALESCE(sum(r.duration_seconds),0),
                       count(*) FILTER (WHERE r.diag_health = 'RED'),
                       count(*) FILTER (WHERE r.diag_health = 'AMBER'),
                       count(*) FILTER (WHERE r.diag_health = 'GREEN'),
                       count(*) FILTER (WHERE COALESCE(l.recording_url, r.recording_url) IS NOT NULL),
                       COALESCE(sum(CASE WHEN r.duration_seconds > 0
                                         THEN (r.duration_seconds + 59) / 60 ELSE 0 END), 0),
                       COALESCE(sum(CASE WHEN COALESCE(l.provider_type,'') ~* '(plivo|vacademy)'
                                          AND r.duration_seconds > 0
                                         THEN (r.duration_seconds + 59) / 60 ELSE 0 END), 0),
                       COALESCE(sum(CASE WHEN COALESCE(r.direction,'') ILIKE 'INBOUND'
                                          AND r.duration_seconds > 0
                                         THEN (r.duration_seconds + 59) / 60 ELSE 0 END), 0)
                """ + BASE_FROM + " GROUP BY 1");
        bind(q, instituteId, from, to, health, disposition, agentId);

        long calls = 0, red = 0, amber = 0, green = 0, rec = 0;
        double minutes = 0, cost = 0, billedTotal = 0;
        Map<String, Double> agg = new LinkedHashMap<>(
                Map.of("plivo", 0d, "stt", 0d, "tts", 0d, "llm", 0d));
        Map<String, Long> byEngine = new LinkedHashMap<>();

        for (Object[] r : (List<Object[]>) q.getResultList()) {
            String engine = (String) r[0];
            long n = ((Number) r[1]).longValue();
            double mins = ((Number) r[2]).doubleValue() / 60.0;
            calls += n; minutes += mins;
            red += ((Number) r[3]).longValue();
            amber += ((Number) r[4]).longValue();
            green += ((Number) r[5]).longValue();
            rec += ((Number) r[6]).longValue();
            byEngine.merge(engine, n, Long::sum);
            long billedMins = ((Number) r[7]).longValue();     // ceil-minutes, as billed
            long trunkMins = ((Number) r[8]).longValue();
            long inboundMins = ((Number) r[9]).longValue();

            Map<String, Double> b = new LinkedHashMap<>();
            b.put("plivo", round(card.getOrDefault("plivo", 0d) * billedMins));
            b.put("stt", round(card.getOrDefault("stt_sarvam", 0d) * mins));
            b.put("tts", round(card.getOrDefault("tts_" + engine, 0d) * mins));
            b.put("llm", round(card.getOrDefault("llm", 0d) * mins));
            b.forEach((k, v) -> agg.merge(k, v, Double::sum));
            cost += b.values().stream().mapToDouble(Double::doubleValue).sum();

            // Revenue, per engine and per meter, on CEIL-minutes as billing does.
            double credits = 0d;
            double[] vOut = pricing.get("voice_call_out"), vIn = pricing.get("voice_call_in");
            double[] aOut = pricing.get("ai_call_out"), aIn = pricing.get("ai_call_in");
            if (vOut != null) credits += vOut[0] * Math.max(0, trunkMins - inboundMins);
            if (vIn != null) credits += vIn[0] * Math.min(trunkMins, inboundMins);
            Double flatEngine = card.get("billed_inr_per_min_" + engine);
            if (flatEngine != null && flatEngine > 0) {
                billedTotal += flatEngine * billedMins;
                continue;                      // flat rate replaces the credit stack
            }
            double sur = surcharge.getOrDefault(engine, 0d);
            if (aOut != null) credits += (aOut[0] + sur) * Math.max(0, billedMins - inboundMins);
            if (aIn != null) credits += (aIn[0] + sur) * inboundMins;
            billedTotal += credits * card.getOrDefault("credit_inr", 0d);
        }
        agg.replaceAll((k, v) -> round(v));
        double billed = round(billedTotal);
        double margin = round(billed - round(cost));
        return SuperAdminCallSummaryDTO.builder()
                .calls(calls).minutes(round(minutes))
                .costInr(round(cost)).billedInr(billed).marginInr(margin)
                .marginPct(billed > 0 ? round(margin / billed * 100) : null)
                .red(red).amber(amber).green(green).withRecording(rec)
                .costBreakdown(agg).byTtsModel(byEngine).costIsModelled(true)
                .build();
    }
}
