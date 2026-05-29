package vacademy.io.admin_core_service.features.product_page.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldTypeEnum;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.product_page.dto.*;
import vacademy.io.admin_core_service.features.product_page.entity.ProductPage;
import vacademy.io.admin_core_service.features.product_page.entity.ProductPageInviteMapping;
import vacademy.io.admin_core_service.features.product_page.repository.ProductPageInviteMappingRepository;
import vacademy.io.admin_core_service.features.product_page.repository.ProductPageRepository;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.repository.PackageSessionLearnerInvitationToPaymentOptionRepository;
import vacademy.io.admin_core_service.features.shortlink.service.ShortUrlManagementService;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.CouponValidateRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.CouponValidateResponseDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.AppliedCouponDiscount;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponCode;
import vacademy.io.admin_core_service.features.user_subscription.repository.AppliedCouponDiscountRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.CouponCodeRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentPlanRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.coupon.CouponValidationService;
import vacademy.io.common.exceptions.VacademyException;

import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ProductPageService {

    private static final String SOURCE_TYPE = "PRODUCT_PAGE";
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_DRAFT = "DRAFT";
    private static final String STATUS_DELETED = "DELETED";

    @Autowired
    private ProductPageRepository coursePageRepository;

    @Autowired
    private ProductPageInviteMappingRepository mappingRepository;

    @Autowired
    private PackageSessionLearnerInvitationToPaymentOptionRepository psInvitePoRepository;

    @Autowired
    private PaymentPlanRepository paymentPlanRepository;

    @Autowired
    private InstituteCustomFiledService customFieldService;

    @Autowired
    private ShortUrlManagementService shortUrlManagementService;

    @Autowired
    private CouponCodeRepository couponCodeRepository;

    @Autowired
    private AppliedCouponDiscountRepository appliedCouponDiscountRepository;

    @Autowired
    private InstituteSettingService instituteSettingService;
    private CouponValidationService couponValidationService;

    // -------------------------------------------------------------------------
    // Admin CRUD
    // -------------------------------------------------------------------------

    @Transactional
    public ProductPageResponse createProductPage(String instituteId, ProductPageRequest request) {
        ProductPage page = new ProductPage();
        page.setName(request.getName());
        page.setCode(generateUniqueCode());
        page.setInstituteId(instituteId);
        page.setStatus(STATUS_DRAFT);
        page.setPageJson(request.getPageJson());
        page.setSettingsJson(request.getSettingsJson());
        page = coursePageRepository.save(page);

        saveMappings(page, request.getMappings());

        String shortUrl = shortUrlManagementService.createShortUrl(
                buildLearnerUrl(page.getCode()), SOURCE_TYPE, page.getId(), instituteId);
        page.setShortUrl(shortUrl);
        page = coursePageRepository.save(page);

        log.info("Created course page id={} code={} for institute={}", page.getId(), page.getCode(), instituteId);
        return buildAdminResponse(page);
    }

    @Transactional
    public ProductPageResponse updateProductPage(String coursePageId, ProductPageRequest request) {
        ProductPage page = coursePageRepository.findById(coursePageId)
                .orElseThrow(() -> new VacademyException("Course page not found: " + coursePageId));

        page.setName(request.getName());
        if (request.getPageJson() != null)
            page.setPageJson(request.getPageJson());
        if (request.getSettingsJson() != null)
            page.setSettingsJson(request.getSettingsJson());
        if (request.getStatus() != null)
            page.setStatus(request.getStatus());

        if (request.getMappings() != null) {
            mappingRepository.updateStatusByProductPageId(coursePageId, STATUS_DELETED);
            saveMappings(page, request.getMappings());
        }

        page = coursePageRepository.save(page);
        return buildAdminResponse(page);
    }

    @Transactional
    public String deleteProductPage(String coursePageId) {
        ProductPage page = coursePageRepository.findById(coursePageId)
                .orElseThrow(() -> new VacademyException("Course page not found: " + coursePageId));
        page.setStatus(STATUS_DELETED);
        coursePageRepository.save(page);
        return "Deleted";
    }

    public List<ProductPageResponse> getAllProductPages(String instituteId) {
        List<ProductPage> pages = coursePageRepository.findByInstituteIdAndStatusIn(
                instituteId, List.of(STATUS_ACTIVE, STATUS_DRAFT));
        return pages.stream().map(this::buildAdminResponse).collect(Collectors.toList());
    }

    public ProductPageResponse getProductPageById(String coursePageId) {
        ProductPage page = coursePageRepository.findById(coursePageId)
                .orElseThrow(() -> new VacademyException("Course page not found: " + coursePageId));
        return buildAdminResponseWithCustomFields(page);
    }

    // -------------------------------------------------------------------------
    // Custom field management (product-page scoped)
    // -------------------------------------------------------------------------

    @Transactional
    public ProductPageResponse addCustomFieldToPage(String productPageId, String customFieldId, String instituteId) {
        ProductPage page = loadPageForInstitute(productPageId, instituteId);

        List<ProductPageInviteMapping> activeMappings = mappingRepository
                .findByProductPageIdAndStatusIn(productPageId, List.of(STATUS_ACTIVE));
        if (activeMappings.isEmpty()) {
            throw new VacademyException("No active course mappings on this page — add courses and save first");
        }

        for (ProductPageInviteMapping mapping : activeMappings) {
            String enrollInviteId = mapping.getPsInvitePaymentOption().getEnrollInvite().getId();

            CustomFieldDTO cfDto = new CustomFieldDTO();
            cfDto.setId(customFieldId);

            InstituteCustomFieldDTO dto = new InstituteCustomFieldDTO();
            dto.setInstituteId(instituteId);
            dto.setType(CustomFieldTypeEnum.ENROLL_INVITE.name());
            dto.setTypeId(enrollInviteId);
            dto.setCustomField(cfDto);

            customFieldService.addOrUpdateCustomField(List.of(dto));
        }

        return buildAdminResponseWithCustomFields(page, activeMappings);
    }

    @Transactional
    public ProductPageResponse createAndLinkCustomFieldToPage(
            String productPageId, ProductPageCustomFieldCreateRequest request, String instituteId) {

        if (request.getFieldName() == null || request.getFieldName().isBlank()) {
            throw new VacademyException("fieldName is required");
        }
        if (request.getFieldType() == null || request.getFieldType().isBlank()) {
            throw new VacademyException("fieldType is required");
        }

        ProductPage page = loadPageForInstitute(productPageId, instituteId);

        List<ProductPageInviteMapping> activeMappings = mappingRepository
                .findByProductPageIdAndStatusIn(productPageId, List.of(STATUS_ACTIVE));
        if (activeMappings.isEmpty()) {
            throw new VacademyException("No active course mappings on this page — add courses and save first");
        }

        for (ProductPageInviteMapping mapping : activeMappings) {
            String enrollInviteId = mapping.getPsInvitePaymentOption().getEnrollInvite().getId();

            CustomFieldDTO cfDto = new CustomFieldDTO();
            cfDto.setFieldName(request.getFieldName());
            cfDto.setFieldType(request.getFieldType());
            cfDto.setIsMandatory(request.getIsMandatory());
            cfDto.setConfig(request.getConfig());

            InstituteCustomFieldDTO dto = new InstituteCustomFieldDTO();
            dto.setInstituteId(instituteId);
            dto.setType(CustomFieldTypeEnum.ENROLL_INVITE.name());
            dto.setTypeId(enrollInviteId);
            dto.setIsMandatory(request.getIsMandatory());
            dto.setCustomField(cfDto);

            customFieldService.addOrUpdateCustomField(List.of(dto));
        }

        return buildAdminResponseWithCustomFields(page, activeMappings);
    }

    @Transactional
    public ProductPageResponse removeCustomFieldFromPage(String productPageId, String customFieldId,
            String instituteId) {
        ProductPage page = loadPageForInstitute(productPageId, instituteId);

        List<ProductPageInviteMapping> activeMappings = mappingRepository
                .findByProductPageIdAndStatusIn(productPageId, List.of(STATUS_ACTIVE));

        List<String> mappingIdsToDelete = new ArrayList<>();
        for (ProductPageInviteMapping mapping : activeMappings) {
            String enrollInviteId = mapping.getPsInvitePaymentOption().getEnrollInvite().getId();
            customFieldService.getByInstituteIdAndFieldIdAndTypeAndTypeId(
                    instituteId, customFieldId, CustomFieldTypeEnum.ENROLL_INVITE.name(), enrollInviteId)
                    .ifPresent(icf -> mappingIdsToDelete.add(icf.getId()));
        }

        if (!mappingIdsToDelete.isEmpty()) {
            customFieldService.softDeleteMappingsByIds(mappingIdsToDelete);
        }

        return buildAdminResponseWithCustomFields(page, activeMappings);
    }

    /**
     * Loads a product page and validates it belongs to the given institute
     * (cross-tenant guard).
     */
    private ProductPage loadPageForInstitute(String productPageId, String instituteId) {
        ProductPage page = coursePageRepository.findById(productPageId)
                .orElseThrow(() -> new VacademyException("Product page not found: " + productPageId));
        if (!page.getInstituteId().equals(instituteId)) {
            throw new VacademyException("Product page does not belong to this institute");
        }
        return page;
    }

    // -------------------------------------------------------------------------
    // Public (learner-facing)
    // -------------------------------------------------------------------------

    public ProductPageResponse getProductPageByCode(String code, String instituteId) {
        ProductPage page = coursePageRepository.findByCode(code)
                .orElseThrow(() -> new VacademyException("Course page not found for code: " + code));

        if (!page.getInstituteId().equals(instituteId)) {
            throw new VacademyException("Course page does not belong to this institute");
        }
        if (STATUS_DELETED.equals(page.getStatus())) {
            throw new VacademyException("Course page is not available");
        }

        return buildAdminResponseWithCustomFields(page);
    }

    // -------------------------------------------------------------------------
    // Coupon management
    // -------------------------------------------------------------------------

    @Transactional
    public String createCoupon(String coursePageId, ProductPageCouponRequest request) {
        ProductPage page = coursePageRepository.findById(coursePageId)
                .orElseThrow(() -> new VacademyException("Course page not found: " + coursePageId));

        CouponCode couponCode = new CouponCode();
        couponCode.setCode(request.getCode().toUpperCase().trim());
        couponCode.setStatus(STATUS_ACTIVE);
        couponCode.setSourceType(SOURCE_TYPE);
        couponCode.setSourceId(coursePageId);
        // V309: product-page coupons are now institute-scoped too so they appear
        // in the admin coupon list and the per-institute uniqueness constraint applies.
        couponCode.setInstituteId(page.getInstituteId());
        couponCode.setTag(page.getName());
        couponCode.setRedeemStartDate(request.getRedeemStartDate() != null
                ? java.sql.Date.valueOf(request.getRedeemStartDate().toLocalDate())
                : null);
        couponCode.setRedeemEndDate(request.getRedeemEndDate() != null
                ? java.sql.Date.valueOf(request.getRedeemEndDate().toLocalDate())
                : null);
        if (request.getMaxUses() != null)
            couponCode.setUsageLimit(request.getMaxUses().longValue());
        couponCode = couponCodeRepository.save(couponCode);

        AppliedCouponDiscount discount = new AppliedCouponDiscount();
        discount.setName(request.getCode());
        discount.setDiscountType(request.getDiscountType());
        discount.setDiscountPoint(request.getDiscountValue());
        discount.setMaxDiscountPoint(request.getMaxDiscountValue());
        discount.setDiscountSource(SOURCE_TYPE);
        discount.setStatus(STATUS_ACTIVE);
        discount.setCouponCode(couponCode);
        if (request.getRedeemStartDate() != null)
            discount.setRedeemStartDate(java.sql.Date.valueOf(request.getRedeemStartDate().toLocalDate()));
        if (request.getRedeemEndDate() != null)
            discount.setRedeemEndDate(java.sql.Date.valueOf(request.getRedeemEndDate().toLocalDate()));
        appliedCouponDiscountRepository.save(discount);

        log.info("Created coupon {} for course page {}", request.getCode(), coursePageId);
        return "Coupon created";
    }

    @Transactional
    public String deleteCoupon(String couponCodeId) {
        CouponCode coupon = couponCodeRepository.findById(couponCodeId)
                .orElseThrow(() -> new VacademyException("Coupon not found: " + couponCodeId));
        coupon.setStatus(STATUS_DELETED);
        couponCodeRepository.save(coupon);
        return "Coupon deleted";
    }

    public ProductPageCouponValidateResponse validateCoupon(String coursePageCode, String couponCode,
            double totalAmount) {
        ProductPage page = coursePageRepository.findByCode(coursePageCode)
                .orElseThrow(() -> new VacademyException("Course page not found"));

        // Delegate to the generic validator. PRODUCT_PAGE-scoped legacy coupons
        // are matched via product_page_code; the validator does the discount
        // computation using the shared CouponDiscountUtil for identical math.
        CouponValidateRequestDTO req = CouponValidateRequestDTO.builder()
                .couponCode(couponCode)
                .instituteId(page.getInstituteId())
                .productPageCode(coursePageCode)
                .totalAmount(totalAmount)
                .build();
        CouponValidateResponseDTO resp = couponValidationService.validate(req);

        return ProductPageCouponValidateResponse.builder()
                .couponCodeId(resp.getCouponCodeId())
                .appliedCouponDiscountId(resp.getAppliedCouponDiscountId())
                .discountType(resp.getDiscountType())
                .discountValue(resp.getDiscountValue())
                .maxDiscountValue(resp.getMaxDiscountValue())
                .valid(resp.isValid())
                .message(resp.getMessage())
                .build();
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    private void saveMappings(ProductPage page, List<ProductPageInviteMappingRequest> requests) {
        if (requests == null || requests.isEmpty())
            return;

        for (ProductPageInviteMappingRequest req : requests) {
            PackageSessionLearnerInvitationToPaymentOption bridge = psInvitePoRepository
                    .findById(req.getPsInvitePaymentOptionId())
                    .orElseThrow(() -> new VacademyException(
                            "PackageSession-Invite-PaymentOption mapping not found: "
                                    + req.getPsInvitePaymentOptionId()));

            ProductPageInviteMapping mapping = new ProductPageInviteMapping();
            mapping.setProductPage(page);
            mapping.setPsInvitePaymentOption(bridge);
            mapping.setPaymentPlanId(req.getPaymentPlanId());
            mapping.setPreselected(req.isPreselected());
            mapping.setDisplayOrder(req.getDisplayOrder());
            mapping.setStatus(STATUS_ACTIVE);
            mappingRepository.save(mapping);
        }
    }

    ProductPageResponse buildAdminResponse(ProductPage page) {
        ProductPageResponse resp = new ProductPageResponse();
        resp.setId(page.getId());
        resp.setName(page.getName());
        resp.setCode(page.getCode());
        resp.setInstituteId(page.getInstituteId());
        resp.setStatus(page.getStatus());
        resp.setPageJson(page.getPageJson());
        resp.setSettingsJson(page.getSettingsJson());
        resp.setShortUrl(page.getShortUrl());

        List<ProductPageInviteMapping> activeMappings = mappingRepository
                .findByProductPageIdAndStatusIn(page.getId(), List.of(STATUS_ACTIVE));
        resp.setMappings(activeMappings.stream().map(this::toMappingResponse).collect(Collectors.toList()));

        return resp;
    }

    private ProductPageResponse buildAdminResponseWithCustomFields(ProductPage page) {
        List<ProductPageInviteMapping> activeMappings = mappingRepository
                .findByProductPageIdAndStatusIn(page.getId(), List.of(STATUS_ACTIVE));
        return buildAdminResponseWithCustomFields(page, activeMappings);
    }

    /** Overload accepting pre-fetched mappings to avoid a redundant query. */
    private ProductPageResponse buildAdminResponseWithCustomFields(
            ProductPage page, List<ProductPageInviteMapping> activeMappings) {
        ProductPageResponse resp = buildAdminResponse(page);

        resp.setAggregatedCustomFields(aggregateCustomFields(page.getInstituteId(), activeMappings));

        if (!activeMappings.isEmpty()) {
            EnrollInvite firstInvite = activeMappings.get(0).getPsInvitePaymentOption().getEnrollInvite();
            resp.setVendor(firstInvite.getVendor());
            resp.setCurrency(firstInvite.getCurrency());
        }

        // Populate GTM container ID from institute settings
        try {
            Object gtmSetting = instituteSettingService.getSettingByInstituteIdAndKey(page.getInstituteId(),
                    "GTM_SETTING");
            if (gtmSetting instanceof Map) {
                Map<?, ?> gtmMap = (Map<?, ?>) gtmSetting;
                if (Boolean.TRUE.equals(gtmMap.get("enabled"))
                        && gtmMap.get("containerId") != null
                        && StringUtils.hasText(gtmMap.get("containerId").toString())) {
                    resp.setGtmContainerId(gtmMap.get("containerId").toString());
                }
            }
        } catch (Exception e) {
            log.debug("GTM setting not found for institute {}: {}", page.getInstituteId(), e.getMessage());
        }

        return resp;
    }

    /**
     * Aggregates custom fields from all active invite mappings, deduplicated by
     * fieldId.
     * Tracks which enrollInviteIds own each field so the frontend can filter
     * dynamically.
     */
    List<ProductPageAggregatedFieldDTO> aggregateCustomFields(
            String instituteId, List<ProductPageInviteMapping> activeMappings) {

        // fieldId → aggregated DTO (preserving insertion order = first invite's config
        // wins)
        Map<String, ProductPageAggregatedFieldDTO> deduped = new LinkedHashMap<>();

        for (ProductPageInviteMapping mapping : activeMappings) {
            String enrollInviteId = mapping.getPsInvitePaymentOption().getEnrollInvite().getId();

            List<InstituteCustomFieldDTO> fields = customFieldService.findCustomFieldsAsJson(
                    instituteId, CustomFieldTypeEnum.ENROLL_INVITE.name(), enrollInviteId);

            for (InstituteCustomFieldDTO field : fields) {
                // fieldId = CustomFields PK; fall back to InstituteCustomField PK if missing
                String fieldId = field.getFieldId() != null
                        ? field.getFieldId()
                        : field.getId();
                if (deduped.containsKey(fieldId)) {
                    deduped.get(fieldId).addInviteId(enrollInviteId);
                } else {
                    deduped.put(fieldId, new ProductPageAggregatedFieldDTO(field, enrollInviteId));
                }
            }
        }

        return new ArrayList<>(deduped.values());
    }

    private ProductPageInviteMappingResponse toMappingResponse(ProductPageInviteMapping m) {
        ProductPageInviteMappingResponse r = new ProductPageInviteMappingResponse();
        r.setId(m.getId());
        r.setPsInvitePaymentOptionId(m.getPsInvitePaymentOption().getId());
        r.setEnrollInviteId(m.getPsInvitePaymentOption().getEnrollInvite().getId());
        r.setPackageSessionId(m.getPsInvitePaymentOption().getPackageSession().getId());
        r.setPaymentOptionId(m.getPsInvitePaymentOption().getPaymentOption().getId());
        r.setPaymentPlanId(m.getPaymentPlanId());
        r.setPreselected(m.isPreselected());
        r.setDisplayOrder(m.getDisplayOrder());
        r.setStatus(m.getStatus());

        paymentPlanRepository.findById(m.getPaymentPlanId())
                .ifPresent(plan -> r.setPaymentPlan(plan.mapToPaymentPlanDTO()));

        if (m.getPsInvitePaymentOption().getPaymentOption() != null) {
            r.setPaymentOptionType(m.getPsInvitePaymentOption().getPaymentOption().getType());
        }

        vacademy.io.common.institute.entity.session.PackageSession ps = m.getPsInvitePaymentOption()
                .getPackageSession();
        if (ps != null) {
            if (ps.getPackageEntity() != null) {
                r.setPackageId(ps.getPackageEntity().getId());
                r.setPackageName(ps.getPackageEntity().getPackageName());
            }
            if (ps.getLevel() != null)
                r.setLevelName(ps.getLevel().getLevelName());
            if (ps.getSession() != null)
                r.setSessionName(ps.getSession().getSessionName());
        }

        return r;
    }

    private String generateUniqueCode() {
        String chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        SecureRandom random = new SecureRandom();
        String code;
        do {
            StringBuilder sb = new StringBuilder(6);
            for (int i = 0; i < 6; i++)
                sb.append(chars.charAt(random.nextInt(chars.length())));
            code = sb.toString();
        } while (coursePageRepository.existsByCode(code));
        return code;
    }

    private String buildLearnerUrl(String code) {
        // Resolved at runtime; placeholder value — ShortUrlManagementService fetches
        // institute base URL
        return "/product-pages/" + code;
    }

    double computeDiscount(AppliedCouponDiscount discount, double totalAmount) {
        if ("percentage".equalsIgnoreCase(discount.getDiscountType())) {
            double computed = totalAmount * discount.getDiscountPoint() / 100.0;
            if (discount.getMaxDiscountPoint() != null && computed > discount.getMaxDiscountPoint()) {
                return discount.getMaxDiscountPoint();
            }
            return computed;
        } else {
            // FIXED / amount
            return discount.getDiscountPoint() != null ? discount.getDiscountPoint() : 0.0;
        }
    }
}
