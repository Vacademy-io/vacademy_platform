package vacademy.io.admin_core_service.features.payments.manager;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.CashfreeRequestDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import java.util.HashMap;
import java.util.Map;

/**
 * Cashfree payment implementation that follows the same high-level pattern
 * as {@link StripePaymentManager} and {@link PhonePePaymentManager}.
 *
 * Flow:
 *  1. Create an order in Cashfree using the internal PaymentLog ID as order_id.
 *  2. Return a PaymentResponseDTO containing identifiers needed by the frontend
 *     to launch the Cashfree hosted checkout (paymentSessionId, cfOrderId, etc.).
 *  3. Final payment status is confirmed via Cashfree webhook, which updates
 *     PaymentLog entries (see CashfreeWebHookService).
 */
@Slf4j
@Service
public class CashfreePaymentManager implements PaymentServiceStrategy {

    private static final String CASHFREE_PRODUCTION_API_BASE = "https://api.cashfree.com/pg";
    private static final String CASHFREE_SANDBOX_API_BASE = "https://sandbox.cashfree.com/pg";

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    /**
     * Base URL of this backend (admin-core-service) for webhook callbacks. Must be
     * reachable by Cashfree. Production/Stage: https://backend-stage.vacademy.io (or
     * your prod URL). Local dev: use ngrok URL or set in env.
     */
    @Value("${payment.webhook.baseurl:https://backend-stage.vacademy.io}")
    private String paymentWebhookBaseUrl;

    @Value("${payment.cashfree.default-return-url:https://vacademy.io}")
    private String defaultReturnUrl;

    /**
     * Cashfree environment mode for backend API calls.
     * Must match frontend checkout mode (sandbox vs production) otherwise checkout will fail with:
     * "payment_session_id is not present or is invalid".
     *
     * Allowed values: sandbox, production
     */
    @Value("${payment.cashfree.mode:production}")
    private String cashfreeMode;

    public CashfreePaymentManager(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.build();
        this.objectMapper = objectMapper;
    }

    @Override
    public PaymentResponseDTO initiatePayment(UserDTO user,
                                              PaymentInitiationRequestDTO request,
                                              Map<String, Object> paymentGatewaySpecificData) {
        log.info("Initiating Cashfree payment for order: {}", request.getOrderId());

        try {
            String appId = (String) paymentGatewaySpecificData.get("clientId");
            String secretKey = (String) paymentGatewaySpecificData.get("clientSecret");
            String baseUrl = (String) paymentGatewaySpecificData.get("baseUrl");
            // NOTE: Frontend chooses sandbox vs production. Backend must create payment sessions in the same mode.
            // If institute config does not provide baseUrl, fall back based on payment.cashfree.mode.
            if (!StringUtils.hasText(baseUrl)) {
                String mode = StringUtils.hasText(cashfreeMode) ? cashfreeMode.trim().toLowerCase() : "production";
                baseUrl = "sandbox".equals(mode) ? CASHFREE_SANDBOX_API_BASE : CASHFREE_PRODUCTION_API_BASE;
                log.warn("Cashfree baseUrl missing in institute config; falling back to {} mode baseUrl={}", mode, baseUrl);
            }

            if (!StringUtils.hasText(appId) || !StringUtils.hasText(secretKey)) {
                throw new VacademyException("Cashfree clientId or clientSecret is missing in configuration.");
            }

            if (request.getAmount() == null || request.getAmount() <= 0) {
                throw new VacademyException("Cashfree payment amount must be greater than zero.");
            }
            if (!StringUtils.hasText(request.getCurrency())) {
                throw new VacademyException("Cashfree currency must be specified.");
            }
            if (!StringUtils.hasText(request.getOrderId())) {
                throw new VacademyException("Cashfree requires a non-null orderId (PaymentLog ID).");
            }

            // Build order payload
            Map<String, Object> orderPayload = buildOrderPayload(user, request);
            String url = baseUrl + "/orders";

            log.info("Calling Cashfree create order API: {}", url);
            log.debug("Cashfree order payload: {}", safeToJson(orderPayload));

            CashfreeOrderResponse cfResponse = webClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("x-client-id", appId)
                    .header("x-client-secret", secretKey)
                    .header("x-api-version", "2025-01-01")
                    .bodyValue(orderPayload)
                    .retrieve()
                    .bodyToMono(CashfreeOrderResponse.class)
                    .onErrorResume(WebClientResponseException.class, ex -> {
                        log.error("Cashfree API error. Status: {}, Body: {}", ex.getStatusCode(), ex.getResponseBodyAsString());
                        return Mono.error(new VacademyException("Cashfree API error: " + ex.getResponseBodyAsString()));
                    })
                    .block();

            if (cfResponse == null || !StringUtils.hasText(cfResponse.getOrderId())) {
                throw new VacademyException("Empty or invalid response from Cashfree create order API.");
            }

            // payment_session_id is mandatory for frontend checkout
            if (!StringUtils.hasText(cfResponse.getPaymentSessionId())) {
                log.error("Cashfree create order returned empty payment_session_id. apiUrl={}, mode={}, response={}",
                        url, cashfreeMode, safeToJson(cfResponse));
                throw new VacademyException("Cashfree API did not return payment_session_id. " +
                        "Ensure backend Cashfree mode (sandbox/production) matches frontend checkout mode and credentials.");
            }

            log.info("Cashfree order created successfully. cf_order_id={}, order_id={}, payment_session_id={}, apiUrl={}, mode={}",
                    cfResponse.getCfOrderId(), cfResponse.getOrderId(), cfResponse.getPaymentSessionId(), url, cashfreeMode);

            return buildPaymentResponse(cfResponse, request);

        } catch (VacademyException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error initiating Cashfree payment", e);
            throw new VacademyException("Error initiating Cashfree payment: " + e.getMessage());
        }
    }

