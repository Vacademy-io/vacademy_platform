package vacademy.io.community_service.feature.pricing.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.community_service.feature.pricing.dto.ProductDto;
import vacademy.io.community_service.feature.pricing.entity.PricingPlan;
import vacademy.io.community_service.feature.pricing.entity.PricingPlanFeature;
import vacademy.io.community_service.feature.pricing.entity.PricingProduct;
import vacademy.io.community_service.feature.pricing.entity.PricingSetting;
import vacademy.io.community_service.feature.pricing.repository.*;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Reads the admin-editable catalogue out of the database and shapes it for the builder.
 *
 * Everything the calculator needs comes from here, so changing a price is an UPDATE rather than
 * a deploy. Nothing is cached: the catalogue is tiny and quotes must never be priced off stale
 * numbers.
 */
@Service
@Slf4j
public class PricingCatalogService {

    // Pricing models.
    public static final String PER_LEARNER_TIER = "PER_LEARNER_TIER";
    public static final String FLAT_ANNUAL = "FLAT_ANNUAL";
    public static final String ONE_TIME = "ONE_TIME";
    public static final String SEAT_BASED = "SEAT_BASED";
    public static final String COUNT_BASED = "COUNT_BASED";
    public static final String USAGE = "USAGE";

    @Autowired
    private PricingProductRepository productRepository;
    @Autowired
    private PricingPlanRepository planRepository;
    @Autowired
    private PricingPlanFeatureRepository featureRepository;
    @Autowired
    private PricingSettingRepository settingRepository;

    // ---- settings ----------------------------------------------------------------

    public Map<String, String> settings() {
        Map<String, String> m = new LinkedHashMap<>();
        for (PricingSetting s : settingRepository.findAll()) {
            m.put(s.getKey(), s.getValue());
        }
        return m;
    }

    public BigDecimal setting(String key, String fallback) {
        return settingRepository.findById(key)
                .map(s -> parse(s.getValue(), fallback))
                .orElseGet(() -> new BigDecimal(fallback));
    }

    public String settingText(String key, String fallback) {
        return settingRepository.findById(key).map(PricingSetting::getValue).orElse(fallback);
    }

    private static BigDecimal parse(String v, String fallback) {
        try {
            return new BigDecimal(v);
        } catch (Exception e) {
            log.warn("Bad pricing setting value '{}', falling back to {}", v, fallback);
            return new BigDecimal(fallback);
        }
    }

    // ---- catalogue ---------------------------------------------------------------

    /** Active products with their active plans, ordered for display. */
    public List<ProductDto> catalog() {
        List<PricingProduct> products = productRepository.findByActiveTrueOrderBySortOrderAsc();
        List<PricingPlan> plans = planRepository.findByActiveTrueOrderByProductCodeAscSortOrderAsc();

        Map<String, List<PricingPlanFeature>> featuresByPlan = plans.isEmpty()
                ? Map.of()
                : featureRepository.findByPlanIdInOrderBySortOrderAsc(
                        plans.stream().map(PricingPlan::getId).toList())
                .stream().collect(Collectors.groupingBy(PricingPlanFeature::getPlanId));

        Map<String, List<PricingPlan>> plansByProduct = plans.stream()
                .collect(Collectors.groupingBy(PricingPlan::getProductCode));

        List<ProductDto> out = new ArrayList<>();
        for (PricingProduct p : products) {
            List<PricingPlan> productPlans = plansByProduct.getOrDefault(p.getCode(), List.of());
            List<ProductDto.PlanDto> planDtos = productPlans.stream()
                    .map(pl -> toPlanDto(p, pl, featuresByPlan.getOrDefault(pl.getId(), List.of())))
                    .toList();

            out.add(ProductDto.builder()
                    .code(p.getCode())
                    .name(p.getName())
                    .tagline(p.getTagline())
                    .icon(p.getIcon())
                    .pricingModel(p.getPricingModel())
                    .basePrice(p.getBasePrice())
                    .unitPrice(p.getUnitPrice())
                    .includedUnits(p.getIncludedUnits())
                    .unitLabel(p.getUnitLabel())
                    .minQuantity(Math.max(1, p.getMinQuantity()))
                    .requiresProductCode(p.getRequiresProductCode())
                    .mirrorsProductCode(p.getMirrorsProductCode())
                    .fromPrice(cheapest(planDtos))
                    .plans(planDtos)
                    .build());
        }
        return out;
    }

    private ProductDto.PlanDto toPlanDto(PricingProduct product, PricingPlan plan,
                                         List<PricingPlanFeature> features) {
        return ProductDto.PlanDto.builder()
                .code(plan.getCode())
                .name(plan.getName())
                .description(plan.getDescription())
                .unitCount(plan.getUnitCount())
                .price(plan.getPrice())
                .annualPrice(annualPrice(product, plan))
                .popular(plan.isPopular())
                .features(features.stream()
                        .map(f -> new ProductDto.FeatureDto(f.getLabel(), f.isIncluded()))
                        .toList())
                .build();
    }

    /** List price for one year of this plan, before any billing-cycle adjustment. */
    public BigDecimal annualPrice(PricingProduct product, PricingPlan plan) {
        if (PER_LEARNER_TIER.equals(product.getPricingModel()) && plan.getUnitCount() != null) {
            return plan.getPrice().multiply(BigDecimal.valueOf(plan.getUnitCount()));
        }
        return plan.getPrice();
    }

    private static BigDecimal cheapest(List<ProductDto.PlanDto> plans) {
        return plans.stream()
                .map(ProductDto.PlanDto::getAnnualPrice)
                .filter(Objects::nonNull)
                .filter(v -> v.signum() > 0)
                .min(BigDecimal::compareTo)
                .orElse(null);
    }

    // ---- lookups used while pricing ----------------------------------------------

    public Optional<PricingProduct> product(String code) {
        return productRepository.findByCode(code);
    }

    public Optional<PricingPlan> plan(String productCode, String planCode) {
        return planRepository.findByProductCodeAndCode(productCode, planCode);
    }

    /** Feature labels a plan includes, for the quote's "included at no extra cost" panel. */
    public List<String> includedFeatures(String planId) {
        return featureRepository.findByPlanIdOrderBySortOrderAsc(planId).stream()
                .filter(PricingPlanFeature::isIncluded)
                .map(PricingPlanFeature::getLabel)
                .toList();
    }

    /** First active plan of a product — the implicit choice for single-plan products. */
    public Optional<PricingPlan> defaultPlan(String productCode) {
        return planRepository.findByProductCodeOrderBySortOrderAsc(productCode).stream()
                .filter(PricingPlan::isActive)
                .findFirst();
    }
}
