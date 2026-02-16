package vacademy.io.admin_core_service.features.user_subscription.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponCode;
import vacademy.io.admin_core_service.features.user_subscription.enums.CouponCodeTag;
import vacademy.io.admin_core_service.features.user_subscription.enums.CouponSourceType;
import vacademy.io.admin_core_service.features.user_subscription.repository.CouponCodeRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.Random;

@Service
public class CouponCodeService {

    @Autowired
    private CouponCodeRepository couponCodeRepository;

    @Autowired
    private vacademy.io.admin_core_service.features.shortlink.service.ShortLinkIntegrationService shortLinkIntegrationService;

    @Autowired
    private vacademy.io.admin_core_service.features.shortlink.service.ShortUrlManagementService shortUrlManagementService;

    @org.springframework.beans.factory.annotation.Value("${default.learner.portal.url:https://learner.vacademy.io}")
    private String learnerBaseUrl;

    @org.springframework.beans.factory.annotation.Value("${default.learner.portal.coupon_path:/coupon}")
    private String couponPath;

    private static final String SHORT_LINK_SOURCE_COUPON = "COUPON_CODE";

    private static final String ALPHANUMERIC_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int COUPON_CODE_LENGTH = 6;
    private static final Random RANDOM = new Random();

    /**
     * Generates a unique 6-digit alphanumeric coupon code
     * 
     * @return unique coupon code
     */
    public String generateUniqueCouponCode() {
        String couponCode;
        do {
            couponCode = generateRandomCode();
        } while (couponCodeRepository.findByCode(couponCode).isPresent());

        return couponCode;
    }

    private String generateRandomCode() {
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < COUPON_CODE_LENGTH; i++) {
            code.append(ALPHANUMERIC_CHARS.charAt(RANDOM.nextInt(ALPHANUMERIC_CHARS.length())));
        }
        return code.toString();
    }

    public CouponCode createCouponCodeForStudent(String sourceId, String sourceType) {
        CouponCode couponCode = new CouponCode();
        couponCode.setCode(generateUniqueCouponCode());
        couponCode.setStatus("ACTIVE");
        couponCode.setSourceType(sourceType);
        couponCode.setSourceId(sourceId);
        couponCode.setEmailRestricted(false);
        couponCode.setTag(CouponCodeTag.DEFAULT.name());
        couponCode.setGenerationDate(new Date());
        couponCode.setRedeemStartDate(new Date());
        couponCode.setRedeemEndDate(new Date(System.currentTimeMillis() + (365L * 24 * 60 * 60 * 1000))); // 1 year from
                                                                                                          // now
        couponCode.setUsageLimit(1L);
        couponCode.setCanBeAdded(true);

        CouponCode savedCoupon = couponCodeRepository.save(couponCode);

        // Generate Short URL using centralized service
        String destinationUrl = learnerBaseUrl + couponPath + "?couponCode=" + savedCoupon.getCode();
        String shortUrl = shortUrlManagementService.createShortUrl(
                destinationUrl,
                SHORT_LINK_SOURCE_COUPON,
                savedCoupon.getId());
        if (shortUrl != null) {
            savedCoupon.setShortUrl(shortUrl);
            savedCoupon = couponCodeRepository.save(savedCoupon);
        }

        return savedCoupon;
    }

    public List<CouponCode> getCouponCodesBySource(String sourceId, String sourceType) {
        return couponCodeRepository.findBySourceIdAndSourceType(sourceId, sourceType);
    }

    public Optional<CouponCode> getCouponCodeBySource(String sourceId, String sourceType) {
        return couponCodeRepository.findFirstBySourceIdAndSourceTypeOrderByCreatedAtDesc(sourceId, sourceType);
    }

    public Optional<CouponCode> getCouponCodeByCode(String code) {
        return couponCodeRepository.findByCode(code);
    }

    public CouponCode updateCouponCodeStatus(CouponCode couponCode, String status) {
        couponCode.setStatus(status);
        return couponCodeRepository.save(couponCode);
    }

    public boolean hasExistingCouponCode(String sourceId, String sourceType) {
        return couponCodeRepository.findFirstBySourceIdAndSourceTypeOrderByCreatedAtDesc(sourceId, sourceType)
                .isPresent();
    }

    public CouponCode createCouponCodeForStudent(String sourceId, CouponSourceType sourceType) {
        return createCouponCodeForStudent(sourceId, sourceType.getValue());
    }

    public boolean hasExistingCouponCode(String sourceId, CouponSourceType sourceType) {
        return hasExistingCouponCode(sourceId, sourceType.getValue());
    }

    public Optional<CouponCode> getCouponCodeBySource(String sourceId, CouponSourceType sourceType) {
        return getCouponCodeBySource(sourceId, sourceType.getValue());
    }

    /**
     * Updates a coupon code and its associated short URL
     */
    public CouponCode updateCouponCode(CouponCode couponCode) {
        CouponCode updated = couponCodeRepository.save(couponCode);

        // Update Short URL using centralized service
        String newDestinationUrl = learnerBaseUrl + couponPath + "?couponCode=" + updated.getCode();
        shortUrlManagementService.updateShortUrl(
                newDestinationUrl,
                SHORT_LINK_SOURCE_COUPON,
                updated.getId(),
                updated.getShortUrl());

        return updated;
    }

    /**
     * Deletes (soft-deletes) a coupon code and its associated short URL
     */
    public void deleteCouponCode(String couponCodeId) {
        Optional<CouponCode> couponOpt = couponCodeRepository.findById(couponCodeId);
        if (couponOpt.isPresent()) {
            CouponCode coupon = couponOpt.get();
            coupon.setStatus("DELETED");
            couponCodeRepository.save(coupon);

            // Delete associated short URL using centralized service
            shortUrlManagementService.deleteShortUrl(
                    SHORT_LINK_SOURCE_COUPON,
                    coupon.getId(),
                    coupon.getShortUrl());
        }
    }
}
