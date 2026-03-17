package vacademy.io.admin_core_service.features.payments.manager;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.payments.service.WebHookService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.*;
import vacademy.io.common.payment.enums.PaymentGateway;
import vacademy.io.common.payment.enums.PaymentStatusEnum;
import vacademy.io.common.payment.enums.PaymentType;

import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class EwayPaymentManager implements PaymentServiceStrategy {

    private static final Logger LOGGER = LoggerFactory.getLogger(EwayPaymentManager.class);
    private final WebClient webClient;
    private final ObjectMapper jsonMapper = new ObjectMapper();
    private final WebHookService webHookService;
    private final PaymentLogService paymentLogService;

    public EwayPaymentManager(WebClient.Builder webClientBuilder,WebHookService webHookService,PaymentLogService paymentLogService) {
        this.webClient = webClientBuilder.build();
        this.jsonMapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        this.webHookService = webHookService;
        this.paymentLogService = paymentLogService;
    }

    // ===================================================================================
    // Overridden Methods from PaymentServiceStrategy
    // ===================================================================================

    @Override
    public PaymentResponseDTO initiatePayment(UserDTO user, PaymentInitiationRequestDTO request,
                                              Map<String, Object> paymentGatewaySpecificData) {

        EwayApiResponseDTO.Transaction transaction;
        EwayRequestDTO ewayRequest = request.getEwayRequest();

        if (StringUtils.hasText(ewayRequest.getCustomerId())) {
            LOGGER.info("Performing a Token Payment for customerId: {}", ewayRequest.getCustomerId());
            transaction = createTokenTransactionPayload(
                    ewayRequest.getCustomerId(),
                    (int) (request.getAmount() * 100),
                    ewayRequest.getCvn(),
                    request.getCurrency()
            );
        } else {
            LOGGER.info("Performing a new card payment.");
            String fullName = (user != null && user.getFullName() != null) ? user.getFullName() : "Anonymous User";
            String email = request.getEmail() != null ? request.getEmail() : "noemail@unknown.com";

            transaction = createCardTransactionPayload(
                    fullName,
                    email,
                    ewayRequest,
                    (int) (request.getAmount() * 100),
                    "ProcessPayment",
                    request.getCurrency()
            );
        }        EwayApiResponseDTO response = callEwayTransactionApi(transaction, paymentGatewaySpecificData);


        PaymentResponseDTO paymentResponseDTO = buildPaymentResponseFromIntent(response, request.getOrderId());

        createWebHook(request.getInstituteId(), paymentResponseDTO, request);

        return paymentResponseDTO;
    }

    @Override
    public Map<String, Object> createCustomer(UserDTO user, PaymentInitiationRequestDTO request,
                                              Map<String, Object> paymentGatewaySpecificData) {

        EwayApiResponseDTO.Transaction transaction = createCardTransactionPayload(user.getFullName(), user.getEmail(), request.getEwayRequest(), 0, "CreateTokenCustomer", request.getCurrency());
        EwayApiResponseDTO response = callEwayTransactionApi(transaction, paymentGatewaySpecificData);

        if (response.Errors != null || !StringUtils.hasText(response.Customer.TokenCustomerID)) {
            throw new VacademyException("Failed to create e-way customer: " + response.Errors);
        }

        Map<String, Object> responseMap = new HashMap<>();
        responseMap.put("customerId", response.Customer.TokenCustomerID);
        responseMap.put("customerData", response);
        return responseMap;
    }

    @Override
    public Map<String, Object> createCustomerForUnknownUser(String email, PaymentInitiationRequestDTO request,
                                                            Map<String, Object> paymentGatewaySpecificData) {

        EwayApiResponseDTO.Transaction transaction = createCardTransactionPayload("Anonymous User", email, request.getEwayRequest(), 0, "CreateTokenCustomer", request.getCurrency());
        EwayApiResponseDTO
                response = callEwayTransactionApi(transaction, paymentGatewaySpecificData);

        if (response.Errors != null || !StringUtils.hasText(response.Customer.TokenCustomerID)) {
            throw new VacademyException("Failed to create e-way customer for unknown user: " + response.Errors);
        }

        Map<String, Object> responseMap = new HashMap<>();
        responseMap.put("customerId", response.Customer.TokenCustomerID);
        responseMap.put("customerData", response);
        return responseMap;
    }

    @Override
    public Map<String, Object> findCustomerByEmail(String email, Map<String, Object> paymentGatewaySpecificData) {
        return null;
    }


    // ===================================================================================
    // Public Methods specific to EwayPaymentManager
    // ===================================================================================

    public PaymentResponseDTO chargeToken(String tokenCustomerId, double amount, String cvn, Map<String, Object> paymentGatewaySpecificData) {
        EwayApiResponseDTO.Transaction transaction = createTokenTransactionPayload(
                tokenCustomerId,
                (int) (amount * 100),
                cvn,
                null // Assuming default currency or it should be passed in
        );

        EwayApiResponseDTO response = callEwayTransactionApi(transaction, paymentGatewaySpecificData);

        if (response.Errors != null || !response.TransactionStatus) {
            throw new VacademyException("e-way token payment failed: " + response.Errors);
        }

        PaymentResponseDTO paymentResponse = new PaymentResponseDTO();
        paymentResponse.setResponseData(Map.of(
                "transactionId", response.TransactionID,
                "status", "succeeded"
        ));
        return paymentResponse;
    }

    public EwayTransaction getTransactionById(String transactionId, Map<String, Object> paymentGatewaySpecificData) {
        LOGGER.info("Fetching Eway transaction details for transactionId: {}", transactionId);

        String apiKey = (String) paymentGatewaySpecificData.get("apiKey");
        String password = (String) paymentGatewaySpecificData.get("password");
        String baseUrl = (String) paymentGatewaySpecificData.get("baseUrl");

        if (!StringUtils.hasText(apiKey) || !StringUtils.hasText(password) || !StringUtils.hasText(baseUrl)) {
            throw new VacademyException("Eway API credentials (apiKey, password, baseUrl) are missing.");
        }

        String authHeader = "Basic " + Base64.getEncoder().encodeToString((apiKey + ":" + password).getBytes());

        String str = webClient.get()
                .uri(baseUrl + "/Transaction/" + transactionId)
                .header("Authorization", authHeader)
                .header("Content-Type", "application/json")
                .retrieve()
                .onStatus(status -> status.isError(), resp -> {
                    LOGGER.error("Eway API error while fetching transaction {}: {}", transactionId, resp.statusCode());
                    return Mono.error(new VacademyException("Eway API error: " + resp.statusCode()));
                })
                .bodyToMono(String.class)
                .block();
        EwayTransactionQueryResponse response = JsonUtil.fromJson(str, EwayTransactionQueryResponse.class);
        if (response == null) {
            throw new VacademyException("No response from Eway API for transactionId: " + transactionId);
        }

        if (StringUtils.hasText(response.getErrors())) {
            throw new VacademyException("Eway API returned errors for transactionId " + transactionId + ": " + response.getErrors());
        }

        if (response.getTransactions() == null || response.getTransactions().isEmpty()) {
            LOGGER.warn("No transaction found for transactionId: {}", transactionId);
            return null;
        }

        return response.getTransactions().get(0);
    }

    // ===================================================================================
    // Private Helper Methods
    // ===================================================================================

    private EwayApiResponseDTO callEwayTransactionApi(EwayApiResponseDTO.Transaction transaction, Map<String, Object> paymentGatewaySpecificData) {
        String apiKey = (String) paymentGatewaySpecificData.get("apiKey");
        String password = (String) paymentGatewaySpecificData.get("password");
        String baseUrl = (String) paymentGatewaySpecificData.get("baseUrl");

        String authHeader = "Basic " + Base64.getEncoder().encodeToString((apiKey + ":" + password).getBytes());

        return webClient.post()
                .uri(baseUrl + "/Transaction")
                .header("Authorization", authHeader)
                .header("Content-Type", "application/json")
                .bodyValue(transaction)
                .retrieve()
                .onStatus(status -> status.isError(), resp -> Mono.error(new VacademyException("Eway API error: " + resp.statusCode())))
                .bodyToMono(EwayApiResponseDTO.class)
                .block();
    }

    private EwayApiResponseDTO.Transaction createTokenTransactionPayload(String customerId, int amount, String cvn, String currencyCode) {
        EwayApiResponseDTO.Customer customer = new EwayApiResponseDTO.Customer();
        customer.TokenCustomerID = customerId;
        customer.CardDetails = new EwayApiResponseDTO.CardDetails();
        customer.CardDetails.CVN = cvn;

        EwayApiResponseDTO.PaymentDetails payment = new EwayApiResponseDTO.PaymentDetails();
        payment.TotalAmount = amount;
        payment.CurrencyCode = currencyCode;

        EwayApiResponseDTO.Transaction transaction = new EwayApiResponseDTO.Transaction();
        transaction.Customer = customer;
        transaction.Payment = payment;
        transaction.Method = "ProcessPayment";
        transaction.TransactionType = "Recurring";

        return transaction;
    }

    private EwayApiResponseDTO.Transaction createCardTransactionPayload(String fullName, String email, EwayRequestDTO ewayRequest, int amount, String method, String currencyCode) {
        EwayApiResponseDTO.CardDetails cardDetails = new EwayApiResponseDTO.CardDetails();
        cardDetails.Name = fullName;
        cardDetails.Number = ewayRequest.getCardNumber();
        cardDetails.ExpiryMonth = ewayRequest.getExpiryMonth();
        cardDetails.ExpiryYear = ewayRequest.getExpiryYear();
        cardDetails.CVN = ewayRequest.getCvn();

        EwayApiResponseDTO.Customer customer = new EwayApiResponseDTO.Customer();
        customer.CardDetails = cardDetails;
        customer.Email = email;
        customer.Country = ewayRequest.getCountryCode();
        String[] nameParts = fullName.trim().split("\\s+", 2);
        customer.FirstName = nameParts[0];
        customer.LastName = nameParts.length > 1 ? nameParts[1] : "";

        EwayApiResponseDTO.Transaction transaction = new EwayApiResponseDTO.Transaction();
        transaction.Customer = customer;
        transaction.Method = method;
        transaction.TransactionType = "Purchase";

        if ("ProcessPayment".equals(method)) {
            EwayApiResponseDTO.PaymentDetails paymentDetails = new EwayApiResponseDTO.PaymentDetails();
            paymentDetails.TotalAmount = amount;
            paymentDetails.CurrencyCode = currencyCode;
            transaction.Payment = paymentDetails;
        }

        return transaction;
    }

    private PaymentResponseDTO buildPaymentResponseFromIntent(EwayApiResponseDTO responseDTO, String orderId) {
        if (responseDTO == null) {
            throw new IllegalArgumentException("EwayApiResponseDTO cannot be null");
        }

        Map<String, Object> responseData = new HashMap<>();

        int amount = 0;
        if (responseDTO.getPayment() != null && responseDTO.getPayment().getTotalAmount() != 0) {
            amount = responseDTO.getPayment().getTotalAmount()/100; // convert cents to actual amount
        }

        responseData.put("transactionId", responseDTO.getTransactionID());
        responseData.put("status", responseDTO.getTransactionStatus());
        responseData.put("amount", amount);
        responseData.put("currency", responseDTO.getPayment() != null ? responseDTO.getPayment().getCurrencyCode() : null);
        responseData.put("created", Instant.now().getEpochSecond());
        PaymentStatusEnum paymentStatus;
        if ("00".equalsIgnoreCase(responseDTO.getResponseCode()) && Boolean.TRUE.equals(responseDTO.getTransactionStatus())) {
            paymentStatus = PaymentStatusEnum.PAID;
        } else if (responseDTO.getResponseCode() == null) {
            paymentStatus = PaymentStatusEnum.PAYMENT_PENDING;
        } else {
            paymentStatus = PaymentStatusEnum.FAILED;
        }

        responseData.put("paymentStatus", paymentStatus.name());

        PaymentResponseDTO dto = new PaymentResponseDTO();
        dto.setResponseData(responseData);
        dto.setOrderId(orderId);

        return dto;
    }

    private void createWebHook(String instituteId, PaymentResponseDTO paymentResponseDTO, PaymentInitiationRequestDTO request){
        EwayWebHookDTO eWayWebHookDTO = new EwayWebHookDTO();
        eWayWebHookDTO.setInstituteId(instituteId);
        eWayWebHookDTO.setPaymentResponse(paymentResponseDTO);
        eWayWebHookDTO.setPaymentType(request.getPaymentType() != null ? 
            request.getPaymentType().name() : PaymentType.INITIAL.name());
        webHookService.saveWebhook(PaymentGateway.EWAY.name(),JsonUtil.toJson(eWayWebHookDTO),paymentResponseDTO.getOrderId());
    }
}