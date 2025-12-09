package vacademy.io.admin_core_service.features.payments.manager;

import com.razorpay.Customer;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import org.json.JSONObject;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.payments.dto.RazorpayCustomerDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.dto.RazorpayRequestDTO;
import vacademy.io.common.payment.enums.PaymentStatusEnum;
import vacademy.io.common.payment.enums.PaymentType;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class RazorpayPaymentManager implements PaymentServiceStrategy {

    @Override
    public PaymentResponseDTO initiatePayment(UserDTO user, PaymentInitiationRequestDTO request,
                                              Map<String, Object> paymentGatewaySpecificData) {

        try {
            validateRequest(request);
            RazorpayClient razorpayClient = createRazorpayClient(paymentGatewaySpecificData);

            long amountInPaise = convertAmountToPaise(request.getAmount());

            Order razorpayOrder = createRazorpayOrder(razorpayClient, request, amountInPaise);

            return buildPaymentResponseFromOrder(razorpayOrder, request, paymentGatewaySpecificData);

        } catch (RazorpayException e) {
            throw new VacademyException("Error initiating Razorpay payment: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> createCustomer(UserDTO user, PaymentInitiationRequestDTO request,
                                              Map<String, Object> paymentGatewaySpecificData) {

        try {
            validateInput(user, request);
            RazorpayClient razorpayClient = createRazorpayClient(paymentGatewaySpecificData);

            JSONObject customerRequest = buildRazorpayCustomerParams(user, request);
            Customer razorpayCustomer = razorpayClient.customers.create(customerRequest);

            return buildCustomerResponse(razorpayCustomer);

        } catch (RazorpayException e) {
            throw new VacademyException("Error creating Razorpay customer: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> createCustomerForUnknownUser(String email, PaymentInitiationRequestDTO request,
                                                            Map<String, Object> paymentGatewaySpecificData) {

        try {
            validateInputForUnknownUser(email, request);
            RazorpayClient razorpayClient = createRazorpayClient(paymentGatewaySpecificData);

            JSONObject customerRequest = buildRazorpayCustomerParamsForUnknownUser(email, request);
            Customer razorpayCustomer = razorpayClient.customers.create(customerRequest);

            return buildCustomerResponse(razorpayCustomer);

        } catch (RazorpayException e) {
            throw new VacademyException("Error creating Razorpay customer for unknown user: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> findCustomerByEmail(String email, Map<String, Object> paymentGatewaySpecificData) {
        try {
            RazorpayClient razorpayClient = createRazorpayClient(paymentGatewaySpecificData);

            JSONObject queryParams = new JSONObject();
            queryParams.put("email", email);
            queryParams.put("count", 1);

            List<Customer> customers = razorpayClient.customers.fetchAll(queryParams);

            if (customers != null && !customers.isEmpty()) {
                return buildCustomerResponse(customers.get(0));
            } else {
                return null;
            }

        } catch (RazorpayException | RuntimeException e) {
            return null;
        }
    }

    // --- Private Helper Methods ---

    private RazorpayClient createRazorpayClient(Map<String, Object> paymentGatewaySpecificData)
            throws RazorpayException {
        String keyId = extractApiKey(paymentGatewaySpecificData);
        String keySecret = extractPublishableKey(paymentGatewaySpecificData);
        return new RazorpayClient(keyId, keySecret);
    }

    private Order createRazorpayOrder(RazorpayClient razorpayClient,
                                      PaymentInitiationRequestDTO request,
                                      long amountInPaise) throws RazorpayException {

        JSONObject orderRequest = new JSONObject();
        orderRequest.put("amount", amountInPaise);
        orderRequest.put("currency", request.getCurrency().toUpperCase());
        orderRequest.put("receipt", request.getOrderId());

        JSONObject notes = new JSONObject();
        notes.put("orderId", request.getOrderId());
        notes.put("instituteId", request.getInstituteId());
        notes.put("payment_type", request.getPaymentType() != null ?
                request.getPaymentType().name() : PaymentType.INITIAL.name());

        if (StringUtils.hasText(request.getDescription())) {
            notes.put("description", request.getDescription());
        }

        orderRequest.put("notes", notes);

        return razorpayClient.orders.create(orderRequest);
    }

    private PaymentResponseDTO buildPaymentResponseFromOrder(Order order, PaymentInitiationRequestDTO request,
                                                             Map<String, Object> paymentGatewaySpecificData) {
        Map<String, Object> responseData = new HashMap<>();

        try {
            responseData.put("razorpayOrderId", order.has("id") ? order.get("id") : null);
            responseData.put("razorpayKeyId", extractApiKey(paymentGatewaySpecificData));
            responseData.put("amount", order.has("amount") ? order.get("amount") : 0);
            responseData.put("amountPaid", order.has("amount_paid") ? order.get("amount_paid") : 0);
            responseData.put("amountDue", order.has("amount_due") ? order.get("amount_due") : 0);
            responseData.put("currency", order.has("currency") ? order.get("currency") : request.getCurrency());
            responseData.put("receipt", order.has("receipt") ? order.get("receipt") : request.getOrderId());
            responseData.put("status", order.has("status") ? order.get("status") : "created");
            responseData.put("attempts", order.has("attempts") ? order.get("attempts") : 0);
            responseData.put("createdAt", order.has("created_at") ? order.get("created_at") : System.currentTimeMillis() / 1000);

            RazorpayRequestDTO razorpayRequest = request.getRazorpayRequest();
            if (razorpayRequest != null) {
                responseData.put("customerId", razorpayRequest.getCustomerId());
                responseData.put("email", razorpayRequest.getEmail());
                responseData.put("contact", razorpayRequest.getContact());
            }

            if (StringUtils.hasText(request.getDescription())) {
                responseData.put("description", request.getDescription());
            }

            String orderStatus = order.has("status") && order.get("status") != null
                    ? order.get("status").toString() : "created";

            PaymentStatusEnum paymentStatus = "created".equalsIgnoreCase(orderStatus)
                    ? PaymentStatusEnum.PAYMENT_PENDING
                    : PaymentStatusEnum.FAILED;

            responseData.put("paymentStatus", paymentStatus.name());

            PaymentResponseDTO dto = new PaymentResponseDTO();
            dto.setResponseData(responseData);
            dto.setOrderId(request.getOrderId());
            dto.setMessage("Order created successfully");

            return dto;

        } catch (Exception e) {
            PaymentResponseDTO errorDto = new PaymentResponseDTO();
            errorDto.setOrderId(request.getOrderId());
            errorDto.setMessage("Order created with warnings");

            Map<String, Object> minimalData = new HashMap<>();
            minimalData.put("razorpayOrderId", order.has("id") ? order.get("id") : "unknown");
            minimalData.put("razorpayKeyId", extractApiKey(paymentGatewaySpecificData));
            minimalData.put("paymentStatus", PaymentStatusEnum.PAYMENT_PENDING.name());
            errorDto.setResponseData(minimalData);

            return errorDto;
        }
    }

    private JSONObject buildRazorpayCustomerParams(UserDTO user, PaymentInitiationRequestDTO request) {
        JSONObject params = new JSONObject();
        params.put("name", user.getFullName());
        params.put("email", user.getEmail());
        params.put("fail_existing", "0");

        RazorpayRequestDTO razorpayRequest = request.getRazorpayRequest();
        if (razorpayRequest != null && StringUtils.hasText(razorpayRequest.getContact())) {
            params.put("contact", razorpayRequest.getContact());
        } else if (StringUtils.hasText(user.getMobileNumber())) {
            params.put("contact", user.getMobileNumber());
        }

        JSONObject notes = new JSONObject();
        notes.put("source", "vacademy_platform");
        notes.put("userId", user.getId());
        params.put("notes", notes);

        return params;
    }

    private JSONObject buildRazorpayCustomerParamsForUnknownUser(String email,
                                                                 PaymentInitiationRequestDTO request) {
        JSONObject params = new JSONObject();
        params.put("name", "Anonymous User");
        params.put("email", email);
        params.put("fail_existing", "0");

        RazorpayRequestDTO razorpayRequest = request.getRazorpayRequest();
        if (razorpayRequest != null && StringUtils.hasText(razorpayRequest.getContact())) {
            params.put("contact", razorpayRequest.getContact());
        }

        JSONObject notes = new JSONObject();
        notes.put("source", "vacademy_donation");
        params.put("notes", notes);

        return params;
    }

    private Map<String, Object> buildCustomerResponse(Customer razorpayCustomer) {
        RazorpayCustomerDTO dto = new RazorpayCustomerDTO();

        try {
            dto.setId(razorpayCustomer.has("id") ? razorpayCustomer.get("id").toString() : null);
            dto.setEntity(razorpayCustomer.has("entity") ? razorpayCustomer.get("entity").toString() : null);
            dto.setName(razorpayCustomer.has("name") && razorpayCustomer.get("name") != null
                    ? razorpayCustomer.get("name").toString() : null);
            dto.setEmail(razorpayCustomer.has("email") && razorpayCustomer.get("email") != null
                    ? razorpayCustomer.get("email").toString() : null);
            dto.setContact(razorpayCustomer.has("contact") && razorpayCustomer.get("contact") != null
                    ? razorpayCustomer.get("contact").toString() : null);
            dto.setGstin(razorpayCustomer.has("gstin") && razorpayCustomer.get("gstin") != null
                    ? razorpayCustomer.get("gstin").toString() : null);

            if (razorpayCustomer.has("created_at") && razorpayCustomer.get("created_at") != null) {
                try {
                    Object createdAtValue = razorpayCustomer.get("created_at");
                    if (createdAtValue instanceof Number) {
                        dto.setCreatedAt(((Number) createdAtValue).longValue());
                    } else {
                        dto.setCreatedAt(Long.parseLong(createdAtValue.toString()));
                    }
                } catch (NumberFormatException e) {
                    dto.setCreatedAt(null);
                }
            }

            if (razorpayCustomer.has("notes") && razorpayCustomer.get("notes") != null) {
                try {
                    Object notesObj = razorpayCustomer.get("notes");
                    if (notesObj instanceof org.json.JSONObject) {
                        Map<String, Object> notesMap = new HashMap<>();
                        org.json.JSONObject jsonNotes = (org.json.JSONObject) notesObj;
                        for (String key : jsonNotes.keySet()) {
                            notesMap.put(key, jsonNotes.get(key));
                        }
                        dto.setNotes(notesMap);
                    } else {
                        dto.setNotes(notesObj);
                    }
                } catch (Exception e) {
                    dto.setNotes(null);
                }
            } else {
                dto.setNotes(null);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("customerId", razorpayCustomer.has("id") ? razorpayCustomer.get("id").toString() : null);
            response.put("customerData", dto);
            return response;

        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("customerId", razorpayCustomer.has("id") ? razorpayCustomer.get("id").toString() : "unknown");
            response.put("customerData", dto);
            return response;
        }
    }

    private long convertAmountToPaise(double amount) {
        return BigDecimal.valueOf(amount)
                .multiply(BigDecimal.valueOf(100))
                .setScale(0, RoundingMode.HALF_UP)
                .longValue();
    }

    private void validateRequest(PaymentInitiationRequestDTO request) {
        if (request == null) {
            throw new VacademyException("Payment request cannot be null.");
        }
        if (request.getAmount() <= 0) {
            throw new VacademyException("Amount must be greater than zero.");
        }
        if (!StringUtils.hasText(request.getCurrency())) {
            throw new VacademyException("Currency must be specified.");
        }
        if (!StringUtils.hasText(request.getOrderId())) {
            throw new VacademyException("Order ID must be specified.");
        }
    }

    private void validateInput(UserDTO user, PaymentInitiationRequestDTO request) {
        if (request == null) {
            throw new VacademyException("PaymentInitiationRequestDTO cannot be null.");
        }
        if (!StringUtils.hasText(user.getEmail())) {
            throw new VacademyException("Email is required.");
        }
        if (!StringUtils.hasText(user.getFullName())) {
            throw new VacademyException("Full name is required.");
        }
    }

    private void validateInputForUnknownUser(String email, PaymentInitiationRequestDTO request) {
        if (request == null) {
            throw new VacademyException("PaymentInitiationRequestDTO cannot be null.");
        }
        if (!StringUtils.hasText(email)) {
            throw new VacademyException("Email is required for unknown user.");
        }
    }

    private String extractApiKey(Map<String, Object> data) {
        String apiKey = (String) data.get("apiKey");
        if (!StringUtils.hasText(apiKey)) {
            apiKey = (String) data.get("keyId");
        }
        if (!StringUtils.hasText(apiKey)) {
            throw new VacademyException("Razorpay API Key (apiKey) is missing.");
        }
        return apiKey;
    }

    private String extractPublishableKey(Map<String, Object> data) {
        String publishableKey = (String) data.get("publishableKey");
        if (!StringUtils.hasText(publishableKey)) {
            publishableKey = (String) data.get("keySecret");
        }
        if (!StringUtils.hasText(publishableKey)) {
            throw new VacademyException("Razorpay Key Secret (publishableKey) is missing.");
        }
        return publishableKey;
    }
}
