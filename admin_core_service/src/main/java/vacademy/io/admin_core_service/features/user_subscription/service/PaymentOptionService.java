package vacademy.io.admin_core_service.features.user_subscription.service;

import org.checkerframework.checker.units.qual.A;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentOptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentOptionFilterDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentOptionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Optional;

@Service
public class PaymentOptionService {

    @Autowired
    private PaymentOptionRepository paymentOptionRepository;


    public boolean savePaymentOption(PaymentOptionDTO paymentOptionDTO){
        PaymentOption paymentOption = new PaymentOption(paymentOptionDTO);
        paymentOptionRepository.save(paymentOption);
        return true;
    }

    public List<PaymentOptionDTO> getPaymentOptions(PaymentOptionFilterDTO paymentOptionFilterDTO, CustomUserDetails userDetails){
        List<PaymentOption>paymentOptions = paymentOptionRepository.findPaymentOptionsWithPaymentPlansNative(
                paymentOptionFilterDTO.getTypes(),
                paymentOptionFilterDTO.getSource(),
                paymentOptionFilterDTO.getSourceId(),
                List.of(StatusEnum.ACTIVE.name()),
                List.of(StatusEnum.ACTIVE.name()),
                paymentOptionFilterDTO.isRequireApproval(),
                paymentOptionFilterDTO.isNotRequireApproval()
                );
        return paymentOptions.stream().map(PaymentOption::mapToPaymentOptionDTO).toList();
    }

    public Optional<PaymentOption> getPaymentOption(String source, String sourceId,String tag,List<String>statuses){
        return paymentOptionRepository.findTopByFiltersWithPlans(source,sourceId,tag,statuses,statuses);
    }

    public PaymentOption findById(String id){
        return paymentOptionRepository.findById(id).orElseThrow(()->new VacademyException("Payment Option not found"));
    }
}
