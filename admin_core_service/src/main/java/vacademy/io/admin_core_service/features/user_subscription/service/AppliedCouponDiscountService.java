package vacademy.io.admin_core_service.features.user_subscription.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.entity.AppliedCouponDiscount;
import vacademy.io.admin_core_service.features.user_subscription.repository.AppliedCouponDiscountRepository;

import java.util.List;
import java.util.Optional;

@Service
public class AppliedCouponDiscountService {
    @Autowired
    private AppliedCouponDiscountRepository appliedCouponDiscountRepository;

    public Optional<AppliedCouponDiscount> findAppliedDiscountBySourceAndTag(String sourceId, String sourceType, String tag) {
        return appliedCouponDiscountRepository.findAppliedDiscountBySourceAndTag(sourceId,
                sourceType,
                tag,
                List.of(StatusEnum.ACTIVE.name()),
                List.of(StatusEnum.ACTIVE.name()));
    }
}
