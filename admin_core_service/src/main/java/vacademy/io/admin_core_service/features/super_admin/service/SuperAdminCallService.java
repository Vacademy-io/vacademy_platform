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
        boolean inbound = "INBOUND".equalsIgnoreCase(direction);
        String e = (engine == null || engine.isBlank()) ? "sarvam" : engine.trim().toLowerCase();
        // An escape hatch for an engine priced outside the credit stack entirely.
        // Edge USED one while its discount was report-only; it now rides the same
        // negative surcharge the wallet charges, so no engine sets this today.
        Double flat = card.get("billed_inr_per_min_" + e);
        if (flat != null && flat > 0) return flat * minutes;

        double credits = 0d;
        // Telephony leg — only on trunks Vacademy pays for.
        String pt = providerType == null ? "" : providerType.toUpperCase();
        if (pt.contains("PLIVO") || pt.contains("VACADEMY")) {
            double[] v = pricing.get(inbound ? "voice_call_in" : "voice_call_out");
            if (v != null) credits += Math.max(v[1], v[0] * minutes);
        }
        // AI leg — the engine surcharge rides here, and it can be NEGATIVE (Edge is
        // free to run, so it sells at 2 credits against the standard 5). Floor the
        // per-minute at zero exactly as CallBillingService does, so a surcharge
        // deeper than the base rate can never make this report a refund.
        double[] a = pricing.get(inbound ? "ai_call_in" : "ai_call_out");
        if (a != null) {
            double perMin = Math.max(0d, a[0] + surcharge.getOrDefault(e, 0d));
            credits += Math.max(a[1], perMin * minutes);
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
                                          double minutes, int seconds, Integer ttsChars) {
        String engine = (ttsModel == null || ttsModel.isBlank()) ? "sarvam" : ttsModel.trim().toLowerCase();
        long billedMinutes = seconds <= 0 ? 0 : (seconds + 59) / 60;
        Map<String, Double> b = new LinkedHashMap<>();
        b.put("plivo", round(card.getOrDefault("plivo", 0d) * billedMinutes));
        b.put("stt", round(card.getOrDefault("stt_sarvam", 0d) * minutes));
        // TTS is the one component the bot meters EXACTLY: the vendor bills per
        // character and diagnostics.tts.chars is the count it actually synthesised.
        // Prefer it over duration x the fleet average, because 779 chars/call-min is
        // a mean and every real call sits somewhere off it — an agent that monologues
        // exceeds it and was being under-costed, one whose caller does the talking was
        // being over-costed. Same divisor as the savings line, so the two still cannot
        // disagree, and the average stays as the fallback for any call whose blob is
        // absent (cache off, older row, a bot that crashed before reporting).
        double ttsPerMin = card.getOrDefault("tts_" + engine, 0d);
        b.put("tts", round(ttsChars != null && ttsChars > 0
                ? ttsChars / CHARS_PER_CALL_MINUTE * ttsPerMin
                : ttsPerMin * minutes));
        b.put("llm", round(card.getOrDefault("llm", 0d) * minutes));
        return b;
    }

    /**
     * Characters of TTS per call-minute. This is not a guess: it is the measured
     * figure the rate card is itself built on — {@code tts_google} 2.06 and
     * {@code tts_sarvam} 2.34 are both "779 chars/call-min measured" times the
     * vendor's per-character price (see V428). Keeping the divisor here, in one
     * named place next to the lookup, means the savings figure stays consistent
     * with the cost figure instead of drifting from it.
     */
    private static final double CHARS_PER_CALL_MINUTE = 779.0;

    /**
     * Rupees NOT spent because the speech cache served a sentence instead of the
     * vendor.
     *
     * <p>Derived from characters, not from duration: characters are what the
     * vendor actually meters, and they are the one TTS quantity the bot measures
     * exactly ({@code diagnostics.tts.cacheCharsSaved}). Converted at the rate
     * card's own per-minute price over the same measured character rate it was
     * built from, so this number and the {@code tts} cost line cannot disagree.
     *
     * <p>Returns null when the bot did not measure — the cache was off, or this
     * row predates it. Zero would be a claim that we looked and saved nothing.
     */
    private Double ttsCacheSavingInr(Map<String, Double> card, String ttsModel,
                                     Integer charsSaved) {
        if (charsSaved == null || charsSaved <= 0) return null;
        String engine = (ttsModel == null || ttsModel.isBlank())
                ? "sarvam" : ttsModel.trim().toLowerCase();
        Double perMinute = card.get("tts_" + engine);
        // edge is free and smallest has no confirmed invoice rate, so both sit at
        // 0.00 on the card. Saving characters there is a latency win, not a rupee
        // one, and reporting a rupee figure for it would be inventing revenue.
        if (perMinute == null || perMinute <= 0) return null;
        return round(charsSaved / CHARS_PER_CALL_MINUTE * perMinute);
    }

    /**
     * One integer out of the diagnostics {@code tts} block.
     *
     * <p>Total by construction: the blob is written by a different service on a
     * different box, and a shape change there must cost this row a number, never
     * the whole listing. Absent or unparseable reads as "not measured" (null),
     * which is the same distinction the bot itself is careful to preserve.
     */
    private Integer diagInt(String diagnosticsJson, String field) {
        if (diagnosticsJson == null || diagnosticsJson.isBlank()) return null;
        try {
            com.fasterxml.jackson.databind.JsonNode tts =
                    DIAG_MAPPER.readTree(diagnosticsJson).path("tts").path(field);
            return tts.isNumber() ? tts.asInt() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private static final com.fasterxml.jackson.databind.ObjectMapper DIAG_MAPPER =
            new com.fasterxml.jackson.databind.ObjectMapper();

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
            Integer ttsChars = diagInt((String) r[18], "chars");
            Map<String, Double> b = breakdown(card, tts, minutes, secs, ttsChars);
            double cost = round(b.values().stream().mapToDouble(Double::doubleValue).sum());
            double billed = round(billedInr(card, surcharge, pricing, tts,
                    (String) r[10], (String) r[19], secs));
            double margin = round(billed - cost);
            String recording = (String) r[15];
            String diagJson = (String) r[18];
            Integer cacheHits = diagInt(diagJson, "cacheHits");
            Integer cacheChars = diagInt(diagJson, "cacheCharsSaved");
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
                    // Still true overall: plivo, stt and llm remain duration-modelled.
                    // ttsCharsMeasured is what tells the UI that the TTS line, at least,
                    // is the vendor's own metered quantity on this particular call.
                    .costBreakdown(b).costIsModelled(true)
                    .ttsCharsMeasured(ttsChars)
                    .ttsCacheHits(cacheHits)
                    .ttsCacheMisses(diagInt(diagJson, "cacheMisses"))
                    .ttsCacheCharsSaved(cacheHits == null ? null : cacheChars)
                    .ttsCacheSavedInr(ttsCacheSavingInr(card, tts, cacheChars))
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
                                         THEN (r.duration_seconds + 59) / 60 ELSE 0 END), 0),
                       COALESCE(sum(CASE WHEN r.diagnostics->'tts'->>'cacheHits' ~ '^[0-9]+$'
                                         THEN CAST(r.diagnostics->'tts'->>'cacheHits' AS bigint) END), 0),
                       COALESCE(sum(CASE WHEN r.diagnostics->'tts'->>'cacheMisses' ~ '^[0-9]+$'
                                         THEN CAST(r.diagnostics->'tts'->>'cacheMisses' AS bigint) END), 0),
                       COALESCE(sum(CASE WHEN r.diagnostics->'tts'->>'cacheCharsSaved' ~ '^[0-9]+$'
                                         THEN CAST(r.diagnostics->'tts'->>'cacheCharsSaved' AS bigint) END), 0),
                       count(*) FILTER (WHERE r.diagnostics->'tts'->>'cacheHits' ~ '^[0-9]+$'),
                       COALESCE(sum(CASE WHEN r.diagnostics->'tts'->>'chars' ~ '^[0-9]+$'
                                         THEN CAST(r.diagnostics->'tts'->>'chars' AS bigint) END), 0),
                       COALESCE(sum(r.duration_seconds) FILTER (
                           WHERE r.diagnostics->'tts'->>'chars' IS NULL
                              OR NOT (r.diagnostics->'tts'->>'chars' ~ '^[0-9]+$')), 0)
                """ + BASE_FROM + " GROUP BY 1");
        bind(q, instituteId, from, to, health, disposition, agentId);

        long calls = 0, red = 0, amber = 0, green = 0, rec = 0;
        double minutes = 0, cost = 0, billedTotal = 0;
        // Speech-cache totals. Read from the diagnostics jsonb rather than a
        // column: the bot already ships these per call, and a rollup table would
        // be a second source of truth to keep in step with it.
        long cacheHits = 0, cacheMisses = 0, cacheChars = 0;
        double cacheSaved = 0d;
        boolean cacheMeasured = false;
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
            // Mirror of breakdown(): metered characters where the bot reported them,
            // the 779 chars/call-min average only for the calls it did not. Computed
            // the same way in both places so the summary can never drift from the
            // rows it is summing.
            long measuredChars = ((Number) r[13]).longValue();
            double unmeasuredMins = ((Number) r[14]).longValue() / 60.0;
            double ttsPerMin = card.getOrDefault("tts_" + engine, 0d);
            b.put("tts", round(measuredChars / CHARS_PER_CALL_MINUTE * ttsPerMin
                               + unmeasuredMins * ttsPerMin));
            b.put("llm", round(card.getOrDefault("llm", 0d) * mins));
            b.forEach((k, v) -> agg.merge(k, v, Double::sum));
            cost += b.values().stream().mapToDouble(Double::doubleValue).sum();

            // Speech cache, priced per ENGINE because the rate differs sixfold
            // across them and this query is already grouped that way.
            long gHits = ((Number) r[10]).longValue();
            long gMiss = ((Number) r[11]).longValue();
            long gChars = ((Number) r[12]).longValue();
            if (((Number) r[13]).longValue() > 0) cacheMeasured = true;
            cacheHits += gHits;
            cacheMisses += gMiss;
            cacheChars += gChars;
            Double gSaved = ttsCacheSavingInr(card, engine, (int) Math.min(gChars, Integer.MAX_VALUE));
            if (gSaved != null) cacheSaved += gSaved;

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
                // Null, not zero, when NOTHING in the range measured the cache:
                // "it ran and saved nothing" and "it was never on" are different
                // answers, and a fleet chart that conflates them will report a
                // broken rollout as a working one.
                .ttsCacheHits(cacheMeasured ? cacheHits : null)
                .ttsCacheMisses(cacheMeasured ? cacheMisses : null)
                .ttsCacheHitRate(cacheMeasured && (cacheHits + cacheMisses) > 0
                        ? round((double) cacheHits / (cacheHits + cacheMisses) * 100)
                        : null)
                .ttsCacheCharsSaved(cacheMeasured ? cacheChars : null)
                .ttsCacheSavedInr(cacheMeasured ? round(cacheSaved) : null)
                .build();
    }
}
