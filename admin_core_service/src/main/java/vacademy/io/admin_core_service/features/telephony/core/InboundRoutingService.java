package vacademy.io.admin_core_service.features.telephony.core;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.telephony.enums.CallDirection;
import vacademy.io.admin_core_service.features.telephony.enums.CallStatus;
import vacademy.io.admin_core_service.features.telephony.enums.InboundRouterStrategy;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyProviderNumber;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyProviderNumberRepository;
import vacademy.io.admin_core_service.features.telephony.spi.InboundLeadRouter;
import vacademy.io.admin_core_service.features.telephony.spi.dto.InboundRouteDecision;
import vacademy.io.admin_core_service.features.telephony.spi.dto.InboundRouteRequest;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderNumberView;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Chains the configured inbound routing strategies and persists the
 * {@link TelephonyCallLog} row for an incoming call. Provider-neutral —
 * each provider's controller calls this with a normalised
 * {@link InboundRouteRequest}.
 *
 * Strategy order is fixed for the MVP (last-counsellor → voicemail). Phase 2
 * can promote this to a per-institute config column the same way
 * {@code default_selector_key} does for outbound, but until we add more
 * strategies the priority is unambiguous.
 *
 * Latency budget: Connect-applet URLs hold the lead's audio open while we
 * decide. Target ≤ 200ms end-to-end. Strategies are responsible for cheap
 * misses; this service does at most one ExoPhone lookup and one row INSERT.
 */
@Service
public class InboundRoutingService {

    private static final Logger log = LoggerFactory.getLogger(InboundRoutingService.class);

    /** Default per-leg ring timeout if no override is set. */
    private static final int DEFAULT_MAX_RINGING_SECONDS = 30;

    /**
     * Routing chain in priority order. Strategies are resolved by key so
     * the configured set is explicit and auditable rather than implicit
     * by Spring bean order. New strategies (e.g. ASSIGNED_COUNSELLOR,
     * ROUND_ROBIN_POOL) plug in by adding their key here.
     */
    private static final List<String> ROUTING_CHAIN = List.of(
            InboundRouterStrategy.LAST_COUNSELLOR,
            InboundRouterStrategy.VOICEMAIL_FALLBACK);

    @Autowired private TelephonyConfigCache configCache;
    @Autowired private TelephonyProviderNumberRepository numberRepo;
    @Autowired private TelephonyCallLogRepository callLogRepo;
    @Autowired private InboundCallLogPersister persister;

    private final Map<String, InboundLeadRouter> routersByKey;

    public InboundRoutingService(List<InboundLeadRouter> routers) {
        this.routersByKey = routers.stream()
                .collect(Collectors.toMap(InboundLeadRouter::strategyKey, r -> r));
    }

    /**
     * Resolve the dialled ExoPhone (i.e. CallTo) to an institute, run the
     * routing chain, and persist a TelephonyCallLog row in INITIATED state.
     * Returns both the decision and the call-log id so the controller can
     * render the provider-specific response and attach the row to the
     * eventual status webhook by provider_call_id.
     */
    public RoutedInbound route(String providerType, String fromNumber, String toNumber,
                               String providerCallId) {
        if (toNumber == null || toNumber.isBlank()) {
            log.warn("inbound route: missing toNumber");
            return RoutedInbound.empty();
        }

        TelephonyProviderNumber match = lookupExoPhone(toNumber);
        if (match == null) {
            // Likely a misconfigured Exotel flow pointing at this URL with a
            // number we don't own. We can't even attribute the call.
            log.warn("inbound route: no provider number matches CallTo={}", toNumber);
            return RoutedInbound.empty();
        }

        InboundRouteRequest req = InboundRouteRequest.builder()
                .instituteId(match.getInstituteId())
                .fromNumber(fromNumber)
                .toNumber(toNumber)
                .providerCallId(providerCallId)
                .dialledNumber(toView(match))
                .build();

        InboundRouteDecision decision = runChain(req);

        TelephonyConfigCache.Resolved resolved = configCache.get(match.getInstituteId()).orElse(null);
        boolean record = resolved != null && resolved.getConfig() != null
                && Boolean.TRUE.equals(resolved.getConfig().getRecordCalls());

        InboundRouteDecision finalDecision = InboundRouteDecision.builder()
                .strategyKey(decision.getStrategyKey())
                .attributedCounsellorUserId(decision.getAttributedCounsellorUserId())
                .attributedLeadUserId(decision.getAttributedLeadUserId())
                .attributedResponseId(decision.getAttributedResponseId())
                .numbersToDial(decision.getNumbersToDial())
                .record(record)
                .maxRingingSeconds(DEFAULT_MAX_RINGING_SECONDS)
                .reason(decision.getReason())
                .build();

        String callLogId = persister.persistInitiated(providerType, req, finalDecision);

        log.info("inbound routed: callLogId={} institute={} from={} to={} strategy={} legs={}",
                callLogId, match.getInstituteId(), fromNumber, toNumber,
                finalDecision.getStrategyKey(),
                finalDecision.getNumbersToDial() == null ? 0
                        : finalDecision.getNumbersToDial().size());

        return new RoutedInbound(callLogId, finalDecision, match.getInstituteId());
    }

