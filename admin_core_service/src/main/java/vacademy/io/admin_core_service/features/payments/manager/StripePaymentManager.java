package vacademy.io.admin_core_service.features.payments.service;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.*;
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

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class StripePaymentService implements PaymentServiceStrategy {

    private static final Logger logger = LoggerFactory.getLogger(StripePaymentService.class);

    @Override
    public Map<String, Object> createCustomer(UserDTO user, PaymentInitiationRequestDTO request, Map<String, Object> paymentGatewaySpecificData) {
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

    @Override
    public PaymentResponseDTO initiatePayment(UserDTO user, PaymentInitiationRequestDTO request, Map<String, Object> paymentGatewaySpecificData) {
        logger.info("Starting payment initiation for user: {}", user.getId());

        try {
            validateRequest(request);
            String apiKey = extractApiKey(paymentGatewaySpecificData);
            Stripe.apiKey = apiKey;

            StripeRequestDTO stripeRequestDTO = request.getStripeRequest();

            logger.debug("Raw request amount: {}", request.getAmount());
            long amountInCents = convertAmountToCents(request.getAmount());
            logger.debug("Converted amount in cents: {}", amountInCents);

            attachPaymentMethodIfNeeded(stripeRequestDTO.getCustomerId(), stripeRequestDTO.getPaymentMethodId());

            createInvoiceItem(stripeRequestDTO, amountInCents, request);
            Invoice invoice = createAndFinalizeInvoice(stripeRequestDTO, request);
            System.out.println(invoice);
            return buildPaymentResponse(invoice);

        } catch (StripeException e) {
            logger.error("StripeException during payment initiation: {}", e.getMessage(), e);
            throw new VacademyException("Stripe error: " + e.getMessage());
        }
    }

    private long convertAmountToCents(double amount) {
        return BigDecimal.valueOf(amount)
                .multiply(BigDecimal.valueOf(100))
                .setScale(0, RoundingMode.HALF_UP)
                .longValue();
    }

    private void createInvoiceItem(StripeRequestDTO stripeRequestDTO, long amountInCents, PaymentInitiationRequestDTO request) throws StripeException {
        if (amountInCents <= 0) {
            throw new VacademyException("Invoice item amount must be greater than 0");
        }

        Map<String, Object> invoiceItemParams = new HashMap<>();
        invoiceItemParams.put("customer", stripeRequestDTO.getCustomerId());
        invoiceItemParams.put("amount", amountInCents);
        invoiceItemParams.put("currency", request.getCurrency().toLowerCase());
        invoiceItemParams.put("description", request.getDescription() != null ? request.getDescription() : "No description");
        invoiceItemParams.put("metadata", Map.of("order_id",request.getOrderId()));
        logger.debug("Creating invoice item with params: {}", invoiceItemParams);
        InvoiceItem invoiceItem = InvoiceItem.create(invoiceItemParams);
        logger.info("Invoice item created with ID: {}", invoiceItem.getId());
    }

    private Invoice createAndFinalizeInvoice(StripeRequestDTO stripeRequestDTO, PaymentInitiationRequestDTO request) throws StripeException {
        Map<String, Object> invoiceParams = new HashMap<>();
        invoiceParams.put("customer", stripeRequestDTO.getCustomerId());
        invoiceParams.put("collection_method", request.isChargeAutomatically() ? "charge_automatically" : "send_invoice");
        invoiceParams.put("pending_invoice_items_behavior", "include");
        invoiceParams.put("auto_advance", false); // Turn off auto_advance for manual finalization

        if (!request.isChargeAutomatically()) {
            invoiceParams.put("days_until_due", 7);
        }

        if (StringUtils.hasText(stripeRequestDTO.getPaymentMethodId())) {
            invoiceParams.put("default_payment_method", stripeRequestDTO.getPaymentMethodId());
        }

        logger.debug("Creating invoice with params: {}", invoiceParams);
        Invoice invoice = Invoice.create(invoiceParams);
        logger.info("Draft invoice created: {}", invoice.getId());

        Invoice finalizedInvoice = invoice.finalizeInvoice();
        logger.info("Invoice finalized: {}", finalizedInvoice.getId());

        return finalizedInvoice;
    }

    private void attachPaymentMethodIfNeeded(String customerId, String paymentMethodId) throws StripeException {
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

    private PaymentResponseDTO buildPaymentResponse(Invoice invoice) {
        Map<String, Object> response = new HashMap<>();
        response.put("invoiceId", invoice.getId());
        response.put("invoicePdfUrl", invoice.getInvoicePdf());
        response.put("invoice", invoice.toJson());
        response.put("dueDate", invoice.getDueDate());
        response.put("status", invoice.getStatus());
        response.put("description", invoice.getDescription());
        response.put("paymentUrl", invoice.getHostedInvoiceUrl());
        response.put("paymentStatus", invoice.getPaid());
        response.put("paidAt", invoice.getStatusTransitions().getPaidAt());

        PaymentResponseDTO dto = new PaymentResponseDTO();
        dto.setResponseData(response);
        logger.debug("Built payment response: {}", dto);
        return dto;
    }

    private void validateRequest(PaymentInitiationRequestDTO request) {
        StripeRequestDTO stripeRequestDTO = request.getStripeRequest();

        if (stripeRequestDTO == null || !StringUtils.hasText(stripeRequestDTO.getCustomerId())) {
            throw new VacademyException("Missing Stripe customer ID.");
        }

        if (request.isChargeAutomatically() && !StringUtils.hasText(stripeRequestDTO.getPaymentMethodId())) {
            throw new VacademyException("Payment method required for automatic payments.");
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
}
