package vacademy.io.admin_core_service.features.telephony.core;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.telephony.core.dto.CallOptionsResponseDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.ConnectCallRequestDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.ConnectCallResponseDTO;
import vacademy.io.admin_core_service.features.telephony.enums.CallStatus;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyProviderNumber;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.admin_core_service.features.telephony.spi.OutboundCallInitiator;
import vacademy.io.admin_core_service.features.telephony.spi.ProviderNumberSelector;
import vacademy.io.admin_core_service.features.telephony.spi.dto.BridgeCallRequest;
import vacademy.io.admin_core_service.features.telephony.spi.dto.NormalizedCallEvent;
import vacademy.io.admin_core_service.features.telephony.spi.dto.OutboundCallHandle;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderNumberView;
import vacademy.io.admin_core_service.features.telephony.spi.dto.SelectionContext;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Optional;

/**
 * Provider-agnostic outbound-call orchestrator.
 *
 * The Exotel HTTP call (5-8s p99) is intentionally OUTSIDE any DB transaction.
 * Holding a connection-pool slot across an external HTTP call would cap
 * concurrent calls at (pool_size / avg_call_seconds) — at our pool of ~20
 * and 5s average, that's only 4 concurrent calls. Splitting the work into
 * two short transactions around the HTTP call lifts that ceiling to whatever
 * pool can momentarily handle, typically 100x.
 *
 * The @Transactional units live in {@link CallLifecycleTxOps}, NOT on this
 * bean. Spring AOP doesn't intercept self-invocation (`this.method()`), so
 * placing the transactional methods on the same bean as `connect()` would
 * make the annotations no-ops. Injecting CallLifecycleTxOps means every
 * call goes through Spring's proxy and the @Transactional behaviour actually
 * engages.
 *
 * Failure model:
 *   - prepareAndPersist fails → row never inserted; user sees error toast.
 *   - HTTP call fails  → markFailedAfterDispatch (REQUIRES_NEW) flips the
 *                        row to FAILED so support can see it.
 *   - commitDispatched fails → unlikely; the call may still be live on
 *                              Exotel but the webhook ?corr= finds the row.
 */
