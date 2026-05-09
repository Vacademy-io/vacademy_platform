package vacademy.io.admin_core_service.features.credits.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client for communicating with the AI Service's credit management endpoints.
 * 
 * This client handles:
 * - Initializing credits for new institutes
 * - Checking credit balance (pre-flight)
 * - Deducting credits after AI operations
 */
@Slf4j
@Service
public class CreditClient {

    private final RestTemplate restTemplate;
    private final String aiServiceUrl;
    /**
     * Service-to-service shared secret for /credits/v1/internal/* endpoints
     * (credit pack purchase fulfillment). Empty string in dev disables the
     * Python-side check via 503 — set INTERNAL_SERVICE_TOKEN in prod.
     */
    private final String internalServiceToken;

    public CreditClient(
            RestTemplate restTemplate,
            @Value("${ai.service.url:http://localhost:8077}") String aiServiceUrl,
            @Value("${ai.service.internal-token:}") String internalServiceToken) {
        this.restTemplate = restTemplate;
        this.aiServiceUrl = aiServiceUrl;
        this.internalServiceToken = internalServiceToken;
    }

    /**
     * Initialize credits for a new institute (gives them 200 initial credits).
     * Called asynchronously when an institute is created.
     */
    @Async
    public CompletableFuture<Void> initializeCreditsAsync(String instituteId) {
        return CompletableFuture.runAsync(() -> {
            try {
                initializeCredits(instituteId);
            } catch (Exception e) {
                log.error("Failed to initialize credits for institute {}: {}", instituteId, e.getMessage());
            }
        });
    }

