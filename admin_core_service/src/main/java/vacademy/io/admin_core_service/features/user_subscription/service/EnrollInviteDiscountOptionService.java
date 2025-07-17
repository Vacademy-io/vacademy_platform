package vacademy.io.admin_core_service.features.user_subscription.service;

import org.checkerframework.checker.units.qual.A;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.user_subscription.entity.EnrollInviteDiscountOption;
import vacademy.io.admin_core_service.features.user_subscription.repository.EnrollInviteDiscountOptionRepository;

@Service
public class EnrollInviteDiscountOptionService {
    @Autowired
    private EnrollInviteDiscountOptionRepository enrollInviteDiscountOptionRepository;

    public EnrollInviteDiscountOption save(EnrollInviteDiscountOption enrollInviteDiscountOption) {
        return enrollInviteDiscountOptionRepository.save(enrollInviteDiscountOption);
    }
}
