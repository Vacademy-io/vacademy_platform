package vacademy.io.admin_core_service.features.user_subscription.service;

import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentLogStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import java.util.Date;

@Service
public class PaymentLogService {

    private static final Logger logger = LoggerFactory.getLogger(PaymentLogService.class);

    @Autowired
    private PaymentLogRepository paymentLogRepository;

    @Autowired
    public UserPlanService userPlanService;

    public String createPaymentLog(String userId, double paymentAmount, String vendor, String vendorId, String currency, UserPlan userPlan) {
        logger.info("Creating payment log for userId={}, amount={}, vendor={}, currency={}", userId, paymentAmount, vendor, currency);

        PaymentLog paymentLog = new PaymentLog();
        paymentLog.setStatus(PaymentLogStatusEnum.INITIATED.name());
        paymentLog.setPaymentAmount(paymentAmount);
        paymentLog.setUserId(userId);
        paymentLog.setPaymentStatus(null);
        paymentLog.setVendor(vendor);
        paymentLog.setVendorId(vendorId);
        paymentLog.setDate(new Date());
        paymentLog.setCurrency(currency);
        paymentLog.setUserPlan(userPlan);

        PaymentLog savedLog = savePaymentLog(paymentLog);

        logger.info("Payment log created with ID={}", savedLog.getId());

        return savedLog.getId();
    }

    private PaymentLog savePaymentLog(PaymentLog paymentLog) {
        logger.debug("Saving payment log: {}", paymentLog);
        return paymentLogRepository.save(paymentLog);
    }

    public void updatePaymentLog(String paymentLogId, String status, String paymentStatus, String paymentSpecificData) {
        logger.info("Updating payment log: id={}, status={}, paymentStatus={}", paymentLogId, status, paymentStatus);

        PaymentLog paymentLog = paymentLogRepository.findById(paymentLogId).orElseThrow(() -> {
            logger.error("Payment log not found with ID: {}", paymentLogId);
            return new RuntimeException("Payment log not found with ID: " + paymentLogId);
        });

        paymentLog.setStatus(status);
        paymentLog.setPaymentStatus(paymentStatus);
        paymentLog.setPaymentSpecificData(paymentSpecificData);

        paymentLogRepository.save(paymentLog);

        logger.debug("Payment log updated successfully for ID={}", paymentLogId);
    }

    @Transactional
    public void updatePaymentLog(String paymentLogId, String paymentStatus) {
        logger.info("Transactional update of payment log ID={}, setting paymentStatus={}", paymentLogId, paymentStatus);

        PaymentLog paymentLog = paymentLogRepository.findById(paymentLogId).orElseThrow(() -> {
            logger.error("Payment log not found for transactional update: ID={}", paymentLogId);
            return new RuntimeException("Payment log not found with ID: " + paymentLogId);
        });

        paymentLog.setPaymentStatus(paymentStatus);
        paymentLogRepository.save(paymentLog);

        logger.info("Payment log saved with new paymentStatus. ID={}", paymentLogId);

        if (PaymentStatusEnum.PAID.name().equals(paymentStatus)) {
            logger.info("Payment marked as PAID, triggering applyOperationsOnFirstPayment for userPlan ID={}", paymentLog.getUserPlan().getId());
            userPlanService.applyOperationsOnFirstPayment(paymentLog.getUserPlan());
        }
    }

    public PaymentLogDTO getPaymentLog(String paymentLogId) {
        PaymentLog paymentLog = paymentLogRepository.findById(paymentLogId).orElseThrow(() -> new RuntimeException("Payment log not found with ID: " + paymentLogId));
        return paymentLog.mapToDTO();
    }
}
