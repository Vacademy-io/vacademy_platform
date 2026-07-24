package vacademy.io.admin_core_service.features.live_session.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.invoice.entity.Invoice;
import vacademy.io.admin_core_service.features.invoice.service.InvoiceService;
import vacademy.io.admin_core_service.features.live_session.dto.GuestRegistrationRequestDTO;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionPaymentConfigDTO;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionRegistrationPaymentResponseDTO;
import vacademy.io.admin_core_service.features.live_session.dto.PaidLiveSessionRegistrationRequestDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.entity.SessionGuestRegistration;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionGuestRegistrationRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionSource;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionTag;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentOptionRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentPlanRepository;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.currency.CurrencyGatewaySupport;
import vacademy.io.common.payment.enums.PaymentGateway;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * Paid live sessions.
 *
 * <p>The price is stored as a {@link PaymentOption} scoped to the session
 * (source=LIVE_SESSION, source_id=live_session.id, type=ONE_TIME) with one
 * {@link PaymentPlan} carrying amount + currency. A session with no ACTIVE
 * option behaves exactly as before this feature (free registration/join).</p>
 *
 * <p>The purchase rides on the invoice machinery: registration creates an
 * Invoice (source=LIVE_SESSION, source_id=registration id) that the payer
 * settles through the existing open /pay/invoice flow — so gateway initiation,
 * webhooks, PDF generation and the invoice email are all reused. When the
 * invoice flips to PAID, {@code InvoiceService.markAdminInvoicePaidByPaymentLog}
 * also flips the registration's payment_status (see the LIVE_SESSION hook there).</p>
 */
@Slf4j
@Service
public class LiveSessionPaymentService {

    public static final String PAYMENT_STATUS_PENDING = "PENDING";
    public static final String PAYMENT_STATUS_PAID = "PAID";

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_DELETED = "DELETED";

    @Autowired
    private LiveSessionRepository liveSessionRepository;

    @Autowired
    private SessionGuestRegistrationRepository registrationRepository;

    @Autowired
    private PaymentOptionRepository paymentOptionRepository;

    @Autowired
    private PaymentPlanRepository paymentPlanRepository;

    @Autowired
    private RegistrationService registrationService;

    @Autowired
    private AuthService authService;

    @Autowired
    private InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;

    // Lazy: InvoiceService pulls in the whole payments graph; keep context startup
    // cycle-free (same pattern as other engine-reaching beans in this codebase).
    @Autowired
    @Lazy
    private InvoiceService invoiceService;

    // ── Admin config (wizard Step 2) ─────────────────────────────────────────

    @Transactional
    public void upsertPaymentConfig(LiveSession session, LiveSessionPaymentConfigDTO config) {
        if (config == null) {
            return; // request didn't touch payment settings
        }
        Optional<PaymentOption> existing = findActivePaymentOption(session.getId());

        if (!Boolean.TRUE.equals(config.getEnabled())) {
            existing.ifPresent(option -> {
                option.setStatus(STATUS_DELETED);
                paymentOptionRepository.save(option);
            });
            return;
        }

        if (config.getPrice() == null || config.getPrice() <= 0) {
            throw new VacademyException("A paid live session needs a price greater than zero");
        }
        if (!StringUtils.hasText(config.getCurrency())) {
            throw new VacademyException("A paid live session needs a currency");
        }
        String currency = config.getCurrency().trim().toUpperCase();

        // Fail at config time, not at the payer's checkout: the fee is charged through
        // the institute's configured gateway, so the chosen currency must be one that
        // gateway supports (e.g. Razorpay cannot charge AUD).
        try {
            InstitutePaymentGatewayMappingService.VendorInfo vendorInfo =
                    institutePaymentGatewayMappingService.getLatestVendorInfoForInstitute(session.getInstituteId());
            PaymentGateway gateway = PaymentGateway.fromString(vendorInfo.getVendor());
            if (!CurrencyGatewaySupport.isSupported(gateway, currency)) {
                throw new VacademyException("Currency " + currency + " is not supported by your institute's payment gateway ("
                        + gateway.name() + "). Choose a supported currency or switch the gateway in payment settings.");
            }
        } catch (VacademyException validationFailure) {
            throw validationFailure;
        } catch (Exception e) {
            // Gateway not configured / lookup failed — don't block saving the fee; the
            // checkout will surface the real error if the institute never sets one up.
            log.warn("Could not validate currency {} against institute {} gateway: {}",
                    currency, session.getInstituteId(), e.getMessage());
        }

        PaymentOption option = existing.orElseGet(() -> {
            PaymentOption created = new PaymentOption();
            created.setSource(PaymentOptionSource.LIVE_SESSION.name());
            created.setSourceId(session.getId());
            created.setType(PaymentOptionType.ONE_TIME.name());
            created.setTag(PaymentOptionTag.DEFAULT.name());
            created.setStatus(STATUS_ACTIVE);
            created.setRequireApproval(false);
            return created;
        });
        option.setName("Live class fee - " + (StringUtils.hasText(session.getTitle()) ? session.getTitle() : session.getId()));
        option = paymentOptionRepository.save(option);

        PaymentPlan plan = option.getPaymentPlans() != null && !option.getPaymentPlans().isEmpty()
                ? option.getPaymentPlans().get(0)
                : new PaymentPlan();
        plan.setName("Live class fee");
        plan.setStatus(STATUS_ACTIVE);
        plan.setActualPrice(config.getPrice());
        plan.setElevatedPrice(config.getPrice());
        plan.setCurrency(currency);
        plan.setPaymentOption(option);
        paymentPlanRepository.save(plan);
    }