    /**
     * Initialize credits for a new institute (synchronous).
     */
    public void initializeCredits(String instituteId) {
        try {
            String url = aiServiceUrl + "/ai-service/credits/v1/institutes/" + instituteId + "/initialize";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> request = new HttpEntity<>("{}", headers);

            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    request,
                    (Class<Map<String, Object>>) (Class<?>) Map.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Successfully initialized credits for institute {}", instituteId);
            } else {
                log.warn("Failed to initialize credits for institute {}: {}", instituteId, response.getStatusCode());
            }
        } catch (RestClientException e) {
            log.error("Error calling credit initialization API for institute {}: {}", instituteId, e.getMessage());
        }
    }

    /**
     * Check if institute has sufficient credits for an operation.
     * 
     * @param instituteId     The institute ID
     * @param requestType     Type of request (content, image, embedding, etc.)
     * @param model           The model being used (for pricing multiplier)
     * @param estimatedTokens Estimated token count
     * @return true if sufficient credits, false otherwise
     */
    public boolean checkCredits(String instituteId, String requestType, String model, int estimatedTokens) {
        try {
            String url = aiServiceUrl + "/ai-service/credits/v1/check";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> body = Map.of(
                    "institute_id", instituteId,
                    "request_type", requestType,
                    "model", model != null ? model : "",
                    "estimated_tokens", estimatedTokens);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    request,
                    (Class<Map<String, Object>>) (Class<?>) Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Boolean hasSufficientCredits = (Boolean) response.getBody().get("has_sufficient_credits");
                return hasSufficientCredits != null && hasSufficientCredits;
            }

            // If check fails, allow the request (fail open)
            log.warn("Credit check failed for institute {}, allowing request", instituteId);
            return true;

        } catch (Exception e) {
            log.error("Error checking credits for institute {}: {}", instituteId, e.getMessage());
            // Fail open - allow the request if we can't check
            return true;
        }
    }

    /**
     * Deduct credits after an AI operation (async).
     * 
     * @param instituteId      The institute ID
     * @param requestType      Type of request (content, image, embedding, etc.)
     * @param model            The model used
     * @param promptTokens     Number of prompt tokens
     * @param completionTokens Number of completion tokens
     * @param usageLogId       Optional link to ai_token_usage record
     */
    @Async
    public CompletableFuture<Void> deductCreditsAsync(
            String instituteId,
            String requestType,
            String model,
            int promptTokens,
            int completionTokens,
            String usageLogId) {
        return CompletableFuture.runAsync(() -> {
            try {
                deductCredits(instituteId, requestType, model, promptTokens, completionTokens, usageLogId);
            } catch (Exception e) {
                log.error("Failed to deduct credits for institute {}: {}", instituteId, e.getMessage());
            }
        });
    }

    /**
     * Deduct credits after an AI operation (synchronous).
     */
    public void deductCredits(
            String instituteId,
            String requestType,
            String model,
            int promptTokens,
            int completionTokens,
            String usageLogId) {
        try {
            String url = aiServiceUrl + "/ai-service/credits/v1/deduct";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> body = Map.of(
                    "institute_id", instituteId,
                    "request_type", requestType != null ? requestType : "content",
                    "model", model != null ? model : "unknown",
                    "prompt_tokens", promptTokens,
                    "completion_tokens", completionTokens,
                    "usage_log_id", usageLogId != null ? usageLogId : "");

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    request,
                    (Class<Map<String, Object>>) (Class<?>) Map.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.debug("Successfully deducted credits for institute {}", instituteId);
            } else {
                log.warn("Failed to deduct credits for institute {}: {}", instituteId, response.getStatusCode());
            }
        } catch (RestClientException e) {
            log.error("Error deducting credits for institute {}: {}", instituteId, e.getMessage());
        }
    }

    /**
     * Get current credit balance for an institute.
     * 
     * @param instituteId The institute ID
     * @return Map with balance info, or null if failed
     */
    public Map<String, Object> getBalance(String instituteId) {
        try {
            String url = aiServiceUrl + "/ai-service/credits/v1/institutes/" + instituteId + "/balance";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> request = new HttpEntity<>(headers);

            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    request,
                    (Class<Map<String, Object>>) (Class<?>) Map.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                return response.getBody();
            }

            return null;
        } catch (Exception e) {
            log.error("Error getting balance for institute {}: {}", instituteId, e.getMessage());
            return null;
        }
    }

    /**
     * Grant credits to an institute (super admin action).
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> grantCredits(String instituteId, Double amount, String description) {
        try {
            String url = aiServiceUrl + "/ai-service/credits/v1/institutes/" + instituteId + "/grant";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> body = Map.of(
                    "amount", amount,
                    "description", description != null ? description : "Super admin grant");

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    request,
                    (Class<Map<String, Object>>) (Class<?>) Map.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Successfully granted {} credits to institute {}", amount, instituteId);
                return response.getBody();
            }

            log.warn("Failed to grant credits for institute {}: {}", instituteId, response.getStatusCode());
            return Map.of("success", false, "message", "Credit grant failed");
        } catch (RestClientException e) {
            log.error("Error granting credits for institute {}: {}", instituteId, e.getMessage());
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    /**
     * Deduct credits from an institute (super admin action).
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> deductCreditsAdmin(String instituteId, Double amount, String description) {
        try {
            String url = aiServiceUrl + "/ai-service/credits/v1/institutes/" + instituteId + "/deduct-admin";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> body = Map.of(
                    "amount", amount,
                    "description", description != null ? description : "Super admin deduction");

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    request,
                    (Class<Map<String, Object>>) (Class<?>) Map.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Successfully deducted {} credits from institute {}", amount, instituteId);
                return response.getBody();
            }

            log.warn("Failed to deduct credits for institute {}: {}", instituteId, response.getStatusCode());
            return Map.of("success", false, "message", "Credit deduction failed");
        } catch (RestClientException e) {
            log.error("Error deducting credits for institute {}: {}", instituteId, e.getMessage());
            return Map.of("success", false, "message", e.getMessage());
        }
    }
    /**
     * Check if an institute has active credits (> 0).
     * 
     * @param instituteId The institute ID
     * @return true if balance > 0, false otherwise
     */
    public boolean hasActiveCredits(String instituteId) {
        if (instituteId == null || instituteId.isBlank()) {
            return false;
        }
        
        Map<String, Object> balance = getBalance(instituteId);
        if (balance != null && balance.get("current_balance") != null) {
            Object currentBalanceObj = balance.get("current_balance");
            double currentBalance = 0;
            if (currentBalanceObj instanceof Number) {
                currentBalance = ((Number) currentBalanceObj).doubleValue();
            } else if (currentBalanceObj instanceof String) {
                try {
                    currentBalance = Double.parseDouble((String) currentBalanceObj);
                } catch (NumberFormatException e) {
                    log.error("Failed to parse current_balance string: {}", currentBalanceObj);
                }
            }
            return currentBalance > 0.0;
        }
        return false;
    }

    // ========================================================================
    // AI Credit Pack Purchase Fulfillment (called from PlatformRazorpayWebHookService
    // after a Razorpay payment.captured / refund.processed event lands)
    //
    // These hit /credits/v1/internal/* endpoints which are gated by the
    // X-Internal-Service-Token header (NOT by JWT/ROOT_ADMIN). Idempotency
    // is handled on the Python side via the V243 partial UNIQUE index on
    // credit_transactions.external_reference_id.
    // ========================================================================

    /**
     * Grant credits to fulfill a successful Razorpay credit-pack payment.
     *
     * @param instituteId          buyer
     * @param credits              amount granted
     * @param razorpayPaymentId    Razorpay payment_id — used as the dedup key on
     *                             credit_transactions.external_reference_id
     * @param platformPaymentId    our platform_payment.id — populated on
     *                             credit_transactions.reference_id for reverse lookup
     * @param packCode             pack code snapshot (for the description), nullable
     * @return parsed AI-service response, or {@code {success: false, message: ...}}
     *         on error. Caller decides whether to retry via webhook reprocess.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> grantFromPayment(
            String instituteId,
            BigDecimal credits,
            String razorpayPaymentId,
            String platformPaymentId,
            String packCode) {
        try {
            String url = aiServiceUrl + "/ai-service/credits/v1/internal/grant-from-payment";

            HttpHeaders headers = buildInternalHeaders();

            Map<String, Object> body = new HashMap<>();
            body.put("institute_id", instituteId);
            body.put("amount", credits);
            body.put("external_reference_id", razorpayPaymentId);
            body.put("platform_payment_id", platformPaymentId);
            body.put("pack_code", packCode);
            body.put("description", "Credit pack purchase via Razorpay (" + (packCode != null ? packCode : "?") + ")");

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url, HttpMethod.POST, request,
                    (Class<Map<String, Object>>) (Class<?>) Map.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                Map<String, Object> respBody = response.getBody();
                Boolean already = respBody == null ? null : (Boolean) respBody.get("already_processed");
                log.info("Granted {} credits to institute {} (razorpay_payment_id={}, already_processed={})",
                        credits, instituteId, razorpayPaymentId, already);
                return respBody;
            }
            log.warn("grantFromPayment returned non-2xx for institute {}: {}",
                    instituteId, response.getStatusCode());
            return Map.of("success", false, "message", "AI service returned " + response.getStatusCode());

        } catch (RestClientException e) {
            log.error("grantFromPayment failed for institute {} payment_id {}: {}",
                    instituteId, razorpayPaymentId, e.getMessage());
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    /**
     * Reverse a credit pack purchase (full or partial refund).
     *
     * @param instituteId          buyer
     * @param creditsToRefund      amount to deduct (can pro-rate for partial refund)
     * @param razorpayRefundId     Razorpay refund_id — dedup key (distinct from
     *                             the original payment_id, so it won't collide
     *                             with the PURCHASE row in the unique index)
     * @param platformPaymentId    our platform_payment.id
     * @param packCode             pack code snapshot
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> refundFromPayment(
            String instituteId,
            BigDecimal creditsToRefund,
            String razorpayRefundId,
            String platformPaymentId,
            String packCode) {
        try {
            String url = aiServiceUrl + "/ai-service/credits/v1/internal/refund-from-payment";

            HttpHeaders headers = buildInternalHeaders();

            Map<String, Object> body = new HashMap<>();
            body.put("institute_id", instituteId);
            body.put("amount", creditsToRefund);
            body.put("external_reference_id", razorpayRefundId);
            body.put("platform_payment_id", platformPaymentId);
            body.put("pack_code", packCode);
            body.put("description", "Refund for credit pack (" + (packCode != null ? packCode : "?") + ")");

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url, HttpMethod.POST, request,
                    (Class<Map<String, Object>>) (Class<?>) Map.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Refunded {} credits from institute {} (razorpay_refund_id={})",
                        creditsToRefund, instituteId, razorpayRefundId);
                return response.getBody();
            }
            log.warn("refundFromPayment returned non-2xx for institute {}: {}",
                    instituteId, response.getStatusCode());
            return Map.of("success", false, "message", "AI service returned " + response.getStatusCode());

        } catch (RestClientException e) {
            log.error("refundFromPayment failed for institute {} refund_id {}: {}",
                    instituteId, razorpayRefundId, e.getMessage());
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    private HttpHeaders buildInternalHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        // Always send the header — Python side returns 401 if missing/wrong, or
        // 503 if the server itself doesn't have INTERNAL_SERVICE_TOKEN configured.
        headers.set("X-Internal-Service-Token", internalServiceToken == null ? "" : internalServiceToken);
        return headers;
    }
}
