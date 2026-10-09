package vacademy.io.admin_core_service.features.product_page.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.service.CustomFieldValueService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentRegistrationManager;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerEnrollmentEntryService;
import vacademy.io.admin_core_service.features.learner.service.LearnerCouponService;
import vacademy.io.admin_core_service.features.learner_payment_option_operation.service.ComplexPaymentOptionOperation;
import vacademy.io.admin_core_service.features.learner_payment_option_operation.service.OneTimePaymentOptionOperation;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.payments.service.PaymentService;
import vacademy.io.admin_core_service.features.product_page.dto.ProductPageCpoEnrollRequest;
import vacademy.io.admin_core_service.features.product_page.dto.ProductPageEnrollRequest;
import vacademy.io.admin_core_service.features.product_page.dto.ProductPageEnrollResponse;
import vacademy.io.admin_core_service.features.product_page.dto.ProductPageSelectedMappingDTO;
import vacademy.io.admin_core_service.features.product_page.entity.ProductPage;
import vacademy.io.admin_core_service.features.product_page.entity.ProductPageInviteMapping;
import vacademy.io.admin_core_service.features.product_page.repository.ProductPageInviteMappingRepository;
import vacademy.io.admin_core_service.features.product_page.repository.ProductPageRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.AppliedCouponDiscountRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogLineItemRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentPlanRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.admin_core_service.features.utm_attribution.service.UtmAttributionService;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowEngineService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Checkout prices every course on the plan the page locked on its mapping.
 *
 * The learner app always sends that plan back (PlanTiles chooses between
 * mappings, each on its own locked plan; nothing picks among a payment
 * option's plans), so the real flows below keep working, while a request
 * naming any other plan - a cheaper one, another institute's - is refused
 * before a user, a payment or an enrollment exists.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ProductPageEnrollmentPlanCheckTest {

    private static final String CODE = "store1";
    private static final String INSTITUTE = "inst-1";

    @Mock private ProductPageRepository coursePageRepository;
    @Mock private ProductPageInviteMappingRepository mappingRepository;
    @Mock private PackageSessionRepository packageSessionRepository;
    @Mock private PaymentPlanRepository paymentPlanRepository;
    @Mock private StudentRegistrationManager studentRegistrationManager;
    @Mock private LearnerEnrollmentEntryService learnerEnrollmentEntryService;
    @Mock private CustomFieldValueService customFieldValueService;
    @Mock private PaymentService paymentService;
    @Mock private UserPlanService userPlanService;
    @Mock private OneTimePaymentOptionOperation oneTimePaymentOptionOperation;
    @Mock private ComplexPaymentOptionOperation complexPaymentOptionOperation;
    @Mock private PaymentLogRepository paymentLogRepository;
    @Mock private PaymentLogLineItemRepository paymentLogLineItemRepository;
    @Mock private AppliedCouponDiscountRepository appliedCouponDiscountRepository;
    @Mock private BasketPricingCalculator basketPricingCalculator;
    @Mock private OfferCalculator offerCalculator;
    @Mock private ProductPageService coursePageService;
    @Mock private PaymentLogService paymentLogService;
    @Mock private InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;
    @Mock private AuthService authService;
    @Mock private LearnerCouponService learnerCouponService;
    @Mock private WorkflowEngineService workflowEngineService;
    @Mock private InstituteRepository instituteRepository;
    @Mock private UtmAttributionService utmAttributionService;

    @InjectMocks private ProductPageEnrollmentService service;

    private final List<ProductPageInviteMapping> pageMappings = new ArrayList<>();
    private final Map<String, PaymentPlan> plans = new HashMap<>();
    private final UserDTO learner = new UserDTO();

    @BeforeEach
    void setUp() {
        ProductPage page = new ProductPage();
        page.setId("page-1");
        page.setCode(CODE);
        page.setName("Store");
        page.setInstituteId(INSTITUTE);
        page.setStatus("ACTIVE");
        when(coursePageRepository.findByCode(CODE)).thenReturn(Optional.of(page));
        when(mappingRepository.findOrderedWithBridge(eq("page-1"), any())).thenAnswer(i -> pageMappings);
        when(paymentPlanRepository.findById(anyString()))
                .thenAnswer(i -> Optional.ofNullable(plans.get((String) i.getArgument(0))));

        learner.setId("user-1");
        learner.setEmail("learner@example.com");
        when(authService.createUserFromAuthServiceForLearnerEnrollment(any(UserDTO.class), anyString(), anyBoolean()))
                .thenReturn(learner);
        when(paymentLogService.createPaymentLog(anyString(), anyDouble(), anyString(), any(), anyString(), any(), any()))
                .thenReturn("log-1");
    }

    private PaymentPlan plan(String id, double price) {
        PaymentPlan p = new PaymentPlan();
        p.setId(id);
        p.setName(id);
        p.setStatus("ACTIVE");
        p.setActualPrice(price);
        p.setCurrency("INR");
        plans.put(id, p);
        return p;
    }

    private ProductPageInviteMapping mapping(String bridgeId, String planId, String optionType) {
        PackageEntity pkg = new PackageEntity();
        pkg.setPackageName("Course " + bridgeId);
        PackageSession ps = new PackageSession();
        ps.setId("ps-" + bridgeId);
        ps.setPackageEntity(pkg);
        EnrollInvite invite = new EnrollInvite();
        invite.setId("inv-" + bridgeId);
        invite.setCurrency("INR");
        invite.setInviteCode("CODE-" + bridgeId);
        PaymentOption option = new PaymentOption();
        option.setId("po-" + bridgeId);
        option.setType(optionType);
        PackageSessionLearnerInvitationToPaymentOption bridge = new PackageSessionLearnerInvitationToPaymentOption();
        bridge.setId(bridgeId);
        bridge.setStatus("ACTIVE");
        bridge.setEnrollInvite(invite);
        bridge.setPackageSession(ps);
        bridge.setPaymentOption(option);
        ProductPageInviteMapping m = new ProductPageInviteMapping();
        m.setId("map-" + bridgeId + "-" + planId);
        m.setPsInvitePaymentOption(bridge);
        m.setPaymentPlanId(planId);
        m.setStatus("ACTIVE");
        pageMappings.add(m);
        return m;
    }

    private static ProductPageEnrollRequest enrollRequest(String bridgeId, String planId) {
        ProductPageSelectedMappingDTO sel = new ProductPageSelectedMappingDTO();
        sel.setPsInvitePaymentOptionId(bridgeId);
        sel.setPaymentPlanId(planId);
        sel.setAmount(0d);
        ProductPageEnrollRequest req = new ProductPageEnrollRequest();
        req.setProductPageCode(CODE);
        req.setInstituteId(INSTITUTE);
        req.setSelectedMappings(List.of(sel));
        UserDTO user = new UserDTO();
        user.setEmail("learner@example.com");
        req.setUser(user);
        req.setPaymentInitiationRequest(new PaymentInitiationRequestDTO());
        return req;
    }

    /* ── the rule itself ───────────────────────────────────────────────── */

    @Test
    @DisplayName("the locked plan is accepted, a missing plan id falls back to it, anything else is refused")
    void lockedPlanRule() {
        mapping("psli-a", "plan-a", "ONE_TIME");

        assertEquals("plan-a", ProductPageEnrollmentService.lockedPlanId("psli-a", "plan-a", pageMappings));
        assertEquals("plan-a", ProductPageEnrollmentService.lockedPlanId("psli-a", " plan-a ", pageMappings));
        assertEquals("plan-a", ProductPageEnrollmentService.lockedPlanId("psli-a", null, pageMappings));
        assertEquals("plan-a", ProductPageEnrollmentService.lockedPlanId("psli-a", "", pageMappings));

        VacademyException tampered = assertThrows(VacademyException.class,
                () -> ProductPageEnrollmentService.lockedPlanId("psli-a", "plan-cheap", pageMappings));
        assertEquals(ProductPageEnrollmentService.PRICE_CHANGED_MESSAGE, tampered.getMessage());
        assertThrows(VacademyException.class,
                () -> ProductPageEnrollmentService.lockedPlanId("psli-unknown", "plan-a", pageMappings));
    }

    @Test
    @DisplayName("a bridge row mapped twice on different plans (plan tiles) accepts either plan")
    void sameBridgeOnTwoPlans() {
        mapping("psli-a", "plan-single", "ONE_TIME");
        mapping("psli-a", "plan-combo", "ONE_TIME");
        mapping("psli-b", "plan-b", "ONE_TIME");

        assertEquals("plan-single", ProductPageEnrollmentService.lockedPlanId("psli-a", "plan-single", pageMappings));
        assertEquals("plan-combo", ProductPageEnrollmentService.lockedPlanId("psli-a", "plan-combo", pageMappings));
        // Another course's locked plan is not this course's.
        assertThrows(VacademyException.class,
                () -> ProductPageEnrollmentService.lockedPlanId("psli-a", "plan-b", pageMappings));
    }

    /* ── through the endpoint ──────────────────────────────────────────── */

    @Test
    @DisplayName("enroll refuses a plan the mapping does not sell, before creating anything")
    void enrollRefusesAForeignPlan() {
        mapping("psli-a", "plan-a", "ONE_TIME");
        plan("plan-a", 4999);
        plan("plan-cheap", 1);

        VacademyException e = assertThrows(VacademyException.class,
                () -> service.enrollForProductPage(enrollRequest("psli-a", "plan-cheap")));

        assertEquals(ProductPageEnrollmentService.PRICE_CHANGED_MESSAGE, e.getMessage());
        verify(paymentPlanRepository, never()).findById("plan-cheap");
        verifyNoInteractions(authService, paymentService, userPlanService, paymentLogService,
                oneTimePaymentOptionOperation);
    }

    @Test
    @DisplayName("the learner app's own request (the mapping's locked plan) still enrolls")
    void enrollOnTheLockedPlanStillWorks() {
        ProductPageInviteMapping m = mapping("psli-a", "plan-a", "ONE_TIME");
        PaymentPlan locked = plan("plan-a", 0);

        ProductPageEnrollResponse res = service.enrollForProductPage(enrollRequest("psli-a", "plan-a"));

        assertEquals("PAID", res.getStatus());
        assertEquals(List.of("ps-psli-a"), res.getEnrolledPackageSessionIds());
        verify(userPlanService).createUserPlan(eq("user-1"), same(locked), any(),
                same(m.getPsInvitePaymentOption().getEnrollInvite()),
                same(m.getPsInvitePaymentOption().getPaymentOption()), any(), eq("INVITED"));
    }

    @Test
    @DisplayName("a request that names no plan is priced on the locked one")
    void enrollWithoutPlanIdUsesTheLockedPlan() {
        mapping("psli-a", "plan-a", "ONE_TIME");
        PaymentPlan locked = plan("plan-a", 0);

        ProductPageEnrollResponse res = service.enrollForProductPage(enrollRequest("psli-a", null));

        assertEquals("PAID", res.getStatus());
        verify(userPlanService).createUserPlan(eq("user-1"), same(locked), any(), any(), any(), any(),
                eq("INVITED"));
    }

    @Test
    @DisplayName("CPO enroll refuses a plan the mapping does not sell, before creating the learner")
    void cpoEnrollRefusesAForeignPlan() {
        mapping("psli-cpo", "plan-cpo", "CPO");
        plan("plan-cpo", 90000);
        plan("plan-cheap", 1);
        ProductPageCpoEnrollRequest req = new ProductPageCpoEnrollRequest();
        req.setProductPageCode(CODE);
        req.setInstituteId(INSTITUTE);
        req.setPsInvitePaymentOptionId("psli-cpo");
        req.setPaymentPlanId("plan-cheap");
        req.setUserDetails(new UserDTO());

        VacademyException e = assertThrows(VacademyException.class, () -> service.enrollCpoForProductPage(req));

        assertEquals(ProductPageEnrollmentService.PRICE_CHANGED_MESSAGE, e.getMessage());
        verifyNoInteractions(authService, userPlanService, complexPaymentOptionOperation);
    }

    @Test
    @DisplayName("CPO enroll on the locked plan reaches enrollment with that plan")
    void cpoEnrollOnTheLockedPlan() {
        mapping("psli-cpo", "plan-cpo", "CPO");
        PaymentPlan locked = plan("plan-cpo", 90000);
        ProductPageCpoEnrollRequest req = new ProductPageCpoEnrollRequest();
        req.setProductPageCode(CODE);
        req.setInstituteId(INSTITUTE);
        req.setPsInvitePaymentOptionId("psli-cpo");
        req.setPaymentPlanId("plan-cpo");
        req.setUserDetails(new UserDTO());
        UserPlan userPlan = new UserPlan();
        userPlan.setId("up-1");
        when(userPlanService.createUserPlan(anyString(), any(), any(), any(), any(), any(), anyString()))
                .thenReturn(userPlan);

        ProductPageEnrollResponse res = service.enrollCpoForProductPage(req);

        assertEquals("CPO_ENROLLED", res.getStatus());
        assertEquals("up-1", res.getUserPlanId());
        verify(userPlanService).createUserPlan(eq("user-1"), same(locked), any(), any(), any(), any(), eq("ACTIVE"));
    }
}
