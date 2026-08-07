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

    /**
     * What we BILL for a minute on this engine, in rupees.
     *
     * <p>Billing is by credits and the credits differ per TTS engine, so this is
     * (base credits + that engine's surcharge) x rupees per credit — never one
     * flat number. The surcharge comes from ai_tts_model_pricing, the same table
     * the billing path itself reads, so the two cannot disagree.
     */
    private double billedPerMin(Map<String, Double> card, Map<String, Double> surcharge, String engine) {
        String e = (engine == null || engine.isBlank()) ? "sarvam" : engine.trim().toLowerCase();
        double credits = card.getOrDefault("billed_base_credits_per_min", 0d)
                + surcharge.getOrDefault(e, 0d);
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

    private Map<String, Double> breakdown(Map<String, Double> card, String ttsModel, double minutes) {
        String engine = (ttsModel == null || ttsModel.isBlank()) ? "sarvam" : ttsModel.trim().toLowerCase();
        Map<String, Double> b = new LinkedHashMap<>();
        b.put("plivo", round(card.getOrDefault("plivo", 0d) * minutes));
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

        Query q = em.createNativeQuery("""
                SELECT r.id, r.correlation_id, r.institute_id, i.name,
                       r.campaign_id, a.name, a.tts_model, a.voice,
                       r.phone_number, r.customer_name, r.direction, r.status, r.disposition,
                       r.call_start, r.duration_seconds,
                       COALESCE(l.recording_url, r.recording_url),
                       r.diag_health, r.diag_faults, CAST(r.diagnostics AS text)
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
            Map<String, Double> b = breakdown(card, tts, minutes);
            double cost = round(b.values().stream().mapToDouble(Double::doubleValue).sum());
            double billed = round(billedPerMin(card, surcharge, tts) * minutes);
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
        Query q = em.createNativeQuery("""
                SELECT COALESCE(a.tts_model,'sarvam') AS engine,
                       count(*),
                       COALESCE(sum(r.duration_seconds),0),
                       count(*) FILTER (WHERE r.diag_health = 'RED'),
                       count(*) FILTER (WHERE r.diag_health = 'AMBER'),
                       count(*) FILTER (WHERE r.diag_health = 'GREEN'),
                       count(*) FILTER (WHERE COALESCE(l.recording_url, r.recording_url) IS NOT NULL)
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
            Map<String, Double> b = breakdown(card, engine, mins);
            b.forEach((k, v) -> agg.merge(k, v, Double::sum));
            cost += b.values().stream().mapToDouble(Double::doubleValue).sum();
            // per engine, because both the TTS cost AND the billed credits differ
            billedTotal += billedPerMin(card, surcharge, engine) * mins;
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
