package vacademy.io.admin_core_service.features.audience.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.audience.dto.ConnectorHealthDTO;
import vacademy.io.admin_core_service.features.audience.entity.FormWebhookConnector;
import vacademy.io.admin_core_service.features.audience.repository.FormWebhookConnectorRepository;
import vacademy.io.admin_core_service.features.audience.service.MetaConnectorHealthService;
import vacademy.io.common.logging.SentryLogger;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Passive health monitor for Meta Lead Ads connectors.
 *
 * The root failure this guards against is silent: a connector saved ACTIVE whose
 * page→app webhook subscribe failed (Meta #200 — the connecting account lacks
 * Full control), so leads never arrive and nobody notices for weeks. This job
 * sweeps every active Meta connector daily, runs the same health check as the
 * "Test connection" button, and raises a Sentry WARNING (→ Slack/email) for any
 * connector that is BROKEN or needs action — so we find out, not the institute.
 *
 * The health check also refreshes each connector's status/last_checked_at as a
 * side effect, keeping the Integrations screen honest without anyone clicking.
 *
 * Schedule: daily at 02:30 UTC (after MetaTokenRefreshJob at 02:00).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MetaConnectorMonitorJob {

    private static final String VENDOR = "META_LEAD_ADS";

    private final FormWebhookConnectorRepository connectorRepository;
    private final MetaConnectorHealthService connectorHealthService;

    @Value("${meta.connector.monitor.enabled:true}")
    private boolean enabled;

    @Scheduled(cron = "${meta.connector.monitor.cron:0 30 2 * * ?}")
    @SchedulerLock(name = "MetaConnectorMonitorJob", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void monitorMetaConnectors() {
        if (!enabled) {
            log.info("MetaConnectorMonitorJob: disabled, skipping");
            return;
        }

        List<FormWebhookConnector> connectors = connectorRepository.findByVendorAndIsActiveTrue(VENDOR);
        if (connectors.isEmpty()) {
            log.info("MetaConnectorMonitorJob: no active Meta connectors to check");
            return;
        }

        log.info("MetaConnectorMonitorJob: checking {} Meta connector(s)", connectors.size());
        int broken = 0;
        for (FormWebhookConnector connector : connectors) {
            try {
                ConnectorHealthDTO health = connectorHealthService.checkHealth(connector.getId());
                String overall = health.getOverall();
                // Only alert on genuinely broken connectors. DEGRADED (e.g. "no leads
                // yet" / token expiring — already handled by MetaTokenRefreshJob) would
                // be noise, so we log those but don't page anyone.
                if ("ACTION_REQUIRED".equals(overall) || "BROKEN".equals(overall)) {
                    broken++;
                    alert(connector, health);
                } else {
                    log.info("MetaConnectorMonitorJob: connector {} → {}",
                            connector.getId(), overall);
                }
            } catch (Exception e) {
                // One bad connector must not abort the sweep.
                log.error("MetaConnectorMonitorJob: health check threw for connector {}",
                        connector.getId(), e);
            }
        }
        log.info("MetaConnectorMonitorJob: completed — {}/{} connector(s) need action",
                broken, connectors.size());
    }

    private void alert(FormWebhookConnector connector, ConnectorHealthDTO health) {
        String reason = health.getChecks().stream()
                .filter(c -> "FAIL".equals(c.getStatus()))
                .map(ConnectorHealthDTO.Check::getMessage)
                .findFirst()
                .orElse(connector.getStatusDetail() != null
                        ? connector.getStatusDetail() : "Connector is not delivering leads");

        Map<String, String> tags = new LinkedHashMap<>();
        tags.put("feature", "ad_platform_connector");
        tags.put("vendor", VENDOR);
        tags.put("connector_id", connector.getId());
        if (connector.getInstituteId() != null) tags.put("institute_id", connector.getInstituteId());
        if (connector.getPlatformPageId() != null) tags.put("page_id", connector.getPlatformPageId());
        if (connector.getPlatformFormId() != null) tags.put("form_id", connector.getPlatformFormId());
        tags.put("health", health.getOverall());

        String formLabel = connector.getPlatformFormName() != null
                ? connector.getPlatformFormName() : connector.getPlatformFormId();
        SentryLogger.logWarning(
                "Meta Lead Ads connector not delivering leads (" + health.getOverall() + "): "
                        + "institute=" + connector.getInstituteId() + " form=" + formLabel
                        + " — " + reason,
                tags);
        log.warn("MetaConnectorMonitorJob: ALERT connector={} institute={} health={} reason={}",
                connector.getId(), connector.getInstituteId(), health.getOverall(), reason);
    }
}
