package vacademy.io.admin_core_service.features.user_subscription.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentLogStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;

import java.util.Date;

@Service
public class PaymentLogService {

    @Autowired
    private PaymentLogRepository paymentLogRepository;

    public String createPaymentLog(String userId, double paymentAmount, String vendor, String vendorId, String currency, UserPlan userPlan){
        PaymentLog paymentLog = new PaymentLog();
        paymentLog.setStatus(PaymentLogStatusEnum.INITIATED.name());
        paymentLog.setPaymentAmount(paymentAmount);
        paymentLog.setUserId(userId);
        paymentLog.setPaymentStatus(null); // not yet payment process initiated
        paymentLog.setVendor(vendor);
        paymentLog.setVendorId(vendorId);
        paymentLog.setDate(new Date());
        paymentLog.setCurrency(currency);
        paymentLog.setUserPlan(userPlan);
        return savePaymentLog(paymentLog).getId();
    }

    private PaymentLog savePaymentLog(PaymentLog paymentLog) {
       return paymentLogRepository.save(paymentLog);
    }

    public void updatePaymentLog(String paymentLogId,String status,String paymentStatus,String paymentSpecificData){
        PaymentLog paymentLog = paymentLogRepository.findById(paymentLogId).get();
        paymentLog.setStatus(status);
        paymentLog.setPaymentStatus(paymentStatus);
        paymentLog.setPaymentSpecificData(paymentSpecificData);
        paymentLogRepository.save(paymentLog);
    }
    
    // to do: Red marked as there we need to process so many things

    public void updatePaymentLog(String paymentLogId,String paymentStatus){
        PaymentLog paymentLog = paymentLogRepository.findById(paymentLogId).get();
        paymentLog.setPaymentStatus(paymentStatus);
        paymentLogRepository.save(paymentLog);
    }
}
