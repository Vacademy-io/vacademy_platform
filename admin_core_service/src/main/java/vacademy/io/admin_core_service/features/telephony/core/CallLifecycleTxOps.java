package vacademy.io.admin_core_service.features.telephony.core;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.telephony.core.dto.ConnectCallRequestDTO;
import vacademy.io.admin_core_service.features.telephony.enums.CallDirection;
import vacademy.io.admin_core_service.features.telephony.enums.CallStatus;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyProviderNumber;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.admin_core_service.features.telephony.spi.dto.BridgeCallRequest;
import vacademy.io.admin_core_service.features.telephony.spi.dto.OriginationContext;
import vacademy.io.admin_core_service.features.telephony.spi.dto.OriginationPlan;
import vacademy.io.admin_core_service.features.telephony.spi.dto.OutboundCallHandle;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderNumberView;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.UUID;

/**
 * Holds the @Transactional methods of the call-orchestration flow in a
 * separate bean from {@link CallOrchestrator}.
 *
 * Why a separate bean: Spring AOP wraps every Spring-managed bean in a proxy
 * that enforces @Transactional / @Async semantics. When code inside a bean
 * calls another method on `this`, the call goes through the raw object,
 * NOT the proxy, so the annotation has no effect. By placing each
 * transactional unit on its own bean and injecting it into the
 * orchestrator, every call goes through the proxy and the annotations
 * actually engage.
 *
 * Three units of work, each its own short transaction:
 *   - prepareAndPersist:  read config from cache + validate + INSERT row
 *   - commitDispatched:   UPDATE row with provider Sid; only if still INITIATED
 *                         (so a fast webhook arriving with IN_PROGRESS isn't
 *                         clobbered back to QUEUED)
 *   - markFailedAfterDispatch: REQUIRES_NEW — runs in its own tx even if the
 *                         caller is mid-rollback.
 */
@Service
public class CallLifecycleTxOps {

    @Autowired private TelephonyCallLogRepository callLogRepo;
    @Autowired private AudienceResponseRepository audienceResponseRepo;
    @Autowired private TelephonyProviderRegistry registry;
    @Autowired private UserMobileResolver userMobileResolver;
    @Autowired private TelephonyConfigCache configCache;

    @Value("${telephony.webhook.callback-base:}")
    private String webhookBase;

    @Transactional
    public CallOrchestrator.Prepared prepareAndPersist(String instituteId,
                                                       ConnectCallRequestDTO req,
                                                       CustomUserDetails actor) {
        TelephonyConfigCache.Resolved resolved = configCache.get(instituteId)
                .filter(r -> Boolean.TRUE.equals(r.getConfig().getEnabled()))
                .orElseThrow(() -> new VacademyException("Calling is not configured for this institute"));

        AudienceResponse lead = audienceResponseRepo.findById(req.getResponseId())
                .orElseThrow(() -> new VacademyException("Lead not found"));

        String leadPhone = firstNonBlank(lead.getParentMobile(),
                userMobileResolver.findMobile(lead.getUserId()).orElse(null));
        if (leadPhone == null) throw new VacademyException("Lead has no phone on file");
        if (!leadPhone.matches("^\\+?[0-9]{8,15}$")) {
            throw new VacademyException("Lead phone number format not supported");
        }

        String providerType = resolved.getConfig().getProviderType();
        List<ProviderNumberView> views = resolved.getEnabledNumbers().stream()
                .map(CallLifecycleTxOps::toView).toList();

        // Provider-specific origination (Exotel: verified mobile + pooled ExoPhone
        // via selector; Airtel/Vonage: the counsellor's extension + DID). The core
        // no longer assumes either model — the registered resolver decides.
        OriginationPlan plan = registry.originationResolver(providerType).resolve(
                OriginationContext.builder()
                        .instituteId(instituteId)
                        .providerType(providerType)
                        .counsellorUserId(actor.getUserId())
                        .leadUserId(lead.getUserId())
                        .leadPhone(leadPhone)
                        .preferredNumberId(req.getPreferredNumberId())
                        .selectorKey(resolved.getConfig().getDefaultSelectorKey())
                        .available(views)
                        .build());

        String callLogId = UUID.randomUUID().toString();
        TelephonyCallLog row = TelephonyCallLog.builder()
                .id(callLogId)
                .instituteId(instituteId)
                .providerType(providerType)
                .providerNumberId(plan.getProviderNumberId())
                .responseId(lead.getId())
                .userId(lead.getUserId())
                .counsellorUserId(actor.getUserId())
                .direction(CallDirection.OUTBOUND.name())
                .fromNumber(plan.getFrom())
                .toNumber(leadPhone)
                .callerId(plan.getCallerId())
                .status(CallStatus.INITIATED.name())
                .recordingFetchAttempts(0)
                .recordingLogged(false)
                .build();
        // Tell JPA this is a brand-new row — avoids the pre-INSERT SELECT
        // that Spring Data JPA does when the entity has an assigned ID.
        row.markNew();
        callLogRepo.save(row);

        BridgeCallRequest bridge = BridgeCallRequest.builder()
                .from(plan.getFrom())
                .to(leadPhone)
                .callerId(plan.getCallerId())
                .record(Boolean.TRUE.equals(resolved.getConfig().getRecordCalls()))
                .correlationId(callLogId)
                .statusCallbackUrl(buildStatusCallbackUrl(providerType,
                        resolved.getWebhookToken(), callLogId))
                .build();

        return new CallOrchestrator.Prepared(callLogId, providerType,
                plan.getCallerId(), bridge, resolved);
    }

    /**
     * Update the row with the provider Sid + QUEUED — but ONLY if the row is
     * still in INITIATED state. A webhook delivered before this method runs
     * may have already moved status forward (RINGING / IN_PROGRESS); we must
     * never reverse those.
     */
    @Transactional
    public void commitDispatched(String callLogId, OutboundCallHandle handle) {
        TelephonyCallLog row = callLogRepo.findById(callLogId).orElse(null);
        if (row == null) return;
        // Always set providerCallId — webhooks may have matched only via corr
        // up to this point, and storing the Sid helps debugging.
        if (row.getProviderCallId() == null) {
            row.setProviderCallId(handle.getProviderCallId());
        }
        if (CallStatus.INITIATED.name().equals(row.getStatus())) {
            row.setStatus(CallStatus.QUEUED.name());
        }
        callLogRepo.save(row);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailedAfterDispatch(String callLogId, String reason) {
        TelephonyCallLog row = callLogRepo.findById(callLogId).orElse(null);
        if (row == null) return;
        row.setStatus(CallStatus.FAILED.name());
        row.setTerminationReason(reason);
        callLogRepo.save(row);
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

    private String buildStatusCallbackUrl(String providerType, String token, String corr) {
        String base = webhookBase == null || webhookBase.isBlank()
                ? "https://api.vacademy.io"
                : webhookBase;
        StringBuilder url = new StringBuilder(base)
                .append("/admin-core-service/v1/telephony/webhook/status")
                .append("?provider=").append(providerType)
                .append("&corr=").append(corr);
        // ?token= is only included when the institute has set a webhook
        // secret. In "open" mode (token null/blank) we leave it off entirely
        // so the URL stays clean and the handler accepts all callbacks.
        if (token != null && !token.isBlank()) {
            url.append("&token=").append(token);
        }
        return url.toString();
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a;
        if (b != null && !b.isBlank()) return b;
        return null;
    }
}
