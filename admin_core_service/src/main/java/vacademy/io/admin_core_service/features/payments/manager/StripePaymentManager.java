package vacademy.io.admin_core_service.features.payments.manager;

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
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

@Service
public class StripePaymentManager implements PaymentServiceStrategy {

    private static final Logger logger = LoggerFactory.getLogger(StripePaymentManager.class);

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
        logger.info("Initiating Stripe payment for user: {}", user.getId());

        try {
            validateRequest(request);
            String apiKey = extractApiKey(paymentGatewaySpecificData);
            Stripe.apiKey = apiKey;

            StripeRequestDTO stripeRequestDTO = request.getStripeRequest();

            long amountInCents = convertAmountToCents(request.getAmount());
            logger.debug("Amount in cents: {}", amountInCents);

            attachPaymentMethodIfNeeded(stripeRequestDTO.getCustomerId(), stripeRequestDTO.getPaymentMethodId());

            createInvoiceItem(stripeRequestDTO, amountInCents, request);
            Invoice invoice = createAndAutoChargeInvoice(stripeRequestDTO, request);

            return buildPaymentResponse(invoice);

        } catch (StripeException e) {
            logger.error("Stripe error during payment initiation: {}", e.getMessage(), e);
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
        invoiceItemParams.put("metadata", Map.of("orderId",request.getOrderId(),"instituteId",request.getInstituteId()));
        logger.debug("Creating invoice item with params: {}", invoiceItemParams);
        InvoiceItem invoiceItem = InvoiceItem.create(invoiceItemParams);
        logger.info("Invoice item created with ID: {}", invoiceItem.getId());
    }

    private Invoice createAndAutoChargeInvoice(StripeRequestDTO stripeRequestDTO, PaymentInitiationRequestDTO request) throws StripeException {
        Map<String, Object> invoiceParams = new HashMap<>();
        invoiceParams.put("customer", stripeRequestDTO.getCustomerId());
        invoiceParams.put("collection_method", "charge_automatically");
        invoiceParams.put("pending_invoice_items_behavior", "include");
        invoiceParams.put("auto_advance", false); // Disable auto_advance so we manually finalize right after

        if (StringUtils.hasText(stripeRequestDTO.getPaymentMethodId())) {
            invoiceParams.put("default_payment_method", stripeRequestDTO.getPaymentMethodId());
        } else {
            throw new VacademyException("Payment method required for automatic payments.");
        }

        logger.debug("Creating invoice with params: {}", invoiceParams);
        Invoice invoice = Invoice.create(invoiceParams);

        // Manually finalize immediately so we get hosted_invoice_url and invoice_pdf
        invoice = invoice.finalizeInvoice();

        logger.info("Invoice finalized: {}, hosted_url: {}, pdf: {}", invoice.getId(), invoice.getHostedInvoiceUrl(), invoice.getInvoicePdf());

        return invoice;
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
        response.put("paymentUrl", invoice.getHostedInvoiceUrl()); // Include this explicitly
        System.out.println(invoice);
        PaymentStatusEnum paymentStatus = invoice.getPaid()
                ? PaymentStatusEnum.PAID
                : PaymentStatusEnum.PAYMENT_PENDING;
        response.put("paymentStatus", paymentStatus.name());

        response.put("paidAt", invoice.getStatusTransitions() != null
                ? invoice.getStatusTransitions().getPaidAt()
                : null);

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