    public Optional<PaymentOption> findActivePaymentOption(String sessionId) {
        return paymentOptionRepository.findFirstBySourceAndSourceIdAndStatusOrderByCreatedAtDesc(
                PaymentOptionSource.LIVE_SESSION.name(), sessionId, STATUS_ACTIVE);
    }

    public Optional<PaymentPlan> findActivePlan(String sessionId) {
        return findActivePaymentOption(sessionId)
                .flatMap(option -> option.getPaymentPlans() == null
                        ? Optional.empty()
                        : option.getPaymentPlans().stream().findFirst());
    }

    // ── Read side ────────────────────────────────────────────────────────────

    /**
     * Payment state for a session, optionally narrowed to one registrant (by email).
     * Free session → paymentRequired=false and everything else null.
     */
    public LiveSessionRegistrationPaymentResponseDTO getPaymentInfo(String sessionId, String email) {
        return getPaymentInfo(sessionId, email, null);
    }

    /**
     * Registration/payment state looked up by either guest identity — email
     * (classic) or mobile number (phone-identity institutes). Email wins when
     * both are supplied and matches exist for each.
     */
    public LiveSessionRegistrationPaymentResponseDTO getPaymentInfo(String sessionId, String email, String mobileNumber) {
        LiveSession session = liveSessionRepository.findById(sessionId)
                .orElseThrow(() -> new VacademyException("Live session not found: " + sessionId));

        Optional<PaymentPlan> planOpt = findActivePlan(sessionId);
        LiveSessionRegistrationPaymentResponseDTO.LiveSessionRegistrationPaymentResponseDTOBuilder builder =
                LiveSessionRegistrationPaymentResponseDTO.builder()
                        .paymentRequired(planOpt.isPresent())
                        .instituteId(session.getInstituteId());

        planOpt.ifPresent(plan -> builder
                .price(plan.getActualPrice())
                .currency(plan.getCurrency()));

        findRegistrationByIdentity(sessionId, email, mobileNumber)
                .ifPresent(reg -> builder
                        .registrationId(reg.getId())
                        .paymentStatus(reg.getPaymentStatus())
                        .invoiceId(reg.getInvoiceId()));
        return builder.build();
    }

    private Optional<SessionGuestRegistration> findRegistrationByIdentity(
            String sessionId, String email, String mobileNumber) {
        if (StringUtils.hasText(email)) {
            Optional<SessionGuestRegistration> byEmail =
                    registrationRepository.findBySessionIdAndEmail(sessionId, email.trim().toLowerCase());
            if (byEmail.isPresent()) {
                return byEmail;
            }
        }
        String normalizedPhone = SessionGuestRegistration.normalizeMobileNumber(mobileNumber);
        if (normalizedPhone != null) {
            return registrationRepository.findBySessionIdAndMobileNumber(sessionId, normalizedPhone);
        }
        return Optional.empty();
    }

    /** Payment state for an authenticated learner (matched by userId, then email). */
    public LiveSessionRegistrationPaymentResponseDTO getPaymentInfoForUser(String sessionId, String userId, String email) {
        LiveSessionRegistrationPaymentResponseDTO info = getPaymentInfo(sessionId, email);
        if (info.getRegistrationId() == null && StringUtils.hasText(userId)) {
            registrationRepository.findFirstBySessionIdAndUserId(sessionId, userId).ifPresent(reg -> {
                info.setRegistrationId(reg.getId());
                info.setPaymentStatus(reg.getPaymentStatus());
                info.setInvoiceId(reg.getInvoiceId());
            });
        }
        return info;
    }

