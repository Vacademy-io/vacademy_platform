package vacademy.io.admin_core_service.features.telephony.spi;

import vacademy.io.admin_core_service.features.telephony.spi.dto.InboundRouteDecision;
import vacademy.io.admin_core_service.features.telephony.spi.dto.InboundRouteRequest;

import java.util.Optional;

/**
 * One strategy for resolving an inbound call to a counsellor. Multiple
 * implementations live in {@code core/inbound/} and are chained by
 * {@link vacademy.io.admin_core_service.features.telephony.core.InboundRoutingService}
 * in priority order — first non-empty result wins.
 *
 * Distinct from {@link ProviderNumberSelector} on purpose: selectors pick a
 * caller-ID number for an OUTBOUND call; routers pick a counsellor for an
 * INBOUND call. The two answer fundamentally different questions and have
 * different inputs, so they get their own port.
 */
public interface InboundLeadRouter {

    /**
     * Strategy identifier. Used in telemetry on
     * {@link InboundRouteDecision#getStrategyKey()} so dashboards can show
     * which router fired for each inbound call. Convention: SCREAMING_SNAKE,
     * matches a constant in
     * {@link vacademy.io.admin_core_service.features.telephony.enums.InboundRouterStrategy}.
     */
    String strategyKey();

    /**
     * Decide whether this strategy can route the request. Empty result means
     * "fall through to the next strategy in the chain". A non-empty decision
     * is final — the chain stops there.
     *
     * Strategies MUST be cheap on a miss: this method is on the synchronous
     * Connect-applet path and the provider waits with the lead's audio
     * connection held open. Target: ≤ 20 ms per strategy on miss, ≤ 200 ms
     * per strategy on hit (one indexed SQL).
     */
    Optional<InboundRouteDecision> route(InboundRouteRequest req);
}
