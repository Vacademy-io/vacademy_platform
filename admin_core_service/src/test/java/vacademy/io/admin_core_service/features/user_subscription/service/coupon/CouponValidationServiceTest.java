package vacademy.io.admin_core_service.features.user_subscription.service.coupon;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.product_page.entity.ProductPage;
import vacademy.io.admin_core_service.features.product_page.repository.ProductPageRepository;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.CouponValidateRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.CouponValidateResponseDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.AppliedCouponDiscount;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponCode;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.AppliedCouponDiscountRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.CouponCodeRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.CouponEnrollInviteRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.CouponPackageSessionRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentPlanRepository;

import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Exercises the 7-step validation ladder, scope matching, and the plan-type
 * gate. Pure unit test — no Spring context; we wire mocks via the
 * RequiredArgsConstructor.
 */
class CouponValidationServiceTest {

    private static final String INSTITUTE_ID = "inst-1";
    private static final String OTHER_INSTITUTE_ID = "inst-2";
    private static final String CODE = "SAVE20";

    private CouponCodeRepository couponCodeRepository;
    private AppliedCouponDiscountRepository appliedCouponDiscountRepository;
    private CouponPackageSessionRepository couponPackageSessionRepository;
    private CouponEnrollInviteRepository couponEnrollInviteRepository;
    private ProductPageRepository productPageRepository;
    private PaymentPlanRepository paymentPlanRepository;
    private ObjectMapper objectMapper;

    private CouponValidationService service;

