package vacademy.io.admin_core_service.features.product_page.service;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.repository.PackageSessionLearnerInvitationToPaymentOptionRepository;
import vacademy.io.admin_core_service.features.product_page.dto.ProductPageCatalogueSessionRow;
import vacademy.io.admin_core_service.features.product_page.dto.ProductPageCatalogueSyncResponse;
import vacademy.io.admin_core_service.features.product_page.entity.ProductPage;
import vacademy.io.admin_core_service.features.product_page.entity.ProductPageInviteMapping;
import vacademy.io.admin_core_service.features.product_page.repository.ProductPageCatalogueRepository;
import vacademy.io.admin_core_service.features.product_page.repository.ProductPageInviteMappingRepository;
import vacademy.io.admin_core_service.features.product_page.repository.ProductPageRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.ForbiddenException;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The sync endpoint's wiring: who may call it, which page it may touch, and
 * that it appends and switches off rows in place instead of replacing the
 * page's mappings the way PUT /update does.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ProductPageCatalogueSyncServiceTest {

    private static final String INSTITUTE = "inst-1";
    private static final String PAGE_ID = "page-1";

    @Mock private ProductPageRepository productPageRepository;
    @Mock private ProductPageInviteMappingRepository mappingRepository;
    @Mock private ProductPageCatalogueRepository catalogueRepository;
    @Mock private PackageSessionLearnerInvitationToPaymentOptionRepository bridgeRepository;
    @Mock private ProductPageService productPageService;
    @Mock private InstituteAccessValidator accessValidator;
    @Mock private EntityManager entityManager;
    @Mock private CustomUserDetails user;

    @InjectMocks private ProductPageCatalogueSyncService service;

    private ProductPage page;
    private final List<ProductPageInviteMapping> active = new ArrayList<>();
    private final Map<String, PaymentPlan> plans = new HashMap<>();
    private final List<ProductPageCatalogueSessionRow> catalogue = new ArrayList<>();

    @BeforeEach
    void setUp() {
        page = new ProductPage();
        page.setId(PAGE_ID);
        page.setInstituteId(INSTITUTE);
        page.setStatus("ACTIVE");
        page.setName("Store");
        // As the query does: the page only when it belongs to the institute named.
        when(productPageRepository.lockByIdAndInstituteId(eq(PAGE_ID), anyString()))
                .thenAnswer(i -> i.getArgument(1).equals(page.getInstituteId()) ? Optional.of(page) : Optional.empty());
        when(productPageService.activeMappings(PAGE_ID)).thenAnswer(i -> new ArrayList<>(active));
        when(productPageService.loadPlans(any())).thenAnswer(i -> plans);
        when(catalogueRepository.findCatalogueSessions(eq(INSTITUTE), anyList(), anyList(), anyList(), eq("ACTIVE")))
                .thenAnswer(i -> catalogue);
        when(bridgeRepository.getReferenceById(anyString())).thenAnswer(i -> {
            PackageSessionLearnerInvitationToPaymentOption ref = new PackageSessionLearnerInvitationToPaymentOption();
            ref.setId(i.getArgument(0));
            return ref;
        });
        when(mappingRepository.saveAll(any())).thenAnswer(i -> i.getArgument(0));
    }

    /** An existing ACTIVE mapping selling `session` through healthy rows. */
    private ProductPageInviteMapping mapping(String id, int order, String session) {
        PackageEntity pkg = new PackageEntity();
        pkg.setPackageName("Course " + session);
        Level level = new Level();
        level.setLevelName("Hindi");
        PackageSession ps = new PackageSession();
        ps.setId(session);
        ps.setPackageEntity(pkg);
        ps.setLevel(level);
        EnrollInvite invite = new EnrollInvite();
        invite.setId("inv-" + session);
        invite.setStatus("ACTIVE");
        invite.setVendor("RAZORPAY");
        invite.setCurrency("INR");
        PaymentOption option = new PaymentOption();
        option.setId("po-" + session);
        option.setStatus("ACTIVE");
        option.setType("ONE_TIME");
        PackageSessionLearnerInvitationToPaymentOption bridge = new PackageSessionLearnerInvitationToPaymentOption();
        bridge.setId("psli-" + session);
        bridge.setStatus("ACTIVE");
        bridge.setEnrollInvite(invite);
        bridge.setPackageSession(ps);
        bridge.setPaymentOption(option);
        ProductPageInviteMapping m = new ProductPageInviteMapping();
        m.setId(id);
        m.setProductPage(page);
        m.setPsInvitePaymentOption(bridge);
        m.setPaymentPlanId("plan-" + session);
        m.setDisplayOrder(order);
        m.setPreselected(true);
        m.setStatus("ACTIVE");
        PaymentPlan plan = new PaymentPlan();
        plan.setId("plan-" + session);
        plan.setStatus("ACTIVE");
        plan.setCurrency("INR");
        plans.put(plan.getId(), plan);
        active.add(m);
        return m;
    }

    /** A sellable catalogue row, as the native query returns it. */
    private void catalogueRow(String session) {
        catalogueRow(session, "ONE_TIME");
    }

    private void catalogueRow(String session, String optionType) {
        Map<String, Object> values = new HashMap<>();
        values.put("PackageSessionId", session);
        values.put("PackageName", "Course " + session);
        values.put("LevelName", "Hindi");
        values.put("PsliId", "psli-" + session);
        values.put("InviteId", "inv-" + session);
        values.put("InviteStatus", "ACTIVE");
        values.put("InviteTag", "DEFAULT");
        values.put("InviteVendor", "RAZORPAY");
        values.put("InviteCurrency", "INR");
        values.put("PaymentOptionId", "po-" + session);
        values.put("PaymentOptionType", optionType);
        values.put("PaymentPlanId", "plan-" + session);
        values.put("PlanCurrency", "INR");
        catalogue.add((ProductPageCatalogueSessionRow) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[]{ProductPageCatalogueSessionRow.class},
                (proxy, method, args) -> values.get(method.getName().substring(3))));
    }

    @SuppressWarnings("unchecked")
    private List<ProductPageInviteMapping> saved() {
        ArgumentCaptor<Collection<ProductPageInviteMapping>> captor = ArgumentCaptor.forClass(Collection.class);
        verify(mappingRepository).saveAll(captor.capture());
        return new ArrayList<>(captor.getValue());
    }

    @Test
    @DisplayName("appends the missing catalogue sessions, switches off what left, and never replaces the page")
    void appendsAndDeactivatesInPlace() {
        ProductPageInviteMapping kept = mapping("m1", 0, "a");
        ProductPageInviteMapping gone = mapping("m2", 4, "gone");
        catalogueRow("a");
        catalogueRow("b");

        ProductPageCatalogueSyncResponse res = service.syncCatalogue(user, PAGE_ID, INSTITUTE, true);

        verify(accessValidator).requireInstituteAdmin(user, INSTITUTE);
        List<ProductPageInviteMapping> saved = saved();
        assertEquals(2, saved.size());
        assertSame(gone, saved.get(0));
        assertEquals("INACTIVE", gone.getStatus());
        assertEquals("ACTIVE", kept.getStatus());
        assertTrue(kept.isPreselected(), "an existing mapping keeps its own flags");

        ProductPageInviteMapping added = saved.get(1);
        assertEquals("psli-b", added.getPsInvitePaymentOption().getId());
        assertEquals("plan-b", added.getPaymentPlanId());
        assertEquals(5, added.getDisplayOrder());
        assertFalse(added.isPreselected());
        assertEquals("ACTIVE", added.getStatus());
        assertSame(page, added.getProductPage());

        verify(mappingRepository, never()).updateStatusByProductPageId(anyString(), anyString());
        verify(mappingRepository).flush();
        verify(entityManager).clear();
        verify(productPageService).fillAdminResponseWithCustomFields(eq(res), eq(page), any());

        assertEquals(1, res.getAdded());
        assertEquals(1, res.getDeactivated());
        assertEquals(List.of("b"), res.getAddedPackageSessionIds());
        assertEquals("m2", res.getDeactivatedMappings().get(0).getMappingId());
        assertEquals("left_catalogue", res.getDeactivatedMappings().get(0).getReason());
        assertTrue(res.getSkipped().isEmpty());
    }

    @Test
    @DisplayName("the response is the page plus the sync summary, in snake_case")
    void responseWireShape() throws Exception {
        mapping("m1", 0, "gone");
        catalogueRow("b");
        catalogueRow("cpo", "CPO");
        org.mockito.Mockito.doAnswer(i -> {
            ProductPageCatalogueSyncResponse r = i.getArgument(0);
            r.setId(PAGE_ID);
            r.setCode("store1");
            r.setMappings(List.of());
            return null;
        }).when(productPageService).fillAdminResponseWithCustomFields(any(), any(), any());

        ProductPageCatalogueSyncResponse res = service.syncCatalogue(user, PAGE_ID, INSTITUTE, true);
        com.fasterxml.jackson.databind.JsonNode json = new com.fasterxml.jackson.databind.ObjectMapper()
                .valueToTree(res);

        assertEquals("page-1", json.get("id").asText());
        assertEquals("store1", json.get("code").asText());
        assertTrue(json.get("mappings").isArray());
        assertEquals(1, json.get("added").asInt());
        assertEquals(1, json.get("deactivated").asInt());
        assertEquals("b", json.get("added_package_session_ids").get(0).asText());
        assertEquals("left_catalogue", json.get("deactivated_mappings").get(0).get("reason").asText());
        assertEquals("m1", json.get("deactivated_mappings").get(0).get("mapping_id").asText());
        assertEquals("cpo", json.get("skipped").get(0).get("package_session_id").asText());
        assertEquals("cpo_not_supported", json.get("skipped").get(0).get("reason").asText());
        assertEquals("Course cpo", json.get("skipped").get(0).get("package_name").asText());
        assertTrue(json.get("warnings").isArray());
    }

    @Test
    @DisplayName("deactivateMissing=false only adds")
    void addOnly() {
        ProductPageInviteMapping gone = mapping("m1", 0, "gone");
        catalogueRow("b");

        ProductPageCatalogueSyncResponse res = service.syncCatalogue(user, PAGE_ID, INSTITUTE, false);

        assertEquals("ACTIVE", gone.getStatus());
        assertEquals(1, res.getAdded());
        assertEquals(0, res.getDeactivated());
        assertEquals(1, saved().size());
    }

    @Test
    @DisplayName("a page already in sync writes nothing")
    void nothingToDo() {
        mapping("m1", 0, "a");
        catalogueRow("a");

        ProductPageCatalogueSyncResponse res = service.syncCatalogue(user, PAGE_ID, INSTITUTE, true);

        verify(mappingRepository, never()).saveAll(any());
        verify(entityManager, never()).clear();
        assertEquals(0, res.getAdded());
        assertEquals(0, res.getDeactivated());
    }

    @Test
    @DisplayName("only an institute ADMIN may sync")
    void requiresAdmin() {
        doThrow(new ForbiddenException("Access denied: institute admin role required"))
                .when(accessValidator).requireInstituteAdmin(user, INSTITUTE);

        assertThrows(ForbiddenException.class, () -> service.syncCatalogue(user, PAGE_ID, INSTITUTE, true));
        verify(productPageRepository, never()).lockByIdAndInstituteId(anyString(), anyString());
        verify(productPageRepository, never()).lockById(anyString());
        verify(mappingRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("another institute's page, or a deleted one, is not found")
    void pageMustBelongToTheInstitute() {
        page.setInstituteId("inst-2");
        assertThrows(VacademyException.class, () -> service.syncCatalogue(user, PAGE_ID, INSTITUTE, true));
        // The tenant check is part of the locking query: the other institute's
        // row is never locked by the unscoped lock.
        verify(productPageRepository).lockByIdAndInstituteId(PAGE_ID, INSTITUTE);
        verify(productPageRepository, never()).lockById(anyString());

        page.setInstituteId(INSTITUTE);
        page.setStatus("DELETED");
        assertThrows(VacademyException.class, () -> service.syncCatalogue(user, PAGE_ID, INSTITUTE, true));

        when(productPageRepository.lockByIdAndInstituteId("nope", INSTITUTE)).thenReturn(Optional.empty());
        assertThrows(VacademyException.class, () -> service.syncCatalogue(user, "nope", INSTITUTE, true));
        verify(catalogueRepository, never()).findCatalogueSessions(any(), any(), any(), any(), any());
        verify(mappingRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("a mapping whose invite window closed is switched off and its session re-added from the catalogue")
    void closedInviteIsReplaced() {
        mapping("m1", 0, "a");
        ProductPageInviteMapping expired = mapping("m2", 1, "b");
        expired.getPsInvitePaymentOption().getEnrollInvite()
                .setEndDate(new java.sql.Date(System.currentTimeMillis() - 7L * 24 * 60 * 60 * 1000));
        catalogueRow("a");
        // The catalogue sells "b" through its current (open) invite now.
        catalogueRow("b");

        ProductPageCatalogueSyncResponse res = service.syncCatalogue(user, PAGE_ID, INSTITUTE, true);

        assertEquals("INACTIVE", expired.getStatus());
        assertEquals(1, res.getDeactivated());
        assertEquals("invite_expired", res.getDeactivatedMappings().get(0).getReason());
        assertEquals(List.of("b"), res.getAddedPackageSessionIds());
    }

    @Test
    @DisplayName("the catalogue is read with the statuses the public v2 search uses")
    void readsTheV2CatalogueScope() {
        service.syncCatalogue(user, PAGE_ID, INSTITUTE, true);

        verify(catalogueRepository).findCatalogueSessions(INSTITUTE, List.of("ACTIVE"), List.of("ACTIVE", "HIDDEN"),
                List.of("ACTIVE"), "ACTIVE");
    }

    @Test
    @DisplayName("an existing mapping is described to the planner from its bridge, invite, option and plan")
    void rowFromMapping() {
        ProductPageInviteMapping m = mapping("m1", 3, "a");
        m.getPsInvitePaymentOption().getEnrollInvite().setStatus("INACTIVE");
        m.getPsInvitePaymentOption().getPaymentOption().setType("CPO");

        CatalogueSyncPlanner.Row row = ProductPageCatalogueSyncService.toRow(m, plans);

        assertEquals("m1", row.mappingId());
        assertEquals(3, row.displayOrder());
        assertEquals("a", row.packageSessionId());
        assertEquals("Course a", row.packageName());
        assertEquals("psli-a", row.bridgeId());
        assertEquals("INACTIVE", row.inviteStatus());
        assertNull(row.inviteStartDate());
        assertNull(row.inviteEndDate());
        assertEquals("CPO", row.paymentOptionType());
        java.sql.Date start = new java.sql.Date(1_700_000_000_000L);
        java.sql.Date end = new java.sql.Date(1_800_000_000_000L);
        m.getPsInvitePaymentOption().getEnrollInvite().setStartDate(start);
        m.getPsInvitePaymentOption().getEnrollInvite().setEndDate(end);
        CatalogueSyncPlanner.Row dated = ProductPageCatalogueSyncService.toRow(m, plans);
        assertEquals(start, dated.inviteStartDate());
        assertEquals(end, dated.inviteEndDate());
        assertTrue(row.planFound());
        assertFalse(ProductPageCatalogueSyncService.toRow(m, Map.of()).planFound());
    }

    @Test
    @DisplayName("a catalogue row keeps every column the planner reads")
    void pickFromRow() {
        catalogueRow("a");

        CatalogueSyncPlanner.Pick pick = ProductPageCatalogueSyncService.toPick(catalogue.get(0));

        assertEquals("a", pick.packageSessionId());
        assertEquals("psli-a", pick.psliId());
        assertEquals("inv-a", pick.inviteId());
        assertEquals("DEFAULT", pick.inviteTag());
        assertEquals("ONE_TIME", pick.paymentOptionType());
        assertEquals("plan-a", pick.paymentPlanId());
        assertEquals("INR", pick.planCurrency());
        assertEquals("RAZORPAY", pick.inviteVendor());
        assertEquals("Hindi", pick.levelName());
    }
}
