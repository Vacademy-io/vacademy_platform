package vacademy.io.admin_core_service.features.payments.manager;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.*;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.PaymentMethodAttachParams;
import com.stripe.param.PaymentMethodListParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.payments.dto.StripeCustomerDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.dto.StripeRequestDTO;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

@Service
public class StripePaymentManager implements PaymentServiceStrategy {

    private static final Logger logger = LoggerFactory.getLogger(StripePaymentManager.class);

    @Override
    public Map<String, Object> createCustomer(UserDTO user, PaymentInitiationRequestDTO request,
                                              Map<String, Object> paymentGatewaySpecificData) {
        logger.info("Starting Stripe customer creation for user: {}", user.getId());

        try {
            String apiKey = extractApiKey(paymentGatewaySpecificData);
            validateInput(user, request);

            Stripe.apiKey = apiKey;
            Map<String, Object> stripeParams = buildStripeCustomerParams(user, request);

            logger.debug("Stripe customer creation parameters: {}", stripeParams);
            Customer stripeCustomer = Customer.create(stripeParams);
            logger.info("Stripe customer created successfully. Customer ID: {}", stripeCustomer.getId());

            return buildCustomerResponse(stripeCustomer);

        } catch (StripeException e) {
            logger.error("StripeException during customer creation: {}", e.getMessage(), e);
            throw new VacademyException("Error creating Stripe customer: " + e.getMessage());
        }
    }

