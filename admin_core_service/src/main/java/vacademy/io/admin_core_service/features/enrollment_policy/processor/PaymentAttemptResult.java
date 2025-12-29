package vacademy.io.admin_core_service.features.enrollment_policy.processor;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

/**
 * Helper class to store payment attempt results in ThreadLocal cache.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
class PaymentAttemptResult {
    boolean attempted;
    boolean successful;
    PaymentResponseDTO response;
}