    /** True when a non-host must be blocked because the session is paid and this identity hasn't paid. */
    public boolean isPaymentPending(String sessionId, String userId, String email) {
        if (findActivePaymentOption(sessionId).isEmpty()) {
            return false;
        }
        if (StringUtils.hasText(userId)
                && registrationRepository.existsBySessionIdAndUserIdAndPaymentStatus(sessionId, userId, PAYMENT_STATUS_PAID)) {
            return false;
        }
        if (StringUtils.hasText(email)
                && registrationRepository.existsBySessionIdAndEmailAndPaymentStatus(sessionId, email.trim().toLowerCase(), PAYMENT_STATUS_PAID)) {
            return false;
        }
        return true;
    }

    /** True when the given guest registration id belongs to this session and is fully paid (or the session is free). */
    public boolean isRegistrationCleared(String sessionId, String registrationId) {
        if (findActivePaymentOption(sessionId).isEmpty()) {
            return true;
        }
        if (!StringUtils.hasText(registrationId)) {
            return false;
        }
        return registrationRepository.findById(registrationId)
                .filter(reg -> sessionId.equals(reg.getSessionId()))
                .map(reg -> PAYMENT_STATUS_PAID.equals(reg.getPaymentStatus()))
                .orElse(false);
    }

    // ── Registration + payment initiation ────────────────────────────────────