    private TelephonyProviderNumber lookupExoPhone(String toNumber) {
        List<TelephonyProviderNumber> matches = numberRepo.findEnabledByPhoneNumber(toNumber.trim());
        return matches.isEmpty() ? null : matches.get(0);
    }

    private InboundRouteDecision runChain(InboundRouteRequest req) {
        for (String key : ROUTING_CHAIN) {
            InboundLeadRouter r = routersByKey.get(key);
            if (r == null) continue;
            try {
                var result = r.route(req);
                if (result.isPresent()) return result.get();
            } catch (Exception e) {
                // Never let one bad strategy take down the chain — the lead's
                // audio is connected and waiting for us.
                log.warn("inbound router {} threw — falling through", key, e);
            }
        }
        // Chain exhausted with no decision — emit an empty one so the
        // controller still persists the row and emits a missed-call event.
        return InboundRouteDecision.builder()
                .strategyKey("NONE")
                .numbersToDial(Collections.emptyList())
                .reason("No router produced a destination")
                .build();
    }

    private static ProviderNumberView toView(TelephonyProviderNumber n) {
        return ProviderNumberView.builder()
                .id(n.getId())
                .phoneNumber(n.getPhoneNumber())
                .label(n.getLabel())
                .region(n.getRegion())
                .priority(n.getPriority() == null ? 100 : n.getPriority())
                .enabled(Boolean.TRUE.equals(n.getEnabled()))
                .build();
    }

    /** Wrapper exposed to controllers — decision + persisted row id. */
    public static final class RoutedInbound {
        private final String callLogId;
        private final InboundRouteDecision decision;
        private final String instituteId;

        public RoutedInbound(String callLogId, InboundRouteDecision decision, String instituteId) {
            this.callLogId = callLogId;
            this.decision = decision;
            this.instituteId = instituteId;
        }

        public static RoutedInbound empty() {
            return new RoutedInbound(null,
                    InboundRouteDecision.builder()
                            .strategyKey("NONE")
                            .numbersToDial(Collections.emptyList())
                            .build(),
                    null);
        }

        public InboundRouteDecision getDecision() { return decision; }
        public String getInstituteId() { return instituteId; }
        public boolean isRouted() { return callLogId != null; }
    }

    /**
     * Persistence helper held as a separate bean — same reason the outbound
     * flow uses CallLifecycleTxOps: keep @Transactional methods out of the
     * service that calls them, otherwise Spring's AOP proxy doesn't apply
     * (self-invocation skips the proxy).
     */
    @Service
    public static class InboundCallLogPersister {

        @Autowired private TelephonyCallLogRepository callLogRepo;

        @Transactional(propagation = Propagation.REQUIRES_NEW)
        public String persistInitiated(String providerType, InboundRouteRequest req,
                                       InboundRouteDecision decision) {
            String id = UUID.randomUUID().toString();
            TelephonyCallLog row = TelephonyCallLog.builder()
                    .id(id)
                    .instituteId(req.getInstituteId())
                    .providerType(providerType == null ? ProviderType.EXOTEL : providerType)
                    .providerCallId(req.getProviderCallId())
                    .providerNumberId(req.getDialledNumber() == null ? null
                            : req.getDialledNumber().getId())
                    .responseId(decision.getAttributedResponseId())
                    .userId(decision.getAttributedLeadUserId() == null
                            ? "UNKNOWN" : decision.getAttributedLeadUserId())
                    .counsellorUserId(decision.getAttributedCounsellorUserId())
                    .direction(CallDirection.INBOUND.name())
                    .fromNumber(req.getFromNumber())
                    .toNumber(req.getToNumber())
                    .callerId(req.getToNumber())
                    .status(CallStatus.INITIATED.name())
                    .terminationReason(null)
                    .recordingFetchAttempts(0)
                    .recordingLogged(false)
                    .build()
                    .markNew();
            callLogRepo.save(row);
            return id;
        }
    }
}
