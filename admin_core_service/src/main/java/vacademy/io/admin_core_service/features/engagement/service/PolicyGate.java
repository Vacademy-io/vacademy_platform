package vacademy.io.admin_core_service.features.engagement.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementEngine;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementMember;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementActionRepository;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Set;

/**
 * The safety layer, checked BEFORE the LLM call (gating after the LLM pays for decisions you
 * throw away). Because the prompt decides cadence (founder call, D13), the INSTITUTE-WIDE
 * CROSS-ENGINE per-subject cap here is the only hard cadence mechanism: three engines sharing
 * a learner share one cap, so "each engine behaved" can never add up to spam.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class PolicyGate {

    private final EngagementReadDao dao;
    private final EngagementActionRepository actionRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Hard institute-wide cross-engine cap: actions per subject per window. */
    @Value("${engagement.cap.actions-per-window:3}")
    private int actionsPerWindow;

    @Value("${engagement.cap.window-days:7}")
    private int capWindowDays;

    /** Institute compliance floor (IST cutoff convention): no outreach 21:00–08:00. */
    @Value("${engagement.quiet.start-hour:21}")
    private int quietStartHour;

    @Value("${engagement.quiet.end-hour:8}")
    private int quietEndHour;

    @Value("${engagement.quiet.timezone:Asia/Kolkata}")
    private String quietTimezone;

    public enum Verdict { PROCEED, SKIP_OPTED_OUT, SKIP_CAPPED }

    /** Batch consent check for a cohort — one query. */
    public Set<String> optedOutUserIds(String instituteId, List<String> userIds) {
        return dao.optedOutUserIds(instituteId, userIds);
    }

    /** Per-member pre-LLM gate. Consent is checked at cohort level; this adds the cap. */
    public Verdict preDecision(EngagementMember member, Set<String> optedOut) {
        if (member.getUserId() != null && optedOut.contains(member.getUserId())) {
            return Verdict.SKIP_OPTED_OUT;
        }
        long recent = actionRepository.countRecentActionsForSubject(
                member.getInstituteId(), member.getUserId(), member.getAudienceResponseId(),
                Instant.now().minus(Duration.ofDays(capWindowDays)));
        if (recent >= actionsPerWindow) {
            return Verdict.SKIP_CAPPED;
        }
        return Verdict.PROCEED;
    }

    /**
     * Clamp a proposed action time out of quiet hours. Correctness matters here: an off-by-one
     * on the window sends outreach at 2 AM. Modelled as a QUIET interval on a 24-hour clock in
     * the institute's timezone (default 21:00→08:00, wrapping midnight). The engine may only
     * WIDEN the quiet interval (= tighten the send window); a narrower engine quiet interval is
     * ignored, and the engine cannot swap the timezone (that would shift the whole floor).
     * Replies are exempt (D10) — but Phase 1a creates tasks only, which respect the floor.
     */
    public Instant clampToAllowedWindow(EngagementEngine engine, Instant proposed) {
        // Floor timezone is pinned — the engine cannot move it.
        ZoneId zone = ZoneId.of(quietTimezone);

        // Quiet interval as [startMin, endMin) minutes-of-day, allowed to wrap past midnight.
        int floorStart = quietStartHour * 60;
        int floorEnd = quietEndHour * 60;

        int start = floorStart;
        int end = floorEnd;
        try {
            JsonNode qh = objectMapper.readTree(engine.getQuietHours());
            if (qh.hasNonNull("startHour") && qh.hasNonNull("endHour")) {
                int es = qh.get("startHour").asInt() * 60;
                int ee = qh.get("endHour").asInt() * 60;
                // Widen quiet = union of the two intervals. On the wrapping floor (start>end),
                // only accept an engine interval that extends it: an earlier start OR a later end
                // still on the same wrap. Simplest safe rule: take the widest quiet that still
                // contains the floor — earliest start, latest end (both measured on the wrap).
                if (floorStart > floorEnd) {                 // wrapping floor (the default 21→8)
                    start = Math.min(start, normalizeStart(es, ee, floorStart));
                    end = Math.max(end, normalizeEnd(es, ee, floorEnd));
                }
            }
        } catch (Exception ignored) {
            // unparseable engine quiet hours → institute floor applies
        }

        ZonedDateTime t = proposed.atZone(zone);
        int minute = t.getHour() * 60 + t.getMinute();
        boolean inQuiet = start > end
                ? (minute >= start || minute < end)          // wraps midnight
                : (minute >= start && minute < end);          // same-day
        if (!inQuiet) return proposed;

        // Next allowed instant = the quiet interval's END. If end is "earlier in the clock" than
        // now (i.e. we're in the pre-midnight part of a wrapping window), roll to tomorrow.
        int endHour = end / 60;
        int endMin = end % 60;
        ZonedDateTime candidate = t.withHour(endHour).withMinute(endMin).withSecond(0).withNano(0);
        if (!candidate.isAfter(t)) candidate = candidate.plusDays(1);
        return candidate.toInstant();
    }

    /** Widen-only: an engine start earlier than the floor start (on the wrap) tightens the send window. */
    private static int normalizeStart(int engStart, int engEnd, int floorStart) {
        // Only honor an engine start that begins the quiet period EARLIER in the evening
        // (>= noon, before the floor's start), i.e. it makes quiet start sooner.
        if (engStart >= 12 * 60 && engStart < floorStart) return engStart;
        return floorStart;
    }

    /** Widen-only: an engine end later than the floor end (on the wrap) tightens the send window. */
    private static int normalizeEnd(int engStart, int engEnd, int floorEnd) {
        // Only honor an engine end that keeps quiet LATER in the morning (<= noon, after floor end).
        if (engEnd <= 12 * 60 && engEnd > floorEnd) return engEnd;
        return floorEnd;
    }
}
