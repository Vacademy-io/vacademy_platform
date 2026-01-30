package vacademy.io.admin_core_service.features.user_subscription.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.UpdatePaymentLogTrackingDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;

import java.util.Optional;

@Slf4j
@Service
public class PaymentLogTrackingService {

    @Autowired
    private PaymentLogRepository paymentLogRepository;

    /**
     * Update tracking information for a payment log
     * 
     * @param updateDTO DTO containing payment log ID and tracking fields to update
     * @return Updated PaymentLogDTO
     * @throws IllegalArgumentException if payment log not found
     */
    @Transactional
    public PaymentLogDTO updateTrackingInfo(UpdatePaymentLogTrackingDTO updateDTO) {
        log.info("Updating tracking info for payment log ID: {}", updateDTO.getPaymentLogId());

        // Find payment log
        Optional<PaymentLog> paymentLogOptional = paymentLogRepository.findById(updateDTO.getPaymentLogId());

        if (!paymentLogOptional.isPresent()) {
            log.error("Payment log not found with ID: {}", updateDTO.getPaymentLogId());
            throw new IllegalArgumentException("Payment log not found with ID: " + updateDTO.getPaymentLogId());
        }

        PaymentLog paymentLog = paymentLogOptional.get();

        // Update tracking fields (only update if provided in request)
        if (updateDTO.getTrackingId() != null) {
            paymentLog.setTrackingId(updateDTO.getTrackingId());
            log.debug("Updated tracking_id to: {}", updateDTO.getTrackingId());
        }

        if (updateDTO.getTrackingSource() != null) {
            paymentLog.setTrackingSource(updateDTO.getTrackingSource());
            log.debug("Updated tracking_source to: {}", updateDTO.getTrackingSource());
        }

        if (updateDTO.getOrderStatus() != null) {
            paymentLog.setOrderStatus(updateDTO.getOrderStatus());
            log.debug("Updated order_status to: {}", updateDTO.getOrderStatus());
        }

        // Save updated payment log
        PaymentLog savedPaymentLog = paymentLogRepository.save(paymentLog);

        log.info("Successfully updated tracking info for payment log ID: {}", updateDTO.getPaymentLogId());

        return savedPaymentLog.mapToDTO();
    }

    /**
     * Get tracking information for a payment log
     * 
     * @param paymentLogId Payment log ID
     * @return PaymentLogDTO with tracking information
     * @throws IllegalArgumentException if payment log not found
     */
    public PaymentLogDTO getTrackingInfo(String paymentLogId) {
        log.info("Fetching tracking info for payment log ID: {}", paymentLogId);

        Optional<PaymentLog> paymentLogOptional = paymentLogRepository.findById(paymentLogId);

        if (!paymentLogOptional.isPresent()) {
            log.error("Payment log not found with ID: {}", paymentLogId);
            throw new IllegalArgumentException("Payment log not found with ID: " + paymentLogId);
        }

        return paymentLogOptional.get().mapToDTO();
    }

    /**
     * Clear/Remove tracking information from a payment log
     * 
     * @param paymentLogId Payment log ID
     * @return Updated PaymentLogDTO with cleared tracking info
     * @throws IllegalArgumentException if payment log not found
     */
    @Transactional
    public PaymentLogDTO clearTrackingInfo(String paymentLogId) {
        log.info("Clearing tracking info for payment log ID: {}", paymentLogId);

        Optional<PaymentLog> paymentLogOptional = paymentLogRepository.findById(paymentLogId);

        if (!paymentLogOptional.isPresent()) {
            log.error("Payment log not found with ID: {}", paymentLogId);
            throw new IllegalArgumentException("Payment log not found with ID: " + paymentLogId);
        }

        PaymentLog paymentLog = paymentLogOptional.get();

        // Clear all tracking fields
        paymentLog.setTrackingId(null);
        paymentLog.setTrackingSource(null);
        paymentLog.setOrderStatus("ORDERED"); // Reset to default

        PaymentLog savedPaymentLog = paymentLogRepository.save(paymentLog);

        log.info("Successfully cleared tracking info for payment log ID: {}", paymentLogId);

        return savedPaymentLog.mapToDTO();
    }
}
