package vacademy.io.admin_core_service.features.payments.manager;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.EwayRequestDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class EwayPaymentManager implements PaymentServiceStrategy {

    private static final Logger LOGGER = LoggerFactory.getLogger(EwayPaymentManager.class);
    private final WebClient webClient;
    private final ObjectMapper jsonMapper = new ObjectMapper();

    public EwayPaymentManager() {
        this.jsonMapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        this.webClient = WebClient.create("https://api.sandbox.ewaypayments.com");
    }

    private EwayApiResponse callEwayTransactionApi(Transaction transaction, Map<String, Object> paymentGatewaySpecificData) {
        String apiKey = (String) paymentGatewaySpecificData.get("apiKey");
        String password = (String) paymentGatewaySpecificData.get("password");

        try {
            String jsonPayload = jsonMapper.writerWithDefaultPrettyPrinter().writeValueAsString(transaction);
            LOGGER.info("---------------- EWAY API REQUEST to /Transaction ----------------");
            LOGGER.info("Payload:\n{}", jsonPayload);
            LOGGER.info("------------------------------------------------------------------");
        } catch (JsonProcessingException e) {
            LOGGER.error("Could not serialize transaction for logging", e);
        }

        String authHeader = "Basic " + Base64.getEncoder().encodeToString((apiKey + ":" + password).getBytes());

        return webClient.post()
            .uri("/Transaction")
            .header("Authorization", authHeader)
            .header("Content-Type", "application/json")
            .bodyValue(transaction)
            .retrieve()
            .onStatus(status -> status.isError(), resp -> Mono.error(new VacademyException("Eway API error: " + resp.statusCode())))
            .bodyToMono(EwayApiResponse.class)
            .block();
    }

    @Override
    public PaymentResponseDTO initiatePayment(UserDTO user, PaymentInitiationRequestDTO request,
                                              Map<String, Object> paymentGatewaySpecificData) {

        Transaction transaction;
        EwayRequestDTO ewayRequest = request.getEwayRequest();

        if (StringUtils.hasText(ewayRequest.getCustomerId())) {
            LOGGER.info("Performing a Token Payment for customerId: {}", ewayRequest.getCustomerId());
            transaction = createTokenTransactionPayload(
                ewayRequest.getCustomerId(),
                (int) (request.getAmount() * 100),
                ewayRequest.getCvn()
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
                "ProcessPayment"
            );
        }

        EwayApiResponse response = callEwayTransactionApi(transaction, paymentGatewaySpecificData);

        if (response.Errors != null || !response.TransactionStatus) {
            throw new VacademyException("e-way payment failed: " + response.Errors);
        }

        PaymentResponseDTO paymentResponse = new PaymentResponseDTO();
        paymentResponse.setOrderId(request.getOrderId());

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("transactionId", response.TransactionID);
        if (response.Customer != null && StringUtils.hasText(response.Customer.TokenCustomerID)) {
            responseData.put("tokenCustomerId", response.Customer.TokenCustomerID);
        }
        responseData.put("status", "succeeded");

        paymentResponse.setResponseData(responseData);
        return paymentResponse;
    }

    private Transaction createTokenTransactionPayload(String customerId, int amount, String cvn) {
        Customer customer = new Customer();
        customer.TokenCustomerID = customerId;
        customer.CardDetails = new CardDetails();
        customer.CardDetails.CVN = cvn;

        PaymentDetails payment = new PaymentDetails();
        payment.TotalAmount = amount;
        payment.CurrencyCode = "AUD";

        Transaction transaction = new Transaction();
        transaction.Customer = customer;
        transaction.Payment = payment;
        transaction.Method = "ProcessPayment";
        transaction.TransactionType = "Recurring";

        return transaction;
    }

    private Transaction createCardTransactionPayload(String fullName, String email, EwayRequestDTO ewayRequest, int amount, String method) {
        CardDetails cardDetails = new CardDetails();
        cardDetails.Name = fullName;
        cardDetails.Number = ewayRequest.getCardNumber();
        cardDetails.ExpiryMonth = ewayRequest.getExpiryMonth();
        cardDetails.ExpiryYear = ewayRequest.getExpiryYear();
        cardDetails.CVN = ewayRequest.getCvn();

        Customer customer = new Customer();
        customer.CardDetails = cardDetails;
        customer.Email = email;
        customer.Country = "au";
        String[] nameParts = fullName.trim().split("\\s+", 2);
        customer.FirstName = nameParts[0];
        customer.LastName = nameParts.length > 1 ? nameParts[1] : "";

        Transaction transaction = new Transaction();
        transaction.Customer = customer;
        transaction.Method = method;
        transaction.TransactionType = "Purchase";

        if ("ProcessPayment".equals(method)) {
            PaymentDetails paymentDetails = new PaymentDetails();
            paymentDetails.TotalAmount = amount;
            paymentDetails.CurrencyCode = "AUD";
            transaction.Payment = paymentDetails;
        }

        return transaction;
    }

    @Override
    public Map<String, Object> createCustomer(UserDTO user, PaymentInitiationRequestDTO request,
                                              Map<String, Object> paymentGatewaySpecificData) {

        Transaction transaction = createTransactionPayload(user.getFullName(), user.getEmail(), request.getEwayRequest(), 0, "CreateTokenCustomer");
        EwayApiResponse response = callEwayTransactionApi(transaction, paymentGatewaySpecificData);

        if (response.Errors != null || !StringUtils.hasText(response.Customer.TokenCustomerID)) {
            throw new VacademyException("Failed to create e-way customer: " + response.Errors);
        }

        Map<String, Object> responseMap = new HashMap<>();
        responseMap.put("customerId", response.Customer.TokenCustomerID);
        return responseMap;
    }

    @Override
    public Map<String, Object> createCustomerForUnknownUser(String email, PaymentInitiationRequestDTO request,
                                                            Map<String, Object> paymentGatewaySpecificData) {

        Transaction transaction = createTransactionPayload("Anonymous User", email, request.getEwayRequest(), 0, "CreateTokenCustomer");
        EwayApiResponse response = callEwayTransactionApi(transaction, paymentGatewaySpecificData);

        if (response.Errors != null || !StringUtils.hasText(response.Customer.TokenCustomerID)) {
            throw new VacademyException("Failed to create e-way customer for unknown user: " + response.Errors);
        }

        Map<String, Object> responseMap = new HashMap<>();
        responseMap.put("customerId", response.Customer.TokenCustomerID);
        responseMap.put("customerData", response);
        return responseMap;
    }

    public PaymentResponseDTO chargeToken(String tokenCustomerId, double amount, String cvn, Map<String, Object> paymentGatewaySpecificData) {
        Customer customer = new Customer();
        customer.TokenCustomerID = tokenCustomerId;
        customer.CardDetails = new CardDetails();
        customer.CardDetails.CVN = cvn;

        PaymentDetails payment = new PaymentDetails();
        payment.TotalAmount = (int) (amount * 100);

        Transaction transaction = new Transaction();
        transaction.Customer = customer;
        transaction.Payment = payment;
        transaction.Method = "ProcessPayment";
        transaction.TransactionType = "Recurring";

        EwayApiResponse response = callEwayTransactionApi(transaction, paymentGatewaySpecificData);

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

    private Transaction createTransactionPayload(String fullName, String email, EwayRequestDTO ewayRequest, int amount, String method) {
        CardDetails cardDetails = new CardDetails();
        cardDetails.Name = fullName;
        cardDetails.Number = ewayRequest.getCardNumber();
        cardDetails.ExpiryMonth = ewayRequest.getExpiryMonth();
        cardDetails.ExpiryYear = ewayRequest.getExpiryYear();
        cardDetails.CVN = ewayRequest.getCvn();

        Customer customer = new Customer();
        customer.CardDetails = cardDetails;
        customer.Email = email;
        customer.Country = ewayRequest.getCountry();
        String[] nameParts = fullName.trim().split("\\s+", 2);
        customer.FirstName = nameParts[0];
        customer.LastName = nameParts.length > 1 ? nameParts[1] : "";

        Transaction transaction = new Transaction();
        transaction.Customer = customer;
        transaction.Method = method;
        transaction.TransactionType = "Purchase";

        if ("ProcessPayment".equals(method)) {
            PaymentDetails paymentDetails = new PaymentDetails();
            paymentDetails.TotalAmount = amount;
            paymentDetails.CurrencyCode = "AUD";
            transaction.Payment = paymentDetails;
        }

        return transaction;
    }

    @Override
    public Map<String, Object> findCustomerByEmail(String email, Map<String, Object> paymentGatewaySpecificData) {
        return null;
    }

    public Customer findCustomerById(String tokenCustomerId, Map<String, Object> paymentGatewaySpecificData) {
        String apiKey = (String) paymentGatewaySpecificData.get("apiKey");
        String password = (String) paymentGatewaySpecificData.get("password");
        String authHeader = "Basic " + Base64.getEncoder().encodeToString((apiKey + ":" + password).getBytes());

        EwayApiResponse response = webClient.get()
            .uri("/Customer/" + tokenCustomerId)
            .header("Authorization", authHeader)
            .retrieve()
            .onStatus(status -> status.isError(), resp -> Mono.error(new VacademyException("Eway API error: " + resp.statusCode())))
            .bodyToMono(EwayApiResponse.class)
            .block();

        return response.Customer;
    }

    private static class Transaction {
        @JsonProperty("Customer") public Customer Customer;
        @JsonProperty("Payment") public PaymentDetails Payment;
        @JsonProperty("Method") public String Method;
        @JsonProperty("TransactionType") public String TransactionType;
    }

    private static class Customer {
        @JsonProperty("TokenCustomerID") public String TokenCustomerID;
        @JsonProperty("FirstName") public String FirstName;
        @JsonProperty("LastName") public String LastName;
        @JsonProperty("Email") public String Email;
        @JsonProperty("Country") public String Country;
        @JsonProperty("CardDetails") public CardDetails CardDetails;
    }

    private static class CardDetails {
        @JsonProperty("Name") public String Name;
        @JsonProperty("Number") public String Number;
        @JsonProperty("ExpiryMonth") public String ExpiryMonth;
        @JsonProperty("ExpiryYear") public String ExpiryYear;
        @JsonProperty("CVN") public String CVN;
    }

    private static class PaymentDetails {
        @JsonProperty("TotalAmount") public int TotalAmount;
        @JsonProperty("CurrencyCode") public String CurrencyCode;
    }

    private static class EwayApiResponse {
        @JsonProperty("Customer") public Customer Customer;
        @JsonProperty("TransactionStatus") public Boolean TransactionStatus;
        @JsonProperty("TransactionID") public String TransactionID;
        @JsonProperty("Errors") public String Errors;
    }
}
