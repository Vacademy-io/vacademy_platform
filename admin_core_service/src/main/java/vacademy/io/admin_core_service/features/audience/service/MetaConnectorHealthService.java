package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.dto.ConnectorHealthDTO;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.entity.FormWebhookConnector;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.audience.repository.FormWebhookConnectorRepository;
import vacademy.io.admin_core_service.features.audience.strategy.MetaLeadAdsStrategy;
import vacademy.io.common.exceptions.VacademyException;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Live health check for a Meta Lead Ads connector.
 *
 * Verifies the WHOLE lead-delivery chain instead of trusting that OAuth
 * completed: stored token, page→app webhook subscription, lead-read access,
 * and a recent-lead heartbeat. The page-subscribe link is the one that used to
 * fail silently (Meta #200 — connecting account lacks Full control), so this is
 * the highest-signal check; when it fails we flip the connector to
 * ACTION_REQUIRED with the remediation so the list view reflects reality.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MetaConnectorHealthService {

    private static final String VENDOR = "META_LEAD_ADS";
    private static final int TOKEN_EXPIRY_WARN_DAYS = 7;
    private static final int HEARTBEAT_WARN_DAYS = 7;

    private final FormWebhookConnectorRepository connectorRepository;
    private final AudienceResponseRepository audienceResponseRepository;
    private final TokenEncryptionService tokenEncryptionService;
    private final MetaLeadAdsStrategy metaStrategy;

    @Transactional
    public ConnectorHealthDTO checkHealth(String connectorId) {
        FormWebhookConnector c = connectorRepository.findById(connectorId)
                .orElseThrow(() -> new VacademyException("Connector not found"));

        List<ConnectorHealthDTO.Check> checks = new ArrayList<>();

        if (!VENDOR.equals(c.getVendor())) {
            // Non-Meta connectors (Google etc.) have no programmatic subscription to verify.
            checks.add(check("SUBSCRIPTION", "Webhook subscription", "SKIP",
                    "Health checks are only available for Meta Lead Ads connectors.", null));
            c.setLastCheckedAt(LocalDateTime.now());
            connectorRepository.save(c);
            return ConnectorHealthDTO.builder()
                    .connectorId(c.getId()).vendor(c.getVendor())
                    .overall("UNKNOWN").checks(checks).build();
        }

        // ── Resolve the stored page token ──────────────────────────────────
        String pageToken = null;
        ConnectorHealthDTO.Check tokenCheck;
        if (c.getOauthAccessTokenEnc() == null) {
            tokenCheck = check("TOKEN", "Facebook authorization", "FAIL",
                    "No Facebook token stored for this connector.",
                    "Reconnect this Page in Integrations.");
        } else {
            try {
                pageToken = tokenEncryptionService.decrypt(c.getOauthAccessTokenEnc());
                tokenCheck = evaluateTokenExpiry(c);
            } catch (Exception e) {
                tokenCheck = check("TOKEN", "Facebook authorization", "FAIL",
                        "Stored Facebook token could not be read.",
                        "Reconnect this Page in Integrations.");
            }
        }
        checks.add(tokenCheck);

        // ── Subscription + lead-read probes (need a usable token) ──────────
        ConnectorHealthDTO.Check subscriptionCheck;
        ConnectorHealthDTO.Check leadReadCheck;
        if (pageToken == null) {
            subscriptionCheck = check("SUBSCRIPTION", "Page linked for lead delivery", "SKIP",
                    "Skipped — no usable Facebook token.", null);
            leadReadCheck = check("LEAD_READ", "Lead read access", "SKIP",
                    "Skipped — no usable Facebook token.", null);
        } else {
            Optional<String> subIssue = metaStrategy.findSubscriptionIssue(c.getPlatformPageId(), pageToken);
            subscriptionCheck = subIssue
                    .map(msg -> check("SUBSCRIPTION", "Page linked for lead delivery", "FAIL", msg, msg))
                    .orElseGet(() -> check("SUBSCRIPTION", "Page linked for lead delivery", "PASS",
                            "Vacademy is subscribed to this Page's leads.", null));

            if (c.getPlatformFormId() != null) {
                Optional<String> readIssue = metaStrategy.findLeadReadIssue(c.getPlatformFormId(), pageToken);
                leadReadCheck = readIssue
                        .map(msg -> check("LEAD_READ", "Lead read access", "FAIL", msg, msg))
                        .orElseGet(() -> check("LEAD_READ", "Lead read access", "PASS",
                                "Leads can be read from this form.", null));
            } else {
                leadReadCheck = check("LEAD_READ", "Lead read access", "SKIP",
                        "No form linked to this connector.", null);
            }
        }
        checks.add(subscriptionCheck);
        checks.add(leadReadCheck);

        // ── Heartbeat: are leads actually arriving? ────────────────────────
        ConnectorHealthDTO.Check heartbeat;
        String lastLeadAt = null;
        Optional<AudienceResponse> last = c.getAudienceId() != null
                ? audienceResponseRepository.findTopByAudienceIdOrderBySubmittedAtDesc(c.getAudienceId())
                : Optional.empty();
        if (last.isPresent() && last.get().getSubmittedAt() != null) {
            lastLeadAt = last.get().getSubmittedAt().toString();
            long days = ChronoUnit.DAYS.between(last.get().getSubmittedAt().toInstant(), java.time.Instant.now());
            if (days > HEARTBEAT_WARN_DAYS) {
                heartbeat = check("HEARTBEAT", "Recent leads", "WARN",
                        "No leads received in " + days + " days.",
                        "If your form is live, verify the subscription above.");
            } else {
                heartbeat = check("HEARTBEAT", "Recent leads", "PASS",
                        "Leads received recently.", null);
            }
        } else {
            heartbeat = check("HEARTBEAT", "Recent leads", "WARN",
                    "No leads received from this connector yet.",
                    "Submit a test lead to confirm end-to-end delivery.");
        }
        checks.add(heartbeat);

        // ── Roll up + reflect into connector status ────────────────────────
        String overall = rollUp(tokenCheck, subscriptionCheck, leadReadCheck, heartbeat);

        if ("FAIL".equals(subscriptionCheck.getStatus())) {
            c.setConnectionStatus("ACTION_REQUIRED");
            c.setStatusDetail(subscriptionCheck.getRemediation());
        } else if ("FAIL".equals(tokenCheck.getStatus())) {
            c.setConnectionStatus("ACTION_REQUIRED");
            c.setStatusDetail(tokenCheck.getRemediation());
        } else if ("ACTION_REQUIRED".equals(c.getConnectionStatus())) {
            // Previously broken, now healthy again — clear it.
            c.setConnectionStatus("ACTIVE");
            c.setStatusDetail(null);
        }
        c.setLastCheckedAt(LocalDateTime.now());
        connectorRepository.save(c);

        return ConnectorHealthDTO.builder()
                .connectorId(c.getId())
                .vendor(c.getVendor())
                .overall(overall)
                .lastLeadAt(lastLeadAt)
                .checks(checks)
                .build();
    }

    private ConnectorHealthDTO.Check evaluateTokenExpiry(FormWebhookConnector c) {
        LocalDateTime expiry = c.getOauthTokenExpiresAt();
        if (expiry == null) {
            return check("TOKEN", "Facebook authorization", "PASS",
                    "Token stored.", null);
        }
        LocalDateTime now = LocalDateTime.now();
        if (expiry.isBefore(now)) {
            return check("TOKEN", "Facebook authorization", "FAIL",
                    "Facebook token expired on " + expiry + ".",
                    "Reconnect this Page in Integrations.");
        }
        if (expiry.isBefore(now.plusDays(TOKEN_EXPIRY_WARN_DAYS))) {
            return check("TOKEN", "Facebook authorization", "WARN",
                    "Facebook token expires on " + expiry + ".",
                    "Reconnect soon to avoid losing leads.");
        }
        return check("TOKEN", "Facebook authorization", "PASS",
                "Token valid until " + expiry + ".", null);
    }

    private String rollUp(ConnectorHealthDTO.Check... checks) {
        boolean subscriptionFail = false, tokenFail = false, anyFail = false, anyWarn = false;
        for (ConnectorHealthDTO.Check c : checks) {
            if ("FAIL".equals(c.getStatus())) {
                anyFail = true;
                if ("SUBSCRIPTION".equals(c.getKey())) subscriptionFail = true;
                if ("TOKEN".equals(c.getKey())) tokenFail = true;
            } else if ("WARN".equals(c.getStatus())) {
                anyWarn = true;
            }
        }
        if (tokenFail) return "BROKEN";
        if (subscriptionFail || anyFail) return "ACTION_REQUIRED";
        if (anyWarn) return "DEGRADED";
        return "VERIFIED";
    }

    private ConnectorHealthDTO.Check check(String key, String label, String status,
            String message, String remediation) {
        return ConnectorHealthDTO.Check.builder()
                .key(key).label(label).status(status)
                .message(message).remediation(remediation)
                .build();
    }
}
