package vacademy.io.admin_core_service.features.user_subscription.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.UpdatePaymentLogTrackingDTO;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogTrackingService;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/v1/payment-log-tracking")
@Tag(name = "Payment Log Tracking", description = "APIs for managing payment log tracking information (Admin Only)")
public class PaymentLogTrackingController {

    @Autowired
    private PaymentLogTrackingService paymentLogTrackingService;

    /**
     * Update tracking information for a payment log
     * 
     * Endpoint: PUT /admin-core-service/v1/payment-log-tracking/update
     * 
     * Request Body:
     * {
     * "payment_log_id": "payment-log-123",
     * "tracking_id": "TRACK-12345",
     * "tracking_source": "FedEx",
     * "order_status": "SHIPPED"
     * }
     * 
     * @param updateDTO DTO containing tracking information
     * @return Updated payment log with tracking info
     */
    @PutMapping("/update")
    @Operation(summary = "Update tracking information", description = "Update tracking_id, tracking_source, and order_status for a payment log. All fields are optional - only provided fields will be updated.")
    public ResponseEntity<?> updateTrackingInfo(@Valid @RequestBody UpdatePaymentLogTrackingDTO updateDTO) {
        try {
            log.info("Received request to update tracking info for payment log: {}", updateDTO.getPaymentLogId());

            PaymentLogDTO updatedPaymentLog = paymentLogTrackingService.updateTrackingInfo(updateDTO);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Tracking information updated successfully");
            response.put("data", updatedPaymentLog);

            return ResponseEntity.ok(response);

        } catch (IllegalArgumentException e) {
            log.error("Payment log not found: {}", e.getMessage());

            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());

            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);

        } catch (Exception e) {
            log.error("Error updating tracking info", e);

            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Failed to update tracking information: " + e.getMessage());

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Get tracking information for a payment log
     * 
     * Endpoint: GET /admin-core-service/v1/payment-log-tracking/{paymentLogId}
     * 
     * @param paymentLogId Payment log ID
     * @return Payment log with tracking information
     */
    @GetMapping("/{paymentLogId}")
    @Operation(summary = "Get tracking information", description = "Retrieve tracking information for a specific payment log")
    public ResponseEntity<?> getTrackingInfo(@PathVariable String paymentLogId) {
        try {
            log.info("Received request to get tracking info for payment log: {}", paymentLogId);

            PaymentLogDTO paymentLog = paymentLogTrackingService.getTrackingInfo(paymentLogId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", paymentLog);

            return ResponseEntity.ok(response);

        } catch (IllegalArgumentException e) {
            log.error("Payment log not found: {}", e.getMessage());

            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());

            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);

        } catch (Exception e) {
            log.error("Error fetching tracking info", e);

            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Failed to fetch tracking information: " + e.getMessage());

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Clear/Remove tracking information from a payment log
     * 
     * Endpoint: DELETE /admin-core-service/v1/payment-log-tracking/{paymentLogId}
     * 
     * @param paymentLogId Payment log ID
     * @return Payment log with cleared tracking info
     */
    @DeleteMapping("/{paymentLogId}")
    @Operation(summary = "Clear tracking information", description = "Remove all tracking information from a payment log and reset order_status to ORDERED")
    public ResponseEntity<?> clearTrackingInfo(@PathVariable String paymentLogId) {
        try {
            log.info("Received request to clear tracking info for payment log: {}", paymentLogId);

            PaymentLogDTO paymentLog = paymentLogTrackingService.clearTrackingInfo(paymentLogId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Tracking information cleared successfully");
            response.put("data", paymentLog);

            return ResponseEntity.ok(response);

        } catch (IllegalArgumentException e) {
            log.error("Payment log not found: {}", e.getMessage());

            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage());

            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);

        } catch (Exception e) {
            log.error("Error clearing tracking info", e);

            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Failed to clear tracking information: " + e.getMessage());

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * Batch update tracking information for multiple payment logs
     * 
     * Endpoint: PUT /admin-core-service/v1/payment-log-tracking/batch-update
     * 
     * Request Body:
     * {
     * "updates": [
     * {
     * "payment_log_id": "payment-log-123",
     * "tracking_id": "TRACK-12345",
     * "order_status": "SHIPPED"
     * },
     * {
     * "payment_log_id": "payment-log-456",
     * "tracking_id": "TRACK-67890",
     * "order_status": "DELIVERED"
     * }
     * ]
     * }
     * 
     * @param updates List of tracking updates
     * @return Results of batch update
     */
    @PutMapping("/batch-update")
    @Operation(summary = "Batch update tracking information", description = "Update tracking information for multiple payment logs in a single request")
    public ResponseEntity<?> batchUpdateTrackingInfo(@RequestBody Map<String, Object> request) {
        try {
            log.info("Received batch update request for tracking info");

            @SuppressWarnings("unchecked")
            java.util.List<Map<String, String>> updates = (java.util.List<Map<String, String>>) request.get("updates");

            if (updates == null || updates.isEmpty()) {
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("success", false);
                errorResponse.put("message", "No updates provided");
                return ResponseEntity.badRequest().body(errorResponse);
            }

            java.util.List<PaymentLogDTO> updatedLogs = new java.util.ArrayList<>();
            java.util.List<String> errors = new java.util.ArrayList<>();

            for (Map<String, String> update : updates) {
                try {
                    UpdatePaymentLogTrackingDTO updateDTO = new UpdatePaymentLogTrackingDTO();
                    updateDTO.setPaymentLogId(update.get("payment_log_id"));
                    updateDTO.setTrackingId(update.get("tracking_id"));
                    updateDTO.setTrackingSource(update.get("tracking_source"));
                    updateDTO.setOrderStatus(update.get("order_status"));

                    PaymentLogDTO updated = paymentLogTrackingService.updateTrackingInfo(updateDTO);
                    updatedLogs.add(updated);

                } catch (Exception e) {
                    errors.add("Failed to update " + update.get("payment_log_id") + ": " + e.getMessage());
                }
            }

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Batch update completed");
            response.put("updated_count", updatedLogs.size());
            response.put("error_count", errors.size());
            response.put("updated_logs", updatedLogs);
            response.put("errors", errors);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error in batch update", e);

            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Batch update failed: " + e.getMessage());

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }
}