@Service
public class CallOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(CallOrchestrator.class);

    @Autowired private CallLifecycleTxOps tx;
    @Autowired private TelephonyProviderRegistry registry;
    @Autowired private CallEventBus eventBus;
    @Autowired private ProviderCircuitBreaker circuitBreaker;
    @Autowired private TelephonyConfigCache configCache;
    @Autowired private TelephonyCallLogRepository callLogRepo;

    public ConnectCallResponseDTO connect(ConnectCallRequestDTO req, CustomUserDetails actor) {
        String instituteId = requireNonBlank(req.getInstituteId(), "instituteId is required");

        // ── Phase 1: gather + persist (transactional, fast) ──────────────────
        Prepared p = tx.prepareAndPersist(instituteId, req, actor);
        circuitBreaker.assertAvailable(p.providerType());

        // ── Phase 2: external HTTP (no DB connection held) ───────────────────
        OutboundCallHandle handle;
        try {
            handle = registry.initiator(p.providerType()).initiate(p.bridge(), p.creds());
        } catch (Exception e) {
            circuitBreaker.recordFailure(p.providerType(), e);
            tx.markFailedAfterDispatch(p.callLogId(), "provider_initiate_failure");
            log.error("provider initiate failed for call {}", p.callLogId(), e);
            // Surface common, actionable provider errors directly so the
            // counsellor sees "top up balance" instead of "try again later"
            // and stops retrying a doomed call.
            throw new VacademyException(translateProviderError(e));
        }
        circuitBreaker.recordSuccess(p.providerType());

        // ── Phase 3: commit provider id + initial event (transactional, fast) ─
        tx.commitDispatched(p.callLogId(), handle);
        eventBus.publish(p.callLogId(), NormalizedCallEvent.builder()
                .correlationId(p.callLogId())
                .providerCallId(handle.getProviderCallId())
                .status(CallStatus.QUEUED)
                .build());

        return ConnectCallResponseDTO.builder()
                .callLogId(p.callLogId())
                .status(CallStatus.QUEUED.name())
                .callerId(p.callerId())
                .eventsStreamUrl("/admin-core-service/v1/telephony/calls/" + p.callLogId() + "/events")
                .build();
    }

    /**
     * Returns every enabled ExoPhone for the institute plus the one the
     * configured strategy would auto-select for this lead today. Powers the
     * runtime picker popover on the Call button — the frontend pre-checks
     * {@code recommendedNumberId} so the counsellor's default flow stays a
     * single click.
     *
     * Side-effect-free: reads the config cache + (only for STICKY_PER_LEAD)
     * the call-log sticky lookup. No DB writes, no provider HTTP.
     */
    public CallOptionsResponseDTO computeOptions(String instituteId, String leadUserId) {
        if (instituteId == null || instituteId.isBlank()) {
            throw new VacademyException("instituteId is required");
        }
        TelephonyConfigCache.Resolved resolved = configCache.get(instituteId)
                .filter(r -> Boolean.TRUE.equals(r.getConfig().getEnabled()))
                .orElseThrow(() -> new VacademyException("Calling is not configured for this institute"));

        List<TelephonyProviderNumber> enabled = resolved.getEnabledNumbers();
        List<CallOptionsResponseDTO.NumberChoice> choices = enabled.stream()
                .map(n -> CallOptionsResponseDTO.NumberChoice.builder()
                        .id(n.getId())
                        .phoneNumber(n.getPhoneNumber())
                        .label(n.getLabel())
                        .region(n.getRegion())
                        .priority(n.getPriority())
                        .build())
                .toList();

        String strategyKey = resolved.getConfig().getDefaultSelectorKey();
        String recommendedId = null;

        if (!enabled.isEmpty()) {
            List<ProviderNumberView> views = enabled.stream()
                    .map(n -> ProviderNumberView.builder()
                            .id(n.getId())
                            .phoneNumber(n.getPhoneNumber())
                            .label(n.getLabel())
                            .region(n.getRegion())
                            .priority(n.getPriority() == null ? 100 : n.getPriority())
                            .enabled(Boolean.TRUE.equals(n.getEnabled()))
                            .build())
                    .toList();

            Optional<String> sticky = (leadUserId != null && !leadUserId.isBlank()
                    && "STICKY_PER_LEAD".equals(strategyKey))
                    ? callLogRepo.findMostRecentNumberIdForLead(leadUserId)
                    : Optional.empty();

            ProviderNumberSelector selector = registry.selector(strategyKey);
            Optional<ProviderNumberView> picked = selector.select(SelectionContext.builder()
                    .instituteId(instituteId)
                    .leadUserId(leadUserId)
                    .available(views)
                    .lastProviderNumberIdForLead(sticky.orElse(null))
                    .build());

            recommendedId = picked.map(ProviderNumberView::getId).orElse(null);
        }

        return CallOptionsResponseDTO.builder()
                .numbers(choices)
                .recommendedNumberId(recommendedId)
                .strategyKey(strategyKey)
                .build();
    }

    private static String requireNonBlank(String s, String msg) {
        if (s == null || s.isBlank()) throw new VacademyException(msg);
        return s;
    }

    /**
     * Maps common provider HTTP errors onto user-actionable messages.
     * Anything unrecognised falls through to the original generic retry
     * message — keeps unexpected errors loud in logs while avoiding
     * exposing raw provider stack traces to the counsellor's toast.
     */
    private static String translateProviderError(Exception e) {
        String msg = e.getMessage() == null ? "" : e.getMessage().toLowerCase();
        if (msg.contains("insufficient balance") || msg.contains("recharge")) {
            return "Your Exotel account is out of balance. Top up at my.exotel.com and try again.";
        }
        if (msg.contains("not verified") || msg.contains("verify your number")) {
            return "Caller or recipient number is not verified on Exotel. Check the Verified Caller IDs list.";
        }
        if (msg.contains("invalid") && msg.contains("number")) {
            return "Phone number format rejected by the provider. Check the From/To fields.";
        }
        return "Could not place call right now. Try again in a moment.";
    }

    /** Intermediate value carried across the orchestrator's three phases. */
    public record Prepared(
            String callLogId,
            String providerType,
            String callerId,
            BridgeCallRequest bridge,
            TelephonyConfigCache.Resolved resolved
    ) {
        public vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderCredentials creds() {
            return resolved.getCredentials();
        }
    }
}