    /**
     * Registers the payer (creating the registration row + custom-field values if
     * new) and raises/reuses a PENDING_PAYMENT invoice for the session fee. For a
     * free session this degrades to the legacy guest registration. Idempotent:
     * re-invoking for a PENDING registration returns the same invoice; for a PAID
     * one it just reports PAID.
     *
     * @param authenticatedUserId non-null for the logged-in learner flow — the
     *                            registration is bound to that user instead of a
     *                            fresh guest-created account.
     */
    @Transactional
    public LiveSessionRegistrationPaymentResponseDTO registerAndInitiate(
            PaidLiveSessionRegistrationRequestDTO request, String authenticatedUserId) {

        if (!StringUtils.hasText(request.getSessionId())
                || (!StringUtils.hasText(request.getEmail()) && !StringUtils.hasText(request.getMobileNumber()))) {
            throw new VacademyException("session_id and an email or mobile number are required");
        }
        LiveSession session = liveSessionRepository.findById(request.getSessionId())
                .orElseThrow(() -> new VacademyException("Live session not found: " + request.getSessionId()));
        String email = StringUtils.hasText(request.getEmail())
                ? request.getEmail().trim().toLowerCase() : null;

        Optional<PaymentPlan> planOpt = findActivePlan(session.getId());
        // Paid sessions bill through the invoice machinery, which needs an auth
        // user and sends the invoice by email — phone-only registration is only
        // possible for free sessions.
        if (planOpt.isPresent() && email == null) {
            throw new VacademyException("This is a paid live class — an email address is required to register");
        }
        Optional<SessionGuestRegistration> existingOpt =
                findRegistrationByIdentity(session.getId(), email, request.getMobileNumber());

        // Free session — legacy behaviour.
        if (planOpt.isEmpty()) {
            String registrationId = existingOpt.map(SessionGuestRegistration::getId)
                    .orElseGet(() -> registrationService.saveGuestUserDetails(toGuestRequest(request, email)));
            return LiveSessionRegistrationPaymentResponseDTO.builder()
                    .registrationId(registrationId)
                    .paymentRequired(false)
                    .instituteId(session.getInstituteId())
                    .build();
        }

        PaymentPlan plan = planOpt.get();

        if (existingOpt.isPresent() && PAYMENT_STATUS_PAID.equals(existingOpt.get().getPaymentStatus())) {
            SessionGuestRegistration paid = existingOpt.get();
            return LiveSessionRegistrationPaymentResponseDTO.builder()
                    .registrationId(paid.getId())
                    .paymentRequired(true)
                    .paymentStatus(PAYMENT_STATUS_PAID)
                    .invoiceId(paid.getInvoiceId())
                    .price(plan.getActualPrice())
                    .currency(plan.getCurrency())
                    .instituteId(session.getInstituteId())
                    .build();
        }

        // Invoices require a real user (invoice.user_id NOT NULL) and the invoice
        // email goes to that user — so guarantee an auth user for the payer.
        String payerUserId = authenticatedUserId;
        if (!StringUtils.hasText(payerUserId)) {
            UserDTO toCreate = new UserDTO();
            toCreate.setEmail(email);
            toCreate.setUsername(email);
            toCreate.setFullName(StringUtils.hasText(request.getFullName())
                    ? request.getFullName()
                    : email.substring(0, email.indexOf('@') > 0 ? email.indexOf('@') : email.length()));
            UserDTO created = authService.createUserFromAuthService(toCreate, session.getInstituteId(), false);
            payerUserId = created.getId();
        }

        SessionGuestRegistration registration = existingOpt.orElseGet(() -> {
            try {
                String registrationId = registrationService.saveGuestUserDetails(toGuestRequest(request, email));
                return registrationRepository.findById(registrationId)
                        .orElseThrow(() -> new VacademyException("Registration not found after creation"));
            } catch (Exception insertFailure) {
                // Concurrent double-submit: the unique (session_id, email) constraint (or the
                // duplicate guard inside saveGuestUserDetails) fired because a parallel request
                // won the insert. Recover idempotently by using the winner's row.
                return findRegistrationByIdentity(session.getId(), email, request.getMobileNumber())
                        .orElseThrow(() -> new VacademyException(
                                "Failed to create registration: " + insertFailure.getMessage()));
            }
        });
        registration.setUserId(payerUserId);
        registration.setPaymentStatus(PAYMENT_STATUS_PENDING);
        registration.setPaymentAmount(BigDecimal.valueOf(plan.getActualPrice()));
        registration.setPaymentCurrency(plan.getCurrency());

        // Reuse a still-payable invoice; otherwise raise a fresh one (e.g. price changed
        // since the abandoned attempt, or the old invoice was rejected).
        Invoice invoice = null;
        if (StringUtils.hasText(registration.getInvoiceId())) {
            invoice = invoiceService.findPayableInvoice(registration.getInvoiceId(),
                    BigDecimal.valueOf(plan.getActualPrice()), plan.getCurrency());
        }
        if (invoice == null) {
            invoice = invoiceService.createLiveSessionInvoice(
                    payerUserId,
                    session.getInstituteId(),
                    StringUtils.hasText(session.getTitle()) ? session.getTitle() : "Live class",
                    registration.getId(),
                    BigDecimal.valueOf(plan.getActualPrice()),
                    plan.getCurrency());
            registration.setInvoiceId(invoice.getId());
        }
        registrationRepository.save(registration);

        return LiveSessionRegistrationPaymentResponseDTO.builder()
                .registrationId(registration.getId())
                .paymentRequired(true)
                .paymentStatus(registration.getPaymentStatus())
                .invoiceId(invoice.getId())
                .totalAmount(invoice.getTotalAmount())
                .price(plan.getActualPrice())
                .currency(plan.getCurrency())
                .instituteId(session.getInstituteId())
                .build();
    }

    /** Authenticated-learner variant: identity comes from the JWT user, not the request body. */
    @Transactional
    public LiveSessionRegistrationPaymentResponseDTO registerAndInitiateForUser(String sessionId, String userId) {
        UserDTO user = fetchUser(userId);
        PaidLiveSessionRegistrationRequestDTO request = new PaidLiveSessionRegistrationRequestDTO(
                sessionId, user.getEmail(), null, user.getFullName(), java.util.List.of());
        return registerAndInitiate(request, userId);
    }

    public LiveSessionRegistrationPaymentResponseDTO getPaymentStatusForUser(String sessionId, String userId) {
        UserDTO user = fetchUser(userId);
        return getPaymentInfoForUser(sessionId, userId, user.getEmail());
    }

    private UserDTO fetchUser(String userId) {
        java.util.List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(java.util.List.of(userId));
        if (users.isEmpty() || users.get(0) == null) {
            throw new VacademyException("User not found: " + userId);
        }
        return users.get(0);
    }

    private GuestRegistrationRequestDTO toGuestRequest(PaidLiveSessionRegistrationRequestDTO request, String email) {
        return new GuestRegistrationRequestDTO(
                request.getSessionId(),
                email,
                request.getMobileNumber(),
                request.getCustomFields() != null ? request.getCustomFields() : java.util.List.of());
    }
}
