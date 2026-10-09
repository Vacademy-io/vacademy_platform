package vacademy.io.admin_core_service.features.product_page.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.repository.PackageSessionLearnerInvitationToPaymentOptionRepository;
import vacademy.io.admin_core_service.features.level.enums.LevelStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
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
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Fills a product page with every course version the institute's catalogue
 * sells, so one "store" page can check out anything the site's Courses page
 * shows - at the price the Courses page shows (same bridge row and plan as
 * the public v2 search).
 *
 * Unlike PUT /update, which soft-deletes every mapping and re-inserts the
 * list it is sent, the sync only appends what is missing and switches off
 * what can no longer be sold: mappings the page already has keep their ids,
 * plans, order and flags. CatalogueSyncPlanner holds the rules.
 */
@Slf4j
@Service
public class ProductPageCatalogueSyncService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_INACTIVE = "INACTIVE";
    private static final String STATUS_DELETED = "DELETED";

    @Autowired
    private ProductPageRepository productPageRepository;

    @Autowired
    private ProductPageInviteMappingRepository mappingRepository;

    @Autowired
    private ProductPageCatalogueRepository catalogueRepository;

    @Autowired
    private PackageSessionLearnerInvitationToPaymentOptionRepository bridgeRepository;

    @Autowired
    private ProductPageService productPageService;

    @Autowired
    private InstituteAccessValidator accessValidator;

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * @param deactivateMissing also switch off mappings whose session left the
     *                          catalogue or can no longer be sold (see the planner)
     */
    @Transactional
    public ProductPageCatalogueSyncResponse syncCatalogue(CustomUserDetails user, String productPageId,
                                                          String instituteId, boolean deactivateMissing) {
        accessValidator.requireInstituteAdmin(user, instituteId);
        if (!StringUtils.hasText(productPageId)) {
            throw new VacademyException("productPageId is required");
        }
        // Locked like the editor's save, so a save and a sync never interleave.
        // The institute is part of the locking query, so another institute's
        // page is never locked: it reads as missing rather than forbidden.
        ProductPage page = productPageRepository.lockByIdAndInstituteId(productPageId.trim(), instituteId)
                .filter(p -> !STATUS_DELETED.equals(p.getStatus()))
                .orElseThrow(() -> new VacademyException("Product page not found"));

        List<ProductPageInviteMapping> active = productPageService.activeMappings(page.getId());
        Map<String, PaymentPlan> plans = productPageService.loadPlans(active);
        List<CatalogueSyncPlanner.Row> rows = new ArrayList<>();
        for (ProductPageInviteMapping mapping : active) {
            rows.add(toRow(mapping, plans));
        }
        List<CatalogueSyncPlanner.Pick> picks = new ArrayList<>();
        for (ProductPageCatalogueSessionRow row : catalogueRepository.findCatalogueSessions(
                instituteId,
                List.of(PackageStatusEnum.ACTIVE.name()),
                List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                List.of(LevelStatusEnum.ACTIVE.name()),
                STATUS_ACTIVE)) {
            picks.add(toPick(row));
        }

        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(rows, picks, deactivateMissing);

        Map<String, ProductPageInviteMapping> byId = new HashMap<>();
        for (ProductPageInviteMapping mapping : active) byId.put(mapping.getId(), mapping);
        List<ProductPageInviteMapping> changed = new ArrayList<>();
        for (CatalogueSyncPlanner.Deactivation d : plan.deactivations()) {
            ProductPageInviteMapping mapping = byId.get(d.row().mappingId());
            mapping.setStatus(STATUS_INACTIVE);
            changed.add(mapping);
        }
        for (CatalogueSyncPlanner.Add add : plan.adds()) {
            ProductPageInviteMapping mapping = new ProductPageInviteMapping();
            mapping.setProductPage(page);
            mapping.setPsInvitePaymentOption(bridgeRepository.getReferenceById(add.pick().psliId()));
            mapping.setPaymentPlanId(add.pick().paymentPlanId());
            // Never preselected: on a store page that would put the course in
            // every visitor's cart.
            mapping.setPreselected(false);
            mapping.setDisplayOrder(add.displayOrder());
            mapping.setStatus(STATUS_ACTIVE);
            changed.add(mapping);
        }

        List<ProductPageInviteMapping> after = active;
        if (!changed.isEmpty()) {
            mappingRepository.saveAll(changed);
            mappingRepository.flush();
            // Re-read the page's rows from the database: the new ones hold
            // bridge references that were never loaded.
            entityManager.clear();
            after = productPageService.activeMappings(page.getId());
        }

        ProductPageCatalogueSyncResponse response = new ProductPageCatalogueSyncResponse();
        productPageService.fillAdminResponseWithCustomFields(response, page, after);
        response.setAdded(plan.adds().size());
        response.setDeactivated(plan.deactivations().size());
        for (CatalogueSyncPlanner.Add add : plan.adds()) {
            response.getAddedPackageSessionIds().add(add.pick().packageSessionId());
        }
        for (CatalogueSyncPlanner.Deactivation d : plan.deactivations()) {
            response.getDeactivatedMappings().add(new ProductPageCatalogueSyncResponse.Deactivated(
                    d.row().mappingId(), d.row().packageSessionId(), d.reason(),
                    d.row().packageName(), d.row().levelName()));
        }
        for (CatalogueSyncPlanner.Skip skip : plan.skipped()) {
            response.getSkipped().add(new ProductPageCatalogueSyncResponse.Skipped(
                    skip.pick().packageSessionId(), skip.reason(),
                    skip.pick().packageName(), skip.pick().levelName()));
        }
        response.getWarnings().addAll(plan.warnings());

        log.info("Catalogue sync of product page {} (institute {}): {} added, {} deactivated, {} skipped, "
                        + "{} catalogue sessions, deactivateMissing={}",
                page.getId(), instituteId, plan.adds().size(), plan.deactivations().size(),
                plan.skipped().size(), picks.size(), deactivateMissing);
        return response;
    }

    static CatalogueSyncPlanner.Row toRow(ProductPageInviteMapping mapping, Map<String, PaymentPlan> plans) {
        PackageSessionLearnerInvitationToPaymentOption bridge = mapping.getPsInvitePaymentOption();
        EnrollInvite invite = bridge.getEnrollInvite();
        PackageSession session = bridge.getPackageSession();
        PaymentOption option = bridge.getPaymentOption();
        PaymentPlan plan = plans.get(mapping.getPaymentPlanId());
        return new CatalogueSyncPlanner.Row(
                mapping.getId(),
                mapping.getDisplayOrder(),
                session != null ? session.getId() : null,
                session != null && session.getPackageEntity() != null
                        ? session.getPackageEntity().getPackageName() : null,
                session != null && session.getLevel() != null ? session.getLevel().getLevelName() : null,
                bridge.getId(),
                bridge.getStatus(),
                invite != null ? invite.getId() : null,
                invite != null ? invite.getStatus() : null,
                invite != null ? invite.getStartDate() : null,
                invite != null ? invite.getEndDate() : null,
                invite != null ? invite.getVendor() : null,
                invite != null ? invite.getCurrency() : null,
                option != null,
                option != null ? option.getStatus() : null,
                option != null ? option.getType() : null,
                mapping.getPaymentPlanId(),
                plan != null,
                plan != null ? plan.getStatus() : null,
                plan != null ? plan.getCurrency() : null);
    }

    static CatalogueSyncPlanner.Pick toPick(ProductPageCatalogueSessionRow row) {
        return new CatalogueSyncPlanner.Pick(
                row.getPackageSessionId(),
                row.getPackageName(),
                row.getLevelName(),
                row.getPsliId(),
                row.getInviteId(),
                row.getInviteStatus(),
                row.getInviteTag(),
                row.getInviteStartDate(),
                row.getInviteEndDate(),
                row.getInviteVendor(),
                row.getInviteCurrency(),
                row.getPaymentOptionId(),
                row.getPaymentOptionType(),
                row.getPaymentPlanId(),
                row.getPlanCurrency());
    }
}
