package vacademy.io.admin_core_service.features.user_subscription.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentPlanDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentPlanRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class PaymentPlanService {
    @Autowired
    private PaymentPlanRepository paymentPlanRepository;

    public Optional<PaymentPlan>findById(String id){
        return paymentPlanRepository.findById(id);
    }
     public List<PaymentPlan> findByPaymentOption(PaymentOption paymentOption) {
        return paymentPlanRepository.findByPaymentOption(paymentOption);
    }
    public List<PaymentPlan>editPaymentPlans(List<PaymentPlan>existingPaymentPlans, List<PaymentPlanDTO>paymentPlanDTOS, PaymentOption paymentOption){
        Map<String,PaymentPlan>existingPaymentPlanMap = existingPaymentPlans.stream().
                collect(Collectors.toMap(PaymentPlan::getId, Function.identity()));
        List<PaymentPlan>toSave = new ArrayList<>();
        Set<String> retainedIds = new HashSet<>();
        for (PaymentPlanDTO paymentPlanDTO : paymentPlanDTOS) {
            if (StringUtils.hasText(paymentPlanDTO.getId())){
                PaymentPlan paymentPlan = existingPaymentPlanMap.get(paymentPlanDTO.getId());
                if (paymentPlan != null){
                    updatePaymentPlan(paymentPlan,paymentPlanDTO);
                }else{
                    throw new VacademyException("Payment Plan with id " + paymentPlanDTO.getId() + " not found");
                }
                retainedIds.add(paymentPlanDTO.getId());
                toSave.add(paymentPlan);
            }else{
                toSave.add(new PaymentPlan(paymentPlanDTO,paymentOption));
            }
        }
        // Plans the edit dropped (or replaced by id-less copies) must be retired, or
        // they stay ACTIVE alongside the new ones and learners see duplicate plans.
        List<PaymentPlan> dropped = existingPaymentPlans.stream()
                .filter(plan -> !retainedIds.contains(plan.getId()))
                .toList();
        if (!dropped.isEmpty()) {
            dropped.forEach(plan -> plan.setStatus(StatusEnum.DELETED.name()));
            paymentPlanRepository.saveAll(dropped);
        }
        return toSave;
    }
    private void updatePaymentPlan(PaymentPlan paymentPlan, PaymentPlanDTO paymentPlanDTO) {
        paymentPlan.setName(paymentPlanDTO.getName());
        paymentPlan.setStatus(paymentPlanDTO.getStatus());
        paymentPlan.setValidityInDays(paymentPlanDTO.getValidityInDays());
        paymentPlan.setActualPrice(paymentPlanDTO.getActualPrice());
        paymentPlan.setElevatedPrice(paymentPlanDTO.getElevatedPrice());
        paymentPlan.setCurrency(paymentPlanDTO.getCurrency());
        paymentPlan.setDescription(paymentPlanDTO.getDescription());
        paymentPlan.setTag(paymentPlanDTO.getTag());
        paymentPlan.setFeatureJson(paymentPlanDTO.getFeatureJson());
    }
}
