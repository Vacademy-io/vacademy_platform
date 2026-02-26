package vacademy.io.admin_core_service.features.learner.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponCode;
import vacademy.io.admin_core_service.features.user_subscription.enums.CouponSourceType;
import vacademy.io.admin_core_service.features.user_subscription.repository.CouponCodeRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.CouponCodeService;

import java.util.List;

@Slf4j
@Service
public class LearnerCouponService {

    @Autowired
    private CouponCodeService couponCodeService;

    @Autowired
    private CouponCodeRepository couponCodeRepository;

    /**
     * Generates a coupon code for a learner if they don't already have one
     * Uses a separate transaction to ensure coupon is saved even if main enrollment fails
     * @param userId The learner's user ID
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void generateCouponCodeForLearner(String userId, String instituteId, String inviteCode) {
        try {
            // Check if user already has a coupon code
            if (!couponCodeService.hasExistingCouponCode(userId, CouponSourceType.USER)) {
                couponCodeService.createCouponCodeForStudent(userId, CouponSourceType.USER.getValue(), instituteId,
                        inviteCode);
            } else {
                log.info("User {} already has a coupon code, skipping generation", userId);
            }
        } catch (Exception e) {
            log.error("Failed to generate coupon code for learner {}: {}", userId, e.getMessage(), e);
            // Don't re-throw the exception to avoid breaking the main enrollment process
        }
    }
}