    @BeforeEach
    void setUp() {
        couponCodeRepository = mock(CouponCodeRepository.class);
        appliedCouponDiscountRepository = mock(AppliedCouponDiscountRepository.class);
        couponPackageSessionRepository = mock(CouponPackageSessionRepository.class);
        couponEnrollInviteRepository = mock(CouponEnrollInviteRepository.class);
        productPageRepository = mock(ProductPageRepository.class);
        paymentPlanRepository = mock(PaymentPlanRepository.class);
        objectMapper = new ObjectMapper();

        service = new CouponValidationService(
                couponCodeRepository,
                appliedCouponDiscountRepository,
                couponPackageSessionRepository,
                couponEnrollInviteRepository,
                productPageRepository,
                paymentPlanRepository,
                objectMapper);
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    private CouponCode activeInstituteCoupon() {
        CouponCode c = new CouponCode();
        c.setId("coupon-1");
        c.setCode(CODE);
        c.setStatus("ACTIVE");
        c.setSourceType("INSTITUTE");
        c.setSourceId(INSTITUTE_ID);
        c.setInstituteId(INSTITUTE_ID);
        c.setRedeemEndDate(new Date(System.currentTimeMillis() + 86_400_000)); // tomorrow
        c.setUsageLimit(10L);
        return c;
    }

    private AppliedCouponDiscount percentageDiscount(CouponCode coupon) {
        AppliedCouponDiscount d = new AppliedCouponDiscount();
        d.setId("acd-1");
        d.setDiscountType("PERCENTAGE");
        d.setDiscountPoint(20.0);
        d.setMaxDiscountPoint(500.0);
        d.setStatus("ACTIVE");
        d.setCouponCode(coupon);
        return d;
    }

    private CouponValidateRequestDTO baseRequest() {
        return CouponValidateRequestDTO.builder()
                .couponCode(CODE)
                .instituteId(INSTITUTE_ID)
                .packageSessionId("ps-1")
                .totalAmount(1000.0)
                .build();
    }

    private void stubCouponFound(CouponCode coupon) {
        when(couponCodeRepository.findByInstituteIdAndCode(INSTITUTE_ID, CODE))
                .thenReturn(Optional.of(coupon));
    }

    private void stubDiscountFound(CouponCode coupon, AppliedCouponDiscount discount) {
        when(appliedCouponDiscountRepository
                .findFirstByCouponCode_IdAndStatusOrderByCreatedAtDesc(coupon.getId(), "ACTIVE"))
                .thenReturn(Optional.of(discount));
    }

    private void stubInstituteWideScope(CouponCode coupon) {
        when(couponPackageSessionRepository.findByCouponCodeId(coupon.getId()))
                .thenReturn(List.of());
        when(couponEnrollInviteRepository.findByCouponCodeId(coupon.getId()))
                .thenReturn(List.of());
    }

    // -----------------------------------------------------------------
    // Step 1: lookup
    // -----------------------------------------------------------------

    @Nested
    @DisplayName("Step 1 — lookup")
    class Lookup {

        @Test
        @DisplayName("Unknown code → INVALID_COUPON")
        void unknownCode() {
            when(couponCodeRepository.findByInstituteIdAndCode(INSTITUTE_ID, CODE))
                    .thenReturn(Optional.empty());

            CouponValidateResponseDTO resp = service.validate(baseRequest());

            assertFalse(resp.isValid());
            assertEquals(CouponValidationMessages.INVALID, resp.getMessage());
        }

        @Test
        @DisplayName("Code is trimmed + uppercased before lookup")
        void normalizesCode() {
            CouponCode coupon = activeInstituteCoupon();
            stubCouponFound(coupon);
            stubInstituteWideScope(coupon);
            stubDiscountFound(coupon, percentageDiscount(coupon));

            CouponValidateResponseDTO resp = service.validate(
                    baseRequest().toBuilder().couponCode(" save20 ").build());

            assertTrue(resp.isValid());
        }

        @Test
        @DisplayName("Falls back to PRODUCT_PAGE-source lookup when productPageCode supplied + scoped lookup misses")
        void legacyProductPageFallback() {
            CouponCode legacyCoupon = new CouponCode();
            legacyCoupon.setId("legacy-1");
            legacyCoupon.setCode(CODE);
            legacyCoupon.setStatus("ACTIVE");
            legacyCoupon.setSourceType("PRODUCT_PAGE");
            legacyCoupon.setSourceId("page-1");
            legacyCoupon.setRedeemEndDate(new Date(System.currentTimeMillis() + 86_400_000));
            legacyCoupon.setUsageLimit(10L);

            when(couponCodeRepository.findByInstituteIdAndCode(INSTITUTE_ID, CODE))
                    .thenReturn(Optional.empty());
            when(couponCodeRepository.findByCodeAndSourceType(CODE, "PRODUCT_PAGE"))
                    .thenReturn(Optional.of(legacyCoupon));

            ProductPage page = new ProductPage();
            page.setId("page-1");
            when(productPageRepository.findByCode("product-page-code"))
                    .thenReturn(Optional.of(page));

            stubDiscountFound(legacyCoupon, percentageDiscount(legacyCoupon));

            CouponValidateResponseDTO resp = service.validate(
                    baseRequest().toBuilder()
                            .packageSessionId(null)
                            .productPageCode("product-page-code")
                            .build());

            assertTrue(resp.isValid());
        }
    }

    // -----------------------------------------------------------------
    // Step 2: status
    // -----------------------------------------------------------------

    @Nested
    @DisplayName("Step 2 — status")
    class Status {

        @Test
        @DisplayName("INACTIVE coupon → COUPON_INACTIVE")
        void inactive() {
            CouponCode coupon = activeInstituteCoupon();
            coupon.setStatus("INACTIVE");
            stubCouponFound(coupon);

            CouponValidateResponseDTO resp = service.validate(baseRequest());

            assertFalse(resp.isValid());
            assertEquals(CouponValidationMessages.INACTIVE, resp.getMessage());
        }

        @Test
        @DisplayName("DELETED coupon → COUPON_INACTIVE")
        void deleted() {
            CouponCode coupon = activeInstituteCoupon();
            coupon.setStatus("DELETED");
            stubCouponFound(coupon);

            CouponValidateResponseDTO resp = service.validate(baseRequest());

            assertEquals(CouponValidationMessages.INACTIVE, resp.getMessage());
        }
    }

    // -----------------------------------------------------------------
    // Step 3: validity window
    // -----------------------------------------------------------------

    @Nested
    @DisplayName("Step 3 — validity window")
    class Validity {

        @Test
        @DisplayName("redeemStartDate in the future → COUPON_NOT_STARTED")
        void notYetActive() {
            CouponCode coupon = activeInstituteCoupon();
            coupon.setRedeemStartDate(new Date(System.currentTimeMillis() + 3_600_000)); // 1h from now
            stubCouponFound(coupon);

            CouponValidateResponseDTO resp = service.validate(baseRequest());

            assertEquals(CouponValidationMessages.NOT_STARTED, resp.getMessage());
        }

        @Test
        @DisplayName("redeemEndDate in the past → COUPON_EXPIRED")
        void expired() {
            CouponCode coupon = activeInstituteCoupon();
            coupon.setRedeemEndDate(new Date(System.currentTimeMillis() - 86_400_000)); // yesterday
            stubCouponFound(coupon);

            CouponValidateResponseDTO resp = service.validate(baseRequest());

            assertEquals(CouponValidationMessages.EXPIRED, resp.getMessage());
        }
    }

    // -----------------------------------------------------------------
    // Step 4: usage limit
    // -----------------------------------------------------------------

    @Nested
    @DisplayName("Step 4 — usage_limit")
    class UsageLimit {

        @Test
        @DisplayName("usage_limit=0 → COUPON_LIMIT_REACHED")
        void exhausted() {
            CouponCode coupon = activeInstituteCoupon();
            coupon.setUsageLimit(0L);
            stubCouponFound(coupon);

            CouponValidateResponseDTO resp = service.validate(baseRequest());

            assertEquals(CouponValidationMessages.LIMIT_REACHED, resp.getMessage());
        }

        @Test
        @DisplayName("Null usage_limit is treated as unlimited (passes step 4)")
        void unlimited() {
            CouponCode coupon = activeInstituteCoupon();
            coupon.setUsageLimit(null);
            stubCouponFound(coupon);
            stubInstituteWideScope(coupon);
            stubDiscountFound(coupon, percentageDiscount(coupon));

            CouponValidateResponseDTO resp = service.validate(baseRequest());

            assertTrue(resp.isValid());
        }
    }

    // -----------------------------------------------------------------
    // Step 5: email restriction
    // -----------------------------------------------------------------

    @Nested
    @DisplayName("Step 5 — email restriction")
    class EmailRestriction {

        @Test
        @DisplayName("Restricted coupon + matching email → passes")
        void allowed() {
            CouponCode coupon = activeInstituteCoupon();
            coupon.setEmailRestricted(true);
            coupon.setAllowedEmailIds("[\"alice@x.com\",\"bob@y.com\"]");
            stubCouponFound(coupon);
            stubInstituteWideScope(coupon);
            stubDiscountFound(coupon, percentageDiscount(coupon));

            CouponValidateResponseDTO resp = service.validate(
                    baseRequest().toBuilder().userEmail("BOB@y.com").build()); // case-insensitive

            assertTrue(resp.isValid());
        }

        @Test
        @DisplayName("Restricted coupon + non-matching email → COUPON_EMAIL_RESTRICTED")
        void notAllowed() {
            CouponCode coupon = activeInstituteCoupon();
            coupon.setEmailRestricted(true);
            coupon.setAllowedEmailIds("[\"alice@x.com\"]");
            stubCouponFound(coupon);

            CouponValidateResponseDTO resp = service.validate(
                    baseRequest().toBuilder().userEmail("eve@z.com").build());

            assertEquals(CouponValidationMessages.EMAIL_RESTRICTED, resp.getMessage());
        }

        @Test
        @DisplayName("Restricted coupon + null email → COUPON_EMAIL_RESTRICTED")
        void nullEmail() {
            CouponCode coupon = activeInstituteCoupon();
            coupon.setEmailRestricted(true);
            coupon.setAllowedEmailIds("[\"alice@x.com\"]");
            stubCouponFound(coupon);

            CouponValidateResponseDTO resp = service.validate(baseRequest());

            assertEquals(CouponValidationMessages.EMAIL_RESTRICTED, resp.getMessage());
        }

        @Test
        @DisplayName("Malformed allowed_email_ids JSON → COUPON_EMAIL_RESTRICTED (fail closed)")
        void malformedJson() {
            CouponCode coupon = activeInstituteCoupon();
            coupon.setEmailRestricted(true);
            coupon.setAllowedEmailIds("not-json-{");
            stubCouponFound(coupon);

            CouponValidateResponseDTO resp = service.validate(
                    baseRequest().toBuilder().userEmail("alice@x.com").build());

            assertEquals(CouponValidationMessages.EMAIL_RESTRICTED, resp.getMessage());
        }
    }

    // -----------------------------------------------------------------
    // Step 6: scope
    // -----------------------------------------------------------------

    @Nested
    @DisplayName("Step 6 — scope")
    class Scope {

        @Test
        @DisplayName("Institute mismatch on institute-scoped coupon → COUPON_NOT_APPLICABLE")
        void wrongInstitute() {
            CouponCode coupon = activeInstituteCoupon();
            coupon.setInstituteId(OTHER_INSTITUTE_ID);
            stubCouponFound(coupon);

            CouponValidateResponseDTO resp = service.validate(baseRequest());

            assertEquals(CouponValidationMessages.NOT_APPLICABLE, resp.getMessage());
        }

        @Test
        @DisplayName("Institute-wide (no scope rows) → passes")
        void instituteWide() {
            CouponCode coupon = activeInstituteCoupon();
            stubCouponFound(coupon);
            stubInstituteWideScope(coupon);
            stubDiscountFound(coupon, percentageDiscount(coupon));

            CouponValidateResponseDTO resp = service.validate(baseRequest());

            assertTrue(resp.isValid());
        }

        @Test
        @DisplayName("Package-session-scoped + matching PS → passes")
        void packageSessionMatch() {
            CouponCode coupon = activeInstituteCoupon();
            stubCouponFound(coupon);
            when(couponPackageSessionRepository.findByCouponCodeId(coupon.getId()))
                    .thenReturn(List.of(mock(vacademy.io.admin_core_service.features.user_subscription.entity.CouponPackageSession.class)));
            when(couponPackageSessionRepository.existsByCouponCodeIdAndPackageSessionId(coupon.getId(), "ps-1"))
                    .thenReturn(true);
            when(couponEnrollInviteRepository.findByCouponCodeId(coupon.getId()))
                    .thenReturn(List.of());
            stubDiscountFound(coupon, percentageDiscount(coupon));

            CouponValidateResponseDTO resp = service.validate(baseRequest());

            assertTrue(resp.isValid());
        }

        @Test
        @DisplayName("Package-session-scoped + non-matching PS → COUPON_NOT_APPLICABLE")
        void packageSessionMismatch() {
            CouponCode coupon = activeInstituteCoupon();
            stubCouponFound(coupon);
            when(couponPackageSessionRepository.findByCouponCodeId(coupon.getId()))
                    .thenReturn(List.of(mock(vacademy.io.admin_core_service.features.user_subscription.entity.CouponPackageSession.class)));
            when(couponPackageSessionRepository.existsByCouponCodeIdAndPackageSessionId(coupon.getId(), "ps-1"))
                    .thenReturn(false);
            when(couponEnrollInviteRepository.findByCouponCodeId(coupon.getId()))
                    .thenReturn(List.of());

            CouponValidateResponseDTO resp = service.validate(baseRequest());

            assertEquals(CouponValidationMessages.NOT_APPLICABLE, resp.getMessage());
        }

        @Test
        @DisplayName("Enroll-invite-scoped + matching invite → passes")
        void inviteMatch() {
            CouponCode coupon = activeInstituteCoupon();
            stubCouponFound(coupon);
            when(couponPackageSessionRepository.findByCouponCodeId(coupon.getId()))
                    .thenReturn(List.of());
            when(couponEnrollInviteRepository.findByCouponCodeId(coupon.getId()))
                    .thenReturn(List.of(mock(vacademy.io.admin_core_service.features.user_subscription.entity.CouponEnrollInvite.class)));
            when(couponEnrollInviteRepository.existsByCouponCodeIdAndEnrollInviteId(coupon.getId(), "invite-1"))
                    .thenReturn(true);
            stubDiscountFound(coupon, percentageDiscount(coupon));

            CouponValidateResponseDTO resp = service.validate(
                    baseRequest().toBuilder().enrollInviteId("invite-1").build());

            assertTrue(resp.isValid());
        }
    }

    // -----------------------------------------------------------------
    // Step 7: plan-type gate
    // -----------------------------------------------------------------

    @Nested
    @DisplayName("Step 7 — plan-type gate")
    class PlanType {

        private CouponCode setupValidCoupon() {
            CouponCode coupon = activeInstituteCoupon();
            stubCouponFound(coupon);
            stubInstituteWideScope(coupon);
            stubDiscountFound(coupon, percentageDiscount(coupon));
            return coupon;
        }

        private void stubPlanType(String planId, String paymentOptionType) {
            PaymentOption option = new PaymentOption();
            option.setType(paymentOptionType);
            PaymentPlan plan = new PaymentPlan();
            plan.setId(planId);
            plan.setPaymentOption(option);
            when(paymentPlanRepository.findById(planId)).thenReturn(Optional.of(plan));
        }

        @Test
        @DisplayName("ONE_TIME plan → passes")
        void oneTimeAllowed() {
            setupValidCoupon();
            stubPlanType("plan-1", "ONE_TIME");

            CouponValidateResponseDTO resp = service.validate(
                    baseRequest().toBuilder().paymentPlanId("plan-1").build());

            assertTrue(resp.isValid());
        }

        @Test
        @DisplayName("SUBSCRIPTION plan → passes")
        void subscriptionAllowed() {
            setupValidCoupon();
            stubPlanType("plan-1", "SUBSCRIPTION");

            CouponValidateResponseDTO resp = service.validate(
                    baseRequest().toBuilder().paymentPlanId("plan-1").build());

            assertTrue(resp.isValid());
        }

        @Test
        @DisplayName("FREE plan → COUPON_NOT_FOR_PLAN_TYPE")
        void freeBlocked() {
            setupValidCoupon();
            stubPlanType("plan-1", "FREE");

            CouponValidateResponseDTO resp = service.validate(
                    baseRequest().toBuilder().paymentPlanId("plan-1").build());

            assertEquals(CouponValidationMessages.NOT_FOR_PLAN_TYPE, resp.getMessage());
        }

        @Test
        @DisplayName("DONATION plan → COUPON_NOT_FOR_PLAN_TYPE")
        void donationBlocked() {
            setupValidCoupon();
            stubPlanType("plan-1", "DONATION");

            CouponValidateResponseDTO resp = service.validate(
                    baseRequest().toBuilder().paymentPlanId("plan-1").build());

            assertEquals(CouponValidationMessages.NOT_FOR_PLAN_TYPE, resp.getMessage());
        }

        @Test
        @DisplayName("CPO plan → COUPON_NOT_FOR_PLAN_TYPE")
        void cpoBlocked() {
            setupValidCoupon();
            stubPlanType("plan-1", "CPO");

            CouponValidateResponseDTO resp = service.validate(
                    baseRequest().toBuilder().paymentPlanId("plan-1").build());

            assertEquals(CouponValidationMessages.NOT_FOR_PLAN_TYPE, resp.getMessage());
        }

        @Test
        @DisplayName("Missing paymentPlanId → gate is open (backward compat with legacy callers)")
        void missingPlanId() {
            setupValidCoupon();

            CouponValidateResponseDTO resp = service.validate(baseRequest());

            assertTrue(resp.isValid());
        }
    }

    // -----------------------------------------------------------------
    // Successful happy path
    // -----------------------------------------------------------------

    @Nested
    @DisplayName("Happy path")
    class HappyPath {

        @Test
        @DisplayName("Returns full discount info on success")
        void fullResponse() {
            CouponCode coupon = activeInstituteCoupon();
            stubCouponFound(coupon);
            stubInstituteWideScope(coupon);
            stubDiscountFound(coupon, percentageDiscount(coupon));

            CouponValidateResponseDTO resp = service.validate(baseRequest());

            assertTrue(resp.isValid());
            assertEquals(CouponValidationMessages.VALID, resp.getMessage());
            assertEquals("coupon-1", resp.getCouponCodeId());
            assertEquals("acd-1", resp.getAppliedCouponDiscountId());
            assertEquals("PERCENTAGE", resp.getDiscountType());
            assertEquals(200.0, resp.getDiscountValue());      // 20% of 1000
            assertEquals(500.0, resp.getMaxDiscountValue());
            assertNotNull(resp.getCouponCodeId());
        }

        @Test
        @DisplayName("Discount missing for valid coupon → COUPON_DISCOUNT_NOT_CONFIGURED")
        void noDiscountConfigured() {
            CouponCode coupon = activeInstituteCoupon();
            stubCouponFound(coupon);
            stubInstituteWideScope(coupon);
            when(appliedCouponDiscountRepository
                    .findFirstByCouponCode_IdAndStatusOrderByCreatedAtDesc(eq(coupon.getId()), anyString()))
                    .thenReturn(Optional.empty());

            CouponValidateResponseDTO resp = service.validate(baseRequest());

            assertEquals(CouponValidationMessages.DISCOUNT_MISSING, resp.getMessage());
        }
    }
}
