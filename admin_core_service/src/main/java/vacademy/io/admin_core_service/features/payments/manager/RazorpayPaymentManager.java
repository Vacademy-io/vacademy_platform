package vacademy.io.admin_core_service.features.payments.manager;

import com.razorpay.Customer;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.payments.dto.RazorpayCustomerDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.dto.RazorpayRequestDTO;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class RazorpayPaymentManager implements PaymentServiceStrategy {

    private static final Logger logger = LoggerFactory.getLogger(RazorpayPaymentManager.class);

    @Override
    public PaymentResponseDTO initiatePayment(UserDTO user, PaymentInitiationRequestDTO request,
                                              Map<String, Object> paymentGatewaySpecificData) {
        String userId = user != null ? user.getId() : "unknown user (donation)";
        logger.info("Initiating Razorpay payment for user: {}", userId);

        try {
            // Step 1: Validate request and initialize Razorpay client
            validateRequest(request);
            RazorpayClient razorpayClient = createRazorpayClient(paymentGatewaySpecificData);

            // Step 2: Convert amount to paise (smallest currency unit)
            long amountInPaise = convertAmountToPaise(request.getAmount());
            logger.debug("Payment amount in paise: {}", amountInPaise);

            // Step 3: Create Razorpay Order
            Order razorpayOrder = createRazorpayOrder(razorpayClient, request, amountInPaise);
            String orderId = razorpayOrder.get("id") != null ? razorpayOrder.get("id").toString() : "unknown";
            logger.info("Razorpay Order created with ID: {}", orderId);

            // Step 4: Build payment response
            return buildPaymentResponseFromOrder(razorpayOrder, request, paymentGatewaySpecificData);

        } catch (RazorpayException e) {
            logger.error("RazorpayException during payment initiation: {}", e.getMessage(), e);
            throw new VacademyException("Error initiating Razorpay payment: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> createCustomer(UserDTO user, PaymentInitiationRequestDTO request,
                                              Map<String, Object> paymentGatewaySpecificData) {
        String userId = user.getId();
        logger.info("Creating Razorpay customer for user: {}", userId);

        try {
            validateInput(user, request);
            RazorpayClient razorpayClient = createRazorpayClient(paymentGatewaySpecificData);

            // Build customer parameters
            JSONObject customerRequest = buildRazorpayCustomerParams(user, request);
            
            logger.debug("Razorpay customer creation parameters: {}", customerRequest.toString());
            Customer razorpayCustomer = razorpayClient.customers.create(customerRequest);
            String customerId = razorpayCustomer.get("id") != null ? razorpayCustomer.get("id").toString() : "unknown";
            logger.info("Razorpay customer created successfully. Customer ID: {}", customerId);

            return buildCustomerResponse(razorpayCustomer);

        } catch (RazorpayException e) {
            logger.error("RazorpayException during customer creation: {}", e.getMessage(), e);
            throw new VacademyException("Error creating Razorpay customer: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> createCustomerForUnknownUser(String email, PaymentInitiationRequestDTO request,
                                                            Map<String, Object> paymentGatewaySpecificData) {
        logger.info("Creating Razorpay customer for unknown user with email: {}", email);

        try {
            validateInputForUnknownUser(email, request);
            RazorpayClient razorpayClient = createRazorpayClient(paymentGatewaySpecificData);

            // Build customer parameters for unknown user
            JSONObject customerRequest = buildRazorpayCustomerParamsForUnknownUser(email, request);

            logger.debug("Razorpay customer creation parameters for unknown user: {}", customerRequest.toString());
            Customer razorpayCustomer = razorpayClient.customers.create(customerRequest);
            String customerId = razorpayCustomer.get("id") != null ? razorpayCustomer.get("id").toString() : "unknown";
            logger.info("Razorpay customer created successfully for unknown user. Customer ID: {}", customerId);

            return buildCustomerResponse(razorpayCustomer);

        } catch (RazorpayException e) {
            logger.error("RazorpayException during customer creation for unknown user: {}", e.getMessage(), e);
            throw new VacademyException("Error creating Razorpay customer for unknown user: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> findCustomerByEmail(String email, Map<String, Object> paymentGatewaySpecificData) {
        logger.info("Searching for existing Razorpay customer with email: {}", email);
        
        try {
            RazorpayClient razorpayClient = createRazorpayClient(paymentGatewaySpecificData);
            
            // Build query parameters
            JSONObject queryParams = new JSONObject();
            queryParams.put("email", email);
            queryParams.put("count", 1);

            // Fetch customers by email
            List<Customer> customers = razorpayClient.customers.fetchAll(queryParams);

            if (customers != null && !customers.isEmpty()) {
                Customer existingCustomer = customers.get(0);
                String customerId = existingCustomer.get("id") != null ? existingCustomer.get("id").toString() : "unknown";
                logger.info("Found existing Razorpay customer with ID: {}", customerId);
                return buildCustomerResponse(existingCustomer);
            } else {
                logger.info("No existing Razorpay customer found with email: {}", email);
                return null;
            }

        } catch (RazorpayException e) {
            logger.error("Razorpay error while searching for customer by email: {}", e.getMessage(), e);
            return null;
        } catch (Exception e) {
            logger.error("Unexpected error while searching for customer by email: {}", e.getMessage(), e);
            return null;
        }
    }

    // --- Private Helper Methods ---

    /**
     * Creates and initializes RazorpayClient with API credentials
     */
    private RazorpayClient createRazorpayClient(Map<String, Object> paymentGatewaySpecificData) 
            throws RazorpayException {
        String keyId = extractApiKey(paymentGatewaySpecificData);
        String keySecret = extractPublishableKey(paymentGatewaySpecificData);
        return new RazorpayClient(keyId, keySecret);
    }

    /**
     * Creates Razorpay Order
     */
    private Order createRazorpayOrder(RazorpayClient razorpayClient, PaymentInitiationRequestDTO request,
                                      long amountInPaise) throws RazorpayException {
        JSONObject orderRequest = new JSONObject();
        orderRequest.put("amount", amountInPaise);
        orderRequest.put("currency", request.getCurrency().toUpperCase());
        orderRequest.put("receipt", request.getOrderId()); // Our internal payment log ID
        
        // Add metadata as notes
        JSONObject notes = new JSONObject();
        notes.put("orderId", request.getOrderId());
        notes.put("instituteId", request.getInstituteId());
        if (StringUtils.hasText(request.getDescription())) {
            notes.put("description", request.getDescription());
        }
        orderRequest.put("notes", notes);

        logger.info("Creating Razorpay order with amount: {} paise", amountInPaise);
        return razorpayClient.orders.create(orderRequest);
    }

    /**
     * Builds PaymentResponseDTO from Razorpay Order
     */
    private PaymentResponseDTO buildPaymentResponseFromOrder(Order order, PaymentInitiationRequestDTO request,
                                                             Map<String, Object> paymentGatewaySpecificData) {
        Map<String, Object> responseData = new HashMap<>();
        
        try {
            // Safely extract order details
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
            
            // Add customer information from request
            RazorpayRequestDTO razorpayRequest = request.getRazorpayRequest();
            if (razorpayRequest != null) {
                responseData.put("customerId", razorpayRequest.getCustomerId());
                responseData.put("email", razorpayRequest.getEmail());
                responseData.put("contact", razorpayRequest.getContact());
            }

            // Add description
            if (StringUtils.hasText(request.getDescription())) {
                responseData.put("description", request.getDescription());
            }

            // Set payment status - safely get order status
            String orderStatus = order.has("status") && order.get("status") != null 
                    ? order.get("status").toString() 
                    : "created";
            PaymentStatusEnum paymentStatus = "created".equalsIgnoreCase(orderStatus) 
                    ? PaymentStatusEnum.PAYMENT_PENDING 
                    : PaymentStatusEnum.FAILED;
            responseData.put("paymentStatus", paymentStatus.name());

            PaymentResponseDTO dto = new PaymentResponseDTO();
            dto.setResponseData(responseData);
            dto.setOrderId(request.getOrderId());
            dto.setMessage("Order created successfully");

            logger.debug("Built payment response from Razorpay Order: {}", dto);
            return dto;
            
        } catch (Exception e) {
            logger.error("Error building payment response from order: {}", e.getMessage(), e);
            // Return minimal response on error
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

    /**
     * Builds customer parameters for authenticated user
     */
    private JSONObject buildRazorpayCustomerParams(UserDTO user, PaymentInitiationRequestDTO request) {
        JSONObject params = new JSONObject();
        params.put("name", user.getFullName());
        params.put("email", user.getEmail());
        params.put("fail_existing", "0"); // Don't fail if customer already exists

        RazorpayRequestDTO razorpayRequest = request.getRazorpayRequest();
        if (razorpayRequest != null && StringUtils.hasText(razorpayRequest.getContact())) {
            params.put("contact", razorpayRequest.getContact());
        } else if (StringUtils.hasText(user.getMobileNumber())) {
            params.put("contact", user.getMobileNumber());
        }

        // Add notes
        JSONObject notes = new JSONObject();
        notes.put("source", "vacademy_platform");
        notes.put("userId", user.getId());
        params.put("notes", notes);

        return params;
    }

    /**
     * Builds customer parameters for unknown user
     */
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

        // Add notes
        JSONObject notes = new JSONObject();
        notes.put("source", "vacademy_donation");
        params.put("notes", notes);

        return params;
    }

    /**
     * Builds customer response map with safe null handling
     */
    private Map<String, Object> buildCustomerResponse(Customer razorpayCustomer) {
        RazorpayCustomerDTO dto = new RazorpayCustomerDTO();
        
        try {
            // Safely extract fields with null checks
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
            
            // Safely parse created_at timestamp
            if (razorpayCustomer.has("created_at") && razorpayCustomer.get("created_at") != null) {
                try {
                    Object createdAtValue = razorpayCustomer.get("created_at");
                    if (createdAtValue instanceof Number) {
                        dto.setCreatedAt(((Number) createdAtValue).longValue());
                    } else {
                        dto.setCreatedAt(Long.parseLong(createdAtValue.toString()));
                    }
                } catch (NumberFormatException e) {
                    logger.warn("Failed to parse created_at timestamp: {}", e.getMessage());
                    dto.setCreatedAt(null);
                }
            }
            
            // Safely extract notes and convert to Map for JSON serialization
            if (razorpayCustomer.has("notes") && razorpayCustomer.get("notes") != null) {
                try {
                    Object notesObj = razorpayCustomer.get("notes");
                    // Convert JSONObject to Map to avoid serialization issues
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
                    logger.warn("Failed to extract notes, setting to null: {}", e.getMessage());
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
            logger.error("Error building customer response: {}", e.getMessage(), e);
            // Return minimal response on error
            Map<String, Object> response = new HashMap<>();
            response.put("customerId", razorpayCustomer.has("id") ? razorpayCustomer.get("id").toString() : "unknown");
            response.put("customerData", dto);
            return response;
        }
    }

    /**
     * Converts amount to paise (smallest currency unit)
     */
    private long convertAmountToPaise(double amount) {
        return BigDecimal.valueOf(amount)
                .multiply(BigDecimal.valueOf(100))
                .setScale(0, RoundingMode.HALF_UP)
                .longValue();
    }

    /**
     * Validates payment initiation request
     */
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

    /**
     * Validates input for authenticated user
     */
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

    /**
     * Validates input for unknown user
     */
    private void validateInputForUnknownUser(String email, PaymentInitiationRequestDTO request) {
        if (request == null) {
            throw new VacademyException("PaymentInitiationRequestDTO cannot be null.");
        }
        if (!StringUtils.hasText(email)) {
            throw new VacademyException("Email is required for unknown user.");
        }
    }

    /**
     * Extracts Razorpay API Key (Key ID) from gateway data
     * Supports both 'apiKey' (new) and 'keyId' (old) for backward compatibility
     */
    private String extractApiKey(Map<String, Object> data) {
        // Try 'apiKey' first (new naming), fallback to 'keyId' (old naming)
        String apiKey = (String) data.get("apiKey");
        if (!StringUtils.hasText(apiKey)) {
            apiKey = (String) data.get("keyId");
        }
        if (!StringUtils.hasText(apiKey)) {
            throw new VacademyException("Razorpay API Key (apiKey) is missing.");
        }
        return apiKey;
    }

    /**
     * Extracts Razorpay Key Secret (Publishable Key) from gateway data
     * Supports both 'publishableKey' (new) and 'keySecret' (old) for backward compatibility
     */
    private String extractPublishableKey(Map<String, Object> data) {
        // Try 'publishableKey' first (new naming), fallback to 'keySecret' (old naming)
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