    private Map<String, Object> buildOrderPayload(UserDTO user, PaymentInitiationRequestDTO request) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("order_id", request.getOrderId());
        payload.put("order_amount", request.getAmount());
        payload.put("order_currency", request.getCurrency());

        // Customer details
        Map<String, Object> customer = new HashMap<>();
        String email = request.getEmail();
        if (!StringUtils.hasText(email) && user != null) {
            email = user.getEmail();
        }
        if (StringUtils.hasText(email)) {
            customer.put("customer_email", email);
        }

        String phone = user != null ? user.getMobileNumber() : null;
        if (StringUtils.hasText(phone)) {
            customer.put("customer_phone", phone);
        }

        String customerId = user != null ? user.getId() : request.getOrderId();
        customer.put("customer_id", customerId);

        payload.put("customer_details", customer);

        // Order meta
        CashfreeRequestDTO cfRequest = request.getCashfreeRequest();
        String returnUrl = cfRequest != null ? cfRequest.getReturnUrl() : null;
        if (!StringUtils.hasText(returnUrl)) {
            returnUrl = StringUtils.hasText(defaultReturnUrl) ? defaultReturnUrl : "https://vacademy.io";
        }

        String notifyUrl = cfRequest != null ? cfRequest.getNotifyUrl() : null;
        if (!StringUtils.hasText(notifyUrl) && StringUtils.hasText(request.getInstituteId())) {
            notifyUrl = constructWebhookCallbackUrl(request.getInstituteId());
        }

        Map<String, Object> orderMeta = new HashMap<>();
        // Cashfree will redirect to this URL after payment, appending order_id etc.
        orderMeta.put("return_url", returnUrl);
        if (StringUtils.hasText(notifyUrl)) {
            orderMeta.put("notify_url", notifyUrl);
        }

        payload.put("order_meta", orderMeta);

        // Optional: tags can carry instituteId for easier webhook resolution
        if (StringUtils.hasText(request.getInstituteId())) {
            Map<String, Object> orderTags = new HashMap<>();
            orderTags.put("instituteId", request.getInstituteId());
            payload.put("order_tags", orderTags);
        }

