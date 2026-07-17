package vacademy.io.admin_core_service.features.audience.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.audience.entity.FormWebhookConnector;
import vacademy.io.admin_core_service.features.audience.repository.FormWebhookConnectorRepository;
import vacademy.io.admin_core_service.features.audience.service.AdPlatformWebhookService;
import vacademy.io.common.logging.SentryLogger;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Scheduled PULL poller for Meta Lead Ads — the universal backstop for the webhook.
 *
 * Why it exists: realtime (webhook) delivery requires the Vacademy app to be
 * assigned as a CRM in Meta's Lead Access Manager. When that assignment is missing
 * or revoked ("CRM access revoked"), Meta refuses to PUSH leads — even though the
 * stored Page token can still PULL them via GET /{form_id}/leads (which authorizes
 * off the token's own leads_retrieval permission + the token-holder's page admin
 * access, not the CRM push assignment). Polling reuses the exact same ingest
 * pipeline as the webhook, so it needs no parallel system and — because the
 * pipeline dedups the same lead to the same user — it is safe to run alongside
 * realtime with no double-inserts.
 *
 * Safety rails so this never mass-imports history and mass-fires follow-up workflows:
 *  - FIRST poll (last_polled_at null) starts from now − initialLookback, not the
 *    90-day retention window.
 *  - A STALE cursor (a paused/re-activated connector whose last_polled_at is weeks
 *    old) is clamped to now − maxLookback, so the recurring job never opens a window
 *    it can't drain. Genuine history backfills go through the manual /poll endpoint.
 *
 * Schedule: every 10 minutes by default.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MetaLeadPollingJob {

    private static final String VENDOR = "META_LEAD_ADS";

    private final FormWebhookConnectorRepository connectorRepository;
    private final AdPlatformWebhookService adPlatformWebhookService;

    @Value("${meta.lead.polling.enabled:true}")
    private boolean enabled;

    /** Re-scan window subtracted from the cursor so leads created during a poll (or
     *  under clock skew) are never missed; the re-scanned leads dedup harmlessly. */
    @Value("${meta.lead.polling.overlap.minutes:5}")
    private int overlapMinutes;

    /** How far back a never-polled connector looks on its first run. Small on
     *  purpose — going-forward capture, not a historical import. */
    @Value("${meta.lead.polling.initial.lookback.minutes:60}")
    private int initialLookbackMinutes;

    /** Hard ceiling on how far back ANY recurring poll looks, even with a stale
     *  cursor. Bounds the window so it always drains within the page cap and a
     *  re-activated connector can't trigger a mass catch-up. Longer gaps → manual /poll. */
    @Value("${meta.lead.polling.max.lookback.minutes:360}")
    private int maxLookbackMinutes;

    /** Cap on paging.next follows per connector per poll; the rest arrive next tick. */
    @Value("${meta.lead.polling.max.pages:50}")
    private int maxPages;

    @Scheduled(cron = "${meta.lead.polling.cron:0 */10 * * * ?}")
    @SchedulerLock(name = "MetaLeadPollingJob", lockAtMostFor = "PT9M", lockAtLeastFor = "PT10S")
    public void pollMetaLeads() {
        if (!enabled) {
            log.debug("MetaLeadPollingJob: disabled, skipping");
            return;
        }

        List<FormWebhookConnector> connectors = connectorRepository.findByVendorAndIsActiveTrue(VENDOR);
        if (connectors.isEmpty()) {
            log.debug("MetaLeadPollingJob: no active Meta connectors to poll");
            return;
        }

        int polled = 0;
        int totalLeads = 0;
        for (FormWebhookConnector connector : connectors) {
            // Per-connector opt-out and "no token → nothing to pull with".
            if (Boolean.FALSE.equals(connector.getPollingEnabled())) continue;
            if (connector.getOauthAccessTokenEnc() == null) continue;

            try {
                // Capture the watermark BEFORE fetching so leads created during the
                // poll are caught next run (via the overlap subtraction below).
                LocalDateTime pollStart = LocalDateTime.now();
                long sinceEpoch = resolveSince(connector, pollStart).toEpochSecond(ZoneOffset.UTC);

                AdPlatformWebhookService.PollResult result =
                        adPlatformWebhookService.pollMetaConnector(connector, sinceEpoch, maxPages);

                if (result.truncated()) {
                    // Even the clamped window held more than maxPages*100 leads — the
                    // OLDEST weren't fetched (Meta returns newest-first). Do NOT advance
                    // the cursor (would strand them), and page ops: this shouldn't
                    // happen at 10-min cadence and needs a manual backfill / bigger cap.
                    alertTruncated(connector, result.fetched());
                } else {
                    // Targeted cursor write (not a full-entity save) so we can't clobber
                    // a token-refresh / status write another scheduler made to this row.
                    connectorRepository.updatePollCursor(
                            connector.getId(), pollStart, result.newestLeadId());
                }
                polled++;
                totalLeads += result.fetched();
            } catch (Exception e) {
                // Keep the cursor where it was so this connector's leads are retried
                // next tick; one bad connector must not abort the sweep. Surface it —
                // the poller is the reliability backstop, so a persistently failing
                // pull (e.g. revoked token) is worth an alert, not just a log line.
                log.error("MetaLeadPollingJob: poll failed for connector {} (form {}) — "
                                + "cursor unchanged, will retry next tick",
                        connector.getId(), connector.getPlatformFormId(), e);
                alertPollFailure(connector, e);
            }
        }
        if (polled > 0) {
            log.info("MetaLeadPollingJob: polled {} connector(s), fetched {} lead(s)",
                    polled, totalLeads);
        }
    }

    /**
     * Window start for this poll: cursor − overlap, but never earlier than
     * now − maxLookback (clamps a stale cursor); or now − initialLookback on a
     * never-polled connector.
     */
    private LocalDateTime resolveSince(FormWebhookConnector connector, LocalDateTime pollStart) {
        LocalDateTime floor = pollStart.minusMinutes(maxLookbackMinutes);
        if (connector.getLastPolledAt() == null) {
            return pollStart.minusMinutes(initialLookbackMinutes);
        }
        LocalDateTime since = connector.getLastPolledAt().minusMinutes(overlapMinutes);
        return since.isBefore(floor) ? floor : since;
    }

    private void alertTruncated(FormWebhookConnector connector, int fetched) {
        Map<String, String> tags = baseTags(connector);
        tags.put("issue", "poll_truncated");
        SentryLogger.logWarning(
                "Meta lead poll truncated for connector " + connector.getId()
                        + " institute=" + connector.getInstituteId() + " — fetched " + fetched
                        + " but the window holds more than the page cap; older leads may be "
                        + "stranded. Run a manual backfill or raise meta.lead.polling.max.pages.",
                tags);
    }

    private void alertPollFailure(FormWebhookConnector connector, Exception e) {
        Map<String, String> tags = baseTags(connector);
        tags.put("issue", "poll_failed");
        SentryLogger.logWarning(
                "Meta lead poll failed for connector " + connector.getId()
                        + " institute=" + connector.getInstituteId() + " — " + e.getMessage()
                        + " (token may be revoked/expired; leads not flowing).",
                tags);
    }

    private Map<String, String> baseTags(FormWebhookConnector connector) {
        Map<String, String> tags = new LinkedHashMap<>();
        tags.put("feature", "ad_platform_connector");
        tags.put("vendor", VENDOR);
        tags.put("connector_id", connector.getId());
        if (connector.getInstituteId() != null) tags.put("institute_id", connector.getInstituteId());
        if (connector.getPlatformFormId() != null) tags.put("form_id", connector.getPlatformFormId());
        return tags;
    }
}
