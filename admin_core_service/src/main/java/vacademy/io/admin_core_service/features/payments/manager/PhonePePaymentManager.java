package vacademy.io.admin_core_service.features.payments.manager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.*;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class PhonePePaymentManager implements PaymentServiceStrategy {

    private static final Logger logger = LoggerFactory.getLogger(PhonePePaymentManager.class);
    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public PhonePePaymentManager(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.build();
        this.objectMapper = objectMapper;
    }

    @Override
    public PaymentResponseDTO initiatePayment(UserDTO user, PaymentInitiationRequestDTO request,
            Map<String, Object> paymentGatewaySpecificData) {
        logger.info("Initiating PhonePe Standard Checkout payment for order: {}", request.getOrderId());

        try {
            // Extract Credentials
            String merchantId = (String) paymentGatewaySpecificData.get("clientId");
            String saltKey = (String) paymentGatewaySpecificData.get("clientSecret");
            String baseUrl = (String) paymentGatewaySpecificData.get("baseUrl");

            if (!StringUtils.hasText(baseUrl)) {
                // Fallback for potential legacy config, though we should enforce use of
                // 'baseUrl'
                baseUrl = (String) paymentGatewaySpecificData.getOrDefault("authBaseUrl",
                        paymentGatewaySpecificData.get("payBaseUrl"));
            }

            if (!StringUtils.hasText(merchantId) || !StringUtils.hasText(saltKey) || !StringUtils.hasText(baseUrl)) {
                throw new VacademyException("PhonePe Merchant ID, Salt Key, or Base URL is missing.");
            }

            // Sanitize inputs
            merchantId = merchantId.trim();
            saltKey = saltKey.trim();
            baseUrl = baseUrl.trim();

            // Warn if using Production ID in Sandbox
            if (baseUrl.contains("sandbox") && !merchantId.equalsIgnoreCase("PGTESTPAYUAT")) {
                logger.warn("MISMATCH WARNING: You are using a custom Merchant ID ({}) with the Sandbox URL. " +
                        "Sandbox only supports 'PGTESTPAYUAT'. This will likely fail with KEY_NOT_CONFIGURED.",
                        merchantId);
            }

            // Parse Salt Key and Index for logging
            String key = saltKey;
            String index = "1";
            if (saltKey.contains("###")) {
                String[] parts = saltKey.split("###");
                key = parts[0];
                index = parts.length > 1 ? parts[1] : "1";
            }

            logger.info("PhonePe Config - MerchantId: {}, BaseUrl: {}, SaltIndex: {}", merchantId, baseUrl, index);
            logger.info("PhonePe Config - SaltKey (Masked): {}...",
                    key.length() > 4 ? key.substring(key.length() - 4) : "****");

            // Step 1: Build the Request DTO
            PhonePePaymentRequestDTO payloadDTO = buildPaymentRequest(user, request, merchantId);

            // Step 2: Serialize to JSON and Base64 Encode
            String payloadJson = objectMapper.writeValueAsString(payloadDTO);
            logger.info("PhonePe Request Payload: {}", payloadJson);
            String base64Payload = Base64.getEncoder().encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));

            // Step 3: Calculate X-VERIFY Checksum
            String apiEndpoint = "/pg/v1/pay";
            String checksum = calculateChecksum(base64Payload, apiEndpoint, saltKey);

            // Step 4: Make API Call
            PhonePeResponseWrapperDTO<PhonePePaymentResponseDTO> response = makePaymentRequest(baseUrl, apiEndpoint,
                    base64Payload, checksum);

            // Step 5: Handle Response
            if (response == null || !response.isSuccess() || response.getData() == null) {
                String errorMsg = response != null ? response.getMessage() : "Empty response from PhonePe";
                logger.error("PhonePe payment initiation failed: {}", errorMsg);
                throw new VacademyException("PhonePe payment initiation failed: " + errorMsg);
            }

            return buildPaymentResponse(response.getData(), request);

        } catch (org.springframework.web.reactive.function.client.WebClientResponseException e) {
            String responseBody = e.getResponseBodyAsString();
            logger.error("PhonePe API error. Status: {}, Body: {}", e.getStatusCode(), responseBody);
            throw new VacademyException("PhonePe API error: " + responseBody);
        } catch (JsonProcessingException e) {
            logger.error("Error serializing PhonePe request", e);
            throw new VacademyException("Error creating payment request: " + e.getMessage());
        } catch (Exception e) {
            logger.error("Error initiating PhonePe payment", e);
            throw new VacademyException("Error initiating PhonePe payment: " + e.getMessage());
        }
    }

    private PhonePePaymentRequestDTO buildPaymentRequest(UserDTO user, PaymentInitiationRequestDTO request,
            String merchantId) {
        long amountInPaise = Math.round(request.getAmount() * 100);

        PhonePeRequestDTO phonePeRequest = request.getPhonePeRequest();
        String redirectUrl = phonePeRequest != null ? phonePeRequest.getRedirectUrl() : "";

        // CRITICAL FIX: callbackUrl must be the BACKEND webhook endpoint, not frontend
        // URL
        // PhonePe will POST to this URL when payment completes/fails
        // Format:
        // https://backend-stage.vacademy.io/admin-core-service/payments/webhook/callback/phonepe
        String callbackUrl = request.getInstituteId() != null
                ? constructWebhookCallbackUrl(request.getInstituteId())
                : redirectUrl; // Fallback to redirectUrl if instituteId is missing

        logger.info("PhonePe Payment Request - RedirectUrl (frontend): {}", redirectUrl);
        logger.info("PhonePe Payment Request - CallbackUrl (webhook): {}", callbackUrl);

        return PhonePePaymentRequestDTO.builder()
                .merchantId(merchantId)
                .merchantTransactionId(request.getOrderId()) // Utilizing orderId as transaction Id
                .merchantUserId("USER_" + user.getId()) // Unique user ID
                .amount(amountInPaise)
                .redirectUrl(redirectUrl) // Where user goes after payment (frontend)
                .redirectMode("REDIRECT") // Standard mode
                .callbackUrl(callbackUrl) // Where PhonePe POSTs webhook (backend)
                .mobileNumber(user.getMobileNumber()) // Pass mobile number if available
                .paymentInstrument(PhonePePaymentRequestDTO.PaymentInstrument.builder()
                        .type("PAY_PAGE")
                        .build())
                .build();
    }

    /**
     * Constructs the webhook callback URL for PhonePe
     * This is where PhonePe will POST payment status updates
     */
    private String constructWebhookCallbackUrl(String instituteId) {
        // Use the same base URL pattern as auth-service
        // In production/stage: https://backend-stage.vacademy.io
        // In local dev: http://localhost:8072
        String baseUrl = System.getenv("AUTH_SERVER_BASE_URL");

        if (baseUrl == null || baseUrl.isEmpty()) {
            // Fallback for local development
            baseUrl = "http://localhost:8072";
            logger.warn("AUTH_SERVER_BASE_URL not set, using fallback: {}", baseUrl);
        }

        // Construct webhook URL
        // Format:
        // {baseUrl}/admin-core-service/payments/webhook/callback/phonepe?instituteId={instituteId}
        String webhookUrl = baseUrl + "/admin-core-service/payments/webhook/callback/phonepe?instituteId="
                + instituteId;

        logger.info("Constructed PhonePe webhook callback URL: {}", webhookUrl);

        return webhookUrl;
    }

    private String calculateChecksum(String base64Payload, String endpoint, String saltKey) {
        try {
            // Format: Base64(Payload) + "/pg/v1/pay" + SaltKey + "###" + SaltIndex
            // Assuming SaltIndex is 1, which is standard. If key mapping has it, we should
            // split it.
            // Usually saltKey provided in dashboard is just the key, index is 1.
            // Often format is: KEY###INDEX. Let's handle both.

            String key = saltKey;
            String index = "1";

            if (saltKey.contains("###")) {
                String[] parts = saltKey.split("###");
                key = parts[0];
                index = parts.length > 1 ? parts[1] : "1";
            }

            String dataToHash = base64Payload + endpoint + key;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedHash = digest.digest(dataToHash.getBytes(StandardCharsets.UTF_8));

            // Convert to Hex
            StringBuilder hexString = new StringBuilder();
            for (byte b : encodedHash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1)
                    hexString.append('0');
                hexString.append(hex);
            }

            return hexString.toString() + "###" + index;

        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not found", e);
        }
    }

    private PhonePeResponseWrapperDTO<PhonePePaymentResponseDTO> makePaymentRequest(String baseUrl, String endpoint,
            String base64Payload, String checksum) {
        Map<String, String> requestBody = new HashMap<>();
        requestBody.put("request", base64Payload);

        // Ensure standard URL formation
        String url = baseUrl + endpoint;
        logger.info("Calling PhonePe API: {}", url);

        return webClient.post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-VERIFY", checksum)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<PhonePeResponseWrapperDTO<PhonePePaymentResponseDTO>>() {
                })
                .block();
    }

    private PaymentResponseDTO buildPaymentResponse(PhonePePaymentResponseDTO phonePeResponse,
            PaymentInitiationRequestDTO request) {
        Map<String, Object> responseData = new HashMap<>();
        responseData.put("phonePeOrderId", phonePeResponse.getMerchantTransactionId());

        String redirectUrl = null;
        if (phonePeResponse.getInstrumentResponse() != null &&
                phonePeResponse.getInstrumentResponse().getRedirectInfo() != null) {
            redirectUrl = phonePeResponse.getInstrumentResponse().getRedirectInfo().getUrl();
        }

        responseData.put("redirectUrl", redirectUrl);
        responseData.put("status", phonePeResponse.getState()); // E.g. PAYMENT_INITIATED

        PaymentResponseDTO dto = new PaymentResponseDTO();
        dto.setOrderId(request.getOrderId());
        dto.setResponseData(responseData);
        dto.setRedirectUrl(redirectUrl);
        dto.setMessage(phonePeResponse.getMessage() != null ? phonePeResponse.getMessage() : "Payment Initiated");

        return dto;
    }

    public PhonePeStatusResponseDTO checkPaymentStatus(String merchantTransactionId,
            Map<String, Object> paymentGatewaySpecificData) {
        logger.info("Checking PhonePe payment status for transaction: {}", merchantTransactionId);

        try {
            String merchantId = (String) paymentGatewaySpecificData.get("clientId");
            String saltKey = (String) paymentGatewaySpecificData.get("clientSecret");
            String baseUrl = (String) paymentGatewaySpecificData.get("baseUrl");

            if (!StringUtils.hasText(baseUrl)) {
                baseUrl = (String) paymentGatewaySpecificData.getOrDefault("authBaseUrl",
                        paymentGatewaySpecificData.get("payBaseUrl"));
            }

            // Sanitize inputs
            merchantId = merchantId != null ? merchantId.trim() : "";
            saltKey = saltKey != null ? saltKey.trim() : "";
            baseUrl = baseUrl != null ? baseUrl.trim() : "";

            // Build endpoint
            String endpoint = "/pg/v1/status/" + merchantId + "/" + merchantTransactionId;

            // Calculate X-VERIFY checksum
            String checksum = calculateChecksum("", endpoint, saltKey);

            // Make GET request
            String url = baseUrl + endpoint;
            logger.info("Calling PhonePe Status API: {}", url);

            PhonePeResponseWrapperDTO<PhonePeStatusResponseDTO> response = webClient.get()
                    .uri(url)
                    .header("X-VERIFY", checksum)
                    .header("X-MERCHANT-ID", merchantId)
                    .header("Content-Type", "application/json")
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<PhonePeResponseWrapperDTO<PhonePeStatusResponseDTO>>() {
                    })
                    .block();

            if (response != null && response.isSuccess()) {
                logger.info("PhonePe status check successful. State: {}",
                        response.getData().getState());
                return response.getData();
            } else {
                String errorMsg = response != null ? response.getMessage() : "Empty response from PhonePe";
                logger.error("PhonePe status check failed: {}", errorMsg);
                // Return valid object with FAILED state instead of null to prevent NPE
                return PhonePeStatusResponseDTO.builder()
                        .state("FAILED")
                        .merchantOrderId(merchantTransactionId)
                        .build();
            }

        } catch (org.springframework.web.reactive.function.client.WebClientResponseException e) {
            logger.error("PhonePe Status API error. Status: {}, Body: {}", e.getStatusCode(),
                    e.getResponseBodyAsString());
            return PhonePeStatusResponseDTO.builder()
                    .state("FAILED")
                    .merchantOrderId(merchantTransactionId)
                    .build();
        } catch (Exception e) {
            logger.error("Error checking PhonePe payment status", e);
            return PhonePeStatusResponseDTO.builder()
                    .state("FAILED")
                    .merchantOrderId(merchantTransactionId)
                    .build();
        }
    }

    @Override
    public Map<String, Object> createCustomer(UserDTO user, PaymentInitiationRequestDTO request,
            Map<String, Object> paymentGatewaySpecificData) {
        logger.info("PhonePe does not require explicit customer creation. Returning user details.");
        Map<String, Object> response = new HashMap<>();
        if (user != null) {
            response.put("customerId", user.getId());
            response.put("email", user.getEmail());
            response.put("contact", user.getMobileNumber());
        }
        return response;
    }

    @Override
    public Map<String, Object> createCustomerForUnknownUser(String email, PaymentInitiationRequestDTO request,
            Map<String, Object> paymentGatewaySpecificData) {
        Map<String, Object> response = new HashMap<>();
        response.put("customerId", "anon_" + System.currentTimeMillis());
        response.put("email", email);
        return response;
    }

    @Override
    public Map<String, Object> findCustomerByEmail(String email, Map<String, Object> paymentGatewaySpecificData) {
        return null;
    }
}