        return payload;
    }

    private String constructWebhookCallbackUrl(String instituteId) {
        String baseUrl = StringUtils.hasText(paymentWebhookBaseUrl) ? paymentWebhookBaseUrl : "https://backend-stage.vacademy.io";
        String webhookUrl = baseUrl.trim().replaceAll("/$", "") + "/admin-core-service/payments/webhook/callback/cashfree?instituteId=" + instituteId;
        log.info("Cashfree notify (webhook) URL being sent: {}", webhookUrl);
        return webhookUrl;
    }

    private PaymentResponseDTO buildPaymentResponse(CashfreeOrderResponse cfResponse,
                                                    PaymentInitiationRequestDTO request) {
        Map<String, Object> responseData = new HashMap<>();
        String cfOrderId = cfResponse.getCfOrderId();
        String orderId = cfResponse.getOrderId();
        String paymentSessionId = cfResponse.getPaymentSessionId();
        String orderStatus = cfResponse.getOrderStatus();

        // camelCase keys (used across the backend)
        responseData.put("cfOrderId", cfOrderId);
        responseData.put("orderId", orderId);
        responseData.put("paymentSessionId", paymentSessionId);
        responseData.put("status", orderStatus);

        // snake_case keys (frontend reads both camelCase and snake_case)
        responseData.put("cf_order_id", cfOrderId);
        responseData.put("order_id", orderId);
        responseData.put("payment_session_id", paymentSessionId);
        responseData.put("order_status", orderStatus);

        // Typically, order_status will be "ACTIVE" until payment completes.
        PaymentStatusEnum paymentStatus = PaymentStatusEnum.PAYMENT_PENDING;
        if ("PAID".equalsIgnoreCase(orderStatus) || "SUCCESS".equalsIgnoreCase(orderStatus)) {
            paymentStatus = PaymentStatusEnum.PAID;
        } else if ("FAILED".equalsIgnoreCase(orderStatus) || "CANCELLED".equalsIgnoreCase(orderStatus)) {
            paymentStatus = PaymentStatusEnum.FAILED;
        }
        responseData.put("paymentStatus", paymentStatus.name());
        responseData.put("payment_status", paymentStatus.name());

        PaymentResponseDTO dto = new PaymentResponseDTO();
        dto.setOrderId(request.getOrderId());
        dto.setResponseData(responseData);
        dto.setMessage("Cashfree order created");

        log.debug("Built Cashfree payment response: {}", safeToJson(dto));
        return dto;
    }

    private String safeToJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return String.valueOf(obj);
        }
    }

    @Override
    public Map<String, Object> createCustomer(UserDTO user,
                                              PaymentInitiationRequestDTO request,
                                              Map<String, Object> paymentGatewaySpecificData) {
        // For basic Cashfree hosted checkout, explicit customer creation is not required.
        // We still return a minimal map for consistency with other gateways.
        Map<String, Object> response = new HashMap<>();
        if (user != null) {
            response.put("customerId", user.getId());
            response.put("email", user.getEmail());
            response.put("contact", user.getMobileNumber());
        }
        return response;
    }

    @Override
    public Map<String, Object> createCustomerForUnknownUser(String email,
                                                            PaymentInitiationRequestDTO request,
                                                            Map<String, Object> paymentGatewaySpecificData) {
        Map<String, Object> response = new HashMap<>();
        response.put("customerId", "anon_" + System.currentTimeMillis());
        response.put("email", email);
        return response;
    }

    @Override
    public Map<String, Object> findCustomerByEmail(String email,
                                                   Map<String, Object> paymentGatewaySpecificData) {
        // No direct Cashfree customer lookup implemented for now.
        return null;
    }

    /**
     * Minimal response DTO for Cashfree create order API.
     * Fields and names are based on current Cashfree PG documentation and can be
     * extended if you need more data from the response.
     */
    public static class CashfreeOrderResponse {
        @JsonProperty("cf_order_id")
        private String cfOrderId;
        @JsonProperty("order_id")
        private String orderId;
        @JsonProperty("payment_session_id")
        private String paymentSessionId;
        @JsonProperty("order_status")
        private String orderStatus;

        public String getCfOrderId() {
            return cfOrderId;
        }

        public void setCfOrderId(String cfOrderId) {
            this.cfOrderId = cfOrderId;
        }

        public String getOrderId() {
            return orderId;
        }

        public void setOrderId(String orderId) {
            this.orderId = orderId;
        }

        public String getPaymentSessionId() {
            return paymentSessionId;
        }

        public void setPaymentSessionId(String paymentSessionId) {
            this.paymentSessionId = paymentSessionId;
        }

        public String getOrderStatus() {
            return orderStatus;
        }

        public void setOrderStatus(String orderStatus) {
            this.orderStatus = orderStatus;
        }
    }
}