    /**
     * ✅ UPDATED: Added a return_url to handle redirect-based payment methods
     * like 3D Secure.
     */
    @Override
    public PaymentResponseDTO initiatePayment(UserDTO user, PaymentInitiationRequestDTO request,
                                              Map<String, Object> paymentGatewaySpecificData) {
        logger.info("Initiating single-step Stripe payment for user: {}", user != null ? user.getId() : "unknown user (donation)");

        try {
            // Step 1: Validate the request and set the API key
            validateRequest(request);
            String apiKey = extractApiKey(paymentGatewaySpecificData);
            Stripe.apiKey = apiKey;

            StripeRequestDTO stripeRequestDTO = request.getStripeRequest();
            long amountInCents = convertAmountToCents(request.getAmount());
            logger.debug("Payment amount in cents: {}", amountInCents);

            // Step 2: Attach the new payment method to the customer for future use.
            attachPaymentMethodIfNeeded(stripeRequestDTO.getCustomerId(), stripeRequestDTO.getPaymentMethodId());
            if (!StringUtils.hasText(stripeRequestDTO.getReturnUrl())){
                stripeRequestDTO.setReturnUrl("https://vacademy.io");
            }
            // Step 3: Create and Confirm the PaymentIntent in one go
            PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                    .setAmount(amountInCents)
                    .setCurrency(request.getCurrency().toLowerCase())
                    .setCustomer(stripeRequestDTO.getCustomerId())
                    .setPaymentMethod(stripeRequestDTO.getPaymentMethodId())
                    .setConfirmationMethod(PaymentIntentCreateParams.ConfirmationMethod.MANUAL)
                    .setConfirm(true)
                    .setReturnUrl(stripeRequestDTO.getReturnUrl())
                    .setDescription(request.getDescription() != null ? request.getDescription() : "No description")
                    .putMetadata("orderId", request.getOrderId())
                    .putMetadata("instituteId", request.getInstituteId())
                    .setReceiptEmail((StringUtils.hasText(request.getEmail()) ? request.getEmail() : user.getEmail()))
                    .build();

            logger.info("Creating and confirming PaymentIntent for customer: {}", stripeRequestDTO.getCustomerId());
            PaymentIntent paymentIntent = PaymentIntent.create(params);
            logger.info("PaymentIntent created with ID: {} and status: {}", paymentIntent.getId(), paymentIntent.getStatus());

            // Step 4: Handle the response based on the PaymentIntent status
            return buildPaymentResponseFromIntent(paymentIntent);

        } catch (StripeException e) {
            logger.error("Stripe error during payment initiation: {}", e.getMessage(), e);
            throw new VacademyException("Stripe payment failed: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> createCustomerForUnknownUser(String email, PaymentInitiationRequestDTO request,
                                                            Map<String, Object> paymentGatewaySpecificData) {
        logger.info("Starting Stripe customer creation for unknown user with email: {}", email);

        try {
            String apiKey = extractApiKey(paymentGatewaySpecificData);
            validateInputForUnknownUser(email, request);

            Stripe.apiKey = apiKey;
            Map<String, Object> stripeParams = buildStripeCustomerParamsForUnknownUser(email, request);

            logger.debug("Stripe customer creation parameters for unknown user: {}", stripeParams);
            Customer stripeCustomer = Customer.create(stripeParams);
            logger.info("Stripe customer created successfully for unknown user. Customer ID: {}",
                    stripeCustomer.getId());

            return buildCustomerResponse(stripeCustomer);

        } catch (StripeException e) {
            logger.error("StripeException during customer creation for unknown user: {}", e.getMessage(), e);
            throw new VacademyException("Error creating Stripe customer for unknown user: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> findCustomerByEmail(String email, Map<String, Object> paymentGatewaySpecificData) {
        logger.info("Searching for existing Stripe customer with email: {}", email);
        try {
            String apiKey = extractApiKey(paymentGatewaySpecificData);
            Stripe.apiKey = apiKey;
            Map<String, Object> searchParams = new HashMap<>();
            searchParams.put("email", email);
            searchParams.put("limit", 1);
            CustomerCollection customers = Customer.list(searchParams);
            if (customers.getData() != null && !customers.getData().isEmpty()) {
                Customer existingCustomer = customers.getData().get(0);
                logger.info("Found existing Stripe customer with ID: {}", existingCustomer.getId());
                return buildCustomerResponse(existingCustomer);
            } else {
                logger.info("No existing Stripe customer found with email: {}", email);
                return null;
            }
        } catch (StripeException e) {
            logger.error("Stripe error while searching for customer by email: {}", e.getMessage(), e);
            return null;
        } catch (Exception e) {
            logger.error("Unexpected error while searching for customer by email: {}", e.getMessage(), e);
            return null;
        }
    }

    // --- Private Helper Methods ---

    /**
     * ✅ NEW: Builds the final response DTO from a PaymentIntent object.
     */
    // In your payment processing service (e.g., StripePaymentManager)

    private PaymentResponseDTO buildPaymentResponseFromIntent(PaymentIntent paymentIntent) {
        Map<String, Object> responseData = new HashMap<>();
        responseData.put("transactionId", paymentIntent.getId());
        responseData.put("status", paymentIntent.getStatus());
        responseData.put("clientSecret", paymentIntent.getClientSecret());
        responseData.put("amount", paymentIntent.getAmount()); // Amount is in cents
        responseData.put("currency", paymentIntent.getCurrency());
        responseData.put("created", paymentIntent.getCreated()); // NEW: Capture the transaction timestamp
        // Assuming 'paymentIntent' is your parsed PaymentIntent object
        String receiptUrl = null;


        String chargeId = paymentIntent.getLatestCharge(); // Get the Charge ID as a String

        if (chargeId != null) {
            try {
                // Retrieve the full and complete Charge object from Stripe's API
                Charge charge = Charge.retrieve(chargeId);

                // Now, this will correctly get the receipt URL
                receiptUrl = charge.getReceiptUrl();

            } catch (StripeException e) {
                e.printStackTrace();
            }
        }
        responseData.put("receiptUrl", receiptUrl); // NEW: Capture the transaction timestamp

        PaymentStatusEnum paymentStatus;
        switch (paymentIntent.getStatus()) {
            case "succeeded":
                paymentStatus = PaymentStatusEnum.PAID;
                break;
            case "requires_action":
            case "processing":
                paymentStatus = PaymentStatusEnum.PAYMENT_PENDING;
                break;
            default:
                paymentStatus = PaymentStatusEnum.FAILED;
                break;
        }
        responseData.put("paymentStatus", paymentStatus.name());

        PaymentResponseDTO dto = new PaymentResponseDTO();
        dto.setResponseData(responseData);
        dto.setOrderId(paymentIntent.getMetadata().get("orderId"));

        logger.debug("Built payment response from PaymentIntent: {}", dto);
        return dto;
    }

    private long convertAmountToCents(double amount) {
        return BigDecimal.valueOf(amount)
                .multiply(BigDecimal.valueOf(100))
                .setScale(0, RoundingMode.HALF_UP)
                .longValue();
    }

    private void attachPaymentMethodIfNeeded(String customerId, String paymentMethodId) throws StripeException {
        if (!StringUtils.hasText(customerId) || !StringUtils.hasText(paymentMethodId)) {
            return; // Cannot attach if IDs are missing
        }
        logger.info("Verifying if payment method {} is attached to customer {}", paymentMethodId, customerId);

        PaymentMethodListParams listParams = PaymentMethodListParams.builder()
                .setCustomer(customerId)
                .setType(PaymentMethodListParams.Type.CARD)
                .build();

        boolean isAttached = PaymentMethod.list(listParams).getData()
                .stream()
                .anyMatch(pm -> pm.getId().equals(paymentMethodId));

        if (!isAttached) {
            logger.info("Attaching payment method {} to customer {}", paymentMethodId, customerId);
            PaymentMethod paymentMethod = PaymentMethod.retrieve(paymentMethodId);
            paymentMethod.attach(PaymentMethodAttachParams.builder().setCustomer(customerId).build());
        } else {
            logger.debug("Payment method {} is already attached.", paymentMethodId);
        }
    }

    /**
     * ✅ UPDATED: Validation now ensures a PaymentMethod ID is present for the charge.
     */
    private void validateRequest(PaymentInitiationRequestDTO request) {
        StripeRequestDTO stripeRequestDTO = request.getStripeRequest();

        if (stripeRequestDTO == null || !StringUtils.hasText(stripeRequestDTO.getCustomerId())) {
            throw new VacademyException("Missing Stripe customer ID.");
        }

        if (!StringUtils.hasText(stripeRequestDTO.getPaymentMethodId())) {
            throw new VacademyException("Payment method ID is required for a one-time payment.");
        }

        if (request.getAmount() <= 0) {
            throw new VacademyException("Amount must be greater than zero.");
        }

        if (!StringUtils.hasText(request.getCurrency())) {
            throw new VacademyException("Currency must be specified.");
        }
    }

    private String extractApiKey(Map<String, Object> data) {
        String key = (String) data.get("apiKey");
        if (!StringUtils.hasText(key)) {
            throw new VacademyException("Stripe API key is missing.");
        }
        return key;
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

    private Map<String, Object> buildStripeCustomerParams(UserDTO user, PaymentInitiationRequestDTO request) {
        Map<String, Object> params = new HashMap<>();
        params.put("email", user.getEmail());
        params.put("name", user.getFullName());

        if (StringUtils.hasText(user.getMobileNumber())) {
            params.put("phone", user.getMobileNumber());
        }

        StripeRequestDTO stripeRequest = request.getStripeRequest();
        if (stripeRequest != null && StringUtils.hasText(stripeRequest.getPaymentMethodId())) {
            params.put("payment_method", stripeRequest.getPaymentMethodId());
            params.put("invoice_settings", Map.of("default_payment_method", stripeRequest.getPaymentMethodId()));
        }
        return params;
    }

    private Map<String, Object> buildStripeCustomerParamsForUnknownUser(String email,
                                                                        PaymentInitiationRequestDTO request) {
        Map<String, Object> params = new HashMap<>();
        params.put("email", email);
        params.put("name", "Anonymous User");

        StripeRequestDTO stripeRequest = request.getStripeRequest();
        if (stripeRequest != null && StringUtils.hasText(stripeRequest.getPaymentMethodId())) {
            params.put("payment_method", stripeRequest.getPaymentMethodId());
            params.put("invoice_settings", Map.of("default_payment_method", stripeRequest.getPaymentMethodId()));
        }
        return params;
    }

    private Map<String, Object> buildCustomerResponse(Customer stripeCustomer) {
        StripeCustomerDTO dto = new StripeCustomerDTO();
        dto.setId(stripeCustomer.getId());
        dto.setEmail(stripeCustomer.getEmail());
        dto.setName(stripeCustomer.getName());
        dto.setPhone(stripeCustomer.getPhone());
        dto.setCreated(stripeCustomer.getCreated());
        dto.setInvoicePrefix(stripeCustomer.getInvoicePrefix());
        dto.setLivemode(stripeCustomer.getLivemode());

        Map<String, Object> response = new HashMap<>();
        response.put("customerId", stripeCustomer.getId());
        response.put("customerData", dto);
        return response;
    }

    // --- Deprecated Invoice Methods (kept from original file) ---
    // Note: The methods below are for the old, multi-step invoice flow.
    // They are no longer used by the new `initiatePayment` method.

    private void createInvoiceItem(StripeRequestDTO stripeRequestDTO, long amountInCents,
                                   PaymentInitiationRequestDTO request) throws StripeException {
        if (amountInCents <= 0) {
            throw new VacademyException("Invoice item amount must be greater than 0");
        }
        Map<String, Object> invoiceItemParams = new HashMap<>();
        invoiceItemParams.put("customer", stripeRequestDTO.getCustomerId());
        invoiceItemParams.put("amount", amountInCents);
        invoiceItemParams.put("currency", request.getCurrency().toLowerCase());
        invoiceItemParams.put("description",
                request.getDescription() != null ? request.getDescription() : "No description");
        invoiceItemParams.put("metadata",
                Map.of("orderId", request.getOrderId(), "instituteId", request.getInstituteId()));
        InvoiceItem.create(invoiceItemParams);
    }

    private Invoice createAndAutoChargeInvoice(StripeRequestDTO stripeRequestDTO, PaymentInitiationRequestDTO request)
            throws StripeException {
        Map<String, Object> invoiceParams = new HashMap<>();
        invoiceParams.put("customer", stripeRequestDTO.getCustomerId());
        invoiceParams.put("collection_method", "charge_automatically");
        invoiceParams.put("pending_invoice_items_behavior", "include");
        invoiceParams.put("auto_advance", true);
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("orderId", request.getOrderId());
        metadata.put("instituteId", request.getInstituteId());
        invoiceParams.put("metadata", metadata);

        if (StringUtils.hasText(stripeRequestDTO.getPaymentMethodId())) {
            invoiceParams.put("default_payment_method", stripeRequestDTO.getPaymentMethodId());
        } else {
            throw new VacademyException("Payment method required for automatic payments.");
        }
        Invoice invoice = Invoice.create(invoiceParams);
        return invoice.finalizeInvoice();
    }

    private PaymentResponseDTO buildPaymentResponse(Invoice invoice) {
        Map<String, Object> response = new HashMap<>();
        response.put("invoiceId", invoice.getId());
        response.put("invoicePdfUrl", invoice.getInvoicePdf());
        response.put("invoice", invoice.toJson());
        response.put("dueDate", invoice.getDueDate());
        response.put("status", invoice.getStatus());
        response.put("description", invoice.getDescription());
        response.put("paymentUrl", invoice.getHostedInvoiceUrl());
        PaymentStatusEnum paymentStatus = invoice.getPaid()
                ? PaymentStatusEnum.PAID
                : PaymentStatusEnum.PAYMENT_PENDING;
        response.put("paymentStatus", paymentStatus.name());
        response.put("paidAt", invoice.getStatusTransitions() != null
                ? invoice.getStatusTransitions().getPaidAt()
                : null);

        if (invoice.getCustomer() != null) {
            try {
                Customer customer = Customer.retrieve(invoice.getCustomer());
                response.put("customerEmail", customer.getEmail());
            } catch (Exception e) {
                logger.warn("Could not retrieve customer email from Stripe", e);
            }
        }
        PaymentResponseDTO dto = new PaymentResponseDTO();
        dto.setResponseData(response);
        dto.setOrderId(
                invoice.getMetadata().get("orderId") != null ? invoice.getMetadata().get("orderId").toString() : null);
        return dto;
    }
}