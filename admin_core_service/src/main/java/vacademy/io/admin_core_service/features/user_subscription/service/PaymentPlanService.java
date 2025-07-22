package vacademy.io.admin_core_service.features.user_subscription.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentPlanRepository;

import java.util.Optional;

@Service
public class PaymentPlanService {
    @Autowired
    private PaymentPlanRepository paymentPlanRepository;

    public Optional<PaymentPlan>findById(String id){
        return paymentPlanRepository.findById(id);
    }
}
