package vacademy.io.admin_core_service.features.payments.manager;

import com.razorpay.Customer;
import com.razorpay.Order;
import com.razorpay.Payment;
import com.razorpay.PaymentLink;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import org.json.JSONObject;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.payments.dto.RazorpayCustomerDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.MandateInfo;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.logging.SentryLogger;
import vacademy.io.common.payment.currency.CurrencyRegistry;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.dto.RazorpayRequestDTO;
import vacademy.io.common.payment.enums.PaymentStatusEnum;
import vacademy.io.common.payment.enums.PaymentType;

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

            long amountInPaise = CurrencyRegistry.toMinorUnits(request.getAmount(), request.getCurrency());

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
            // A gateway failure here falls back to creating a new customer; surface it so
            // duplicate-customer creation isn't silently masking Razorpay outages.
            SentryLogger.logWarning(e, "Razorpay customer lookup by email failed", Map.of(
                    "payment.gateway", "RAZORPAY",
                    "operation", "findCustomerByEmail"
            ));
            return null;
        }
    }

    // ── Recurring / mandate (autopay) ──────────────────────────────────────

    /**
     * First payment that also registers a UPI-Autopay / card e-mandate. Same as
     * a normal order but attaches the customer and a {@code token} block
     * carrying the app-computed {@code max_amount} (in paise) and frequency, so
     * Razorpay authenticates a mandate (not just a saved card). The frontend
     * must open Checkout with {@code recurring: 1} + this {@code customer_id};
     * the confirmed {@code token_id} arrives on the webhook and is persisted as
     * the mandate. Requires {@code request.razorpayRequest.customerId}.
     */
    @Override
    public PaymentResponseDTO initiateMandatePayment(UserDTO user, PaymentInitiationRequestDTO request,
            Map<String, Object> paymentGatewaySpecificData) {
        try {
            validateRequest(request);
            RazorpayRequestDTO rr = request.getRazorpayRequest();
            if (rr == null || !StringUtils.hasText(rr.getCustomerId())) {
                throw new VacademyException("Razorpay mandate registration requires a customerId");
            }
            RazorpayClient razorpayClient = createRazorpayClient(paymentGatewaySpecificData);
            long amountInPaise = CurrencyRegistry.toMinorUnits(request.getAmount(), request.getCurrency());
            long maxAmountPaise = rr.getMandateMaxAmount() != null
                    ? CurrencyRegistry.toMinorUnits(rr.getMandateMaxAmount(), request.getCurrency())
                    : amountInPaise;

            JSONObject orderRequest = new JSONObject();
            orderRequest.put("amount", amountInPaise);
            orderRequest.put("currency", request.getCurrency().toUpperCase());
            orderRequest.put("receipt", request.getOrderId());
            orderRequest.put("customer_id", rr.getCustomerId());
            orderRequest.put("payment_capture", 1);

            JSONObject token = new JSONObject();
            token.put("max_amount", maxAmountPaise);
            token.put("frequency", StringUtils.hasText(rr.getMandateFrequency())
                    ? rr.getMandateFrequency() : "as_presented");
            orderRequest.put("token", token);

            JSONObject notes = new JSONObject();
            notes.put("orderId", request.getOrderId());
            notes.put("instituteId", request.getInstituteId());
            notes.put("payment_type", request.getPaymentType() != null
                    ? request.getPaymentType().name() : PaymentType.INITIAL.name());
            orderRequest.put("notes", notes);

            Order order = razorpayClient.orders.create(orderRequest);
            PaymentResponseDTO dto = buildPaymentResponseFromOrder(order, request, paymentGatewaySpecificData);
            // Signal the frontend to run Checkout in recurring/mandate mode.
            dto.getResponseData().put("recurring", 1);
            dto.getResponseData().put("customerId", rr.getCustomerId());
            dto.getResponseData().put("mandateMaxAmount", maxAmountPaise);
            return dto;
        } catch (RazorpayException e) {
            throw new VacademyException("Error initiating Razorpay mandate payment: " + e.getMessage());
        }
    }

    /**
     * Off-session recurring charge against a registered Razorpay mandate token.
     * Creates a fresh order for the renewal amount then submits a recurring
     * payment on the stored token. Capture confirmation still arrives via the
     * RENEWAL webhook. {@code max_amount} is enforced app-side first.
     */
    @Override
    public PaymentResponseDTO chargeRecurring(MandateInfo mandate, PaymentInitiationRequestDTO request,
            Map<String, Object> paymentGatewaySpecificData) {
        if (mandate == null || !StringUtils.hasText(mandate.getProviderRef())
                || !StringUtils.hasText(mandate.getCustomerId())) {
            throw new VacademyException("Razorpay recurring charge requires a customerId + token mandate");
        }
        if (mandate.getMaxAmount() != null && request.getAmount() > mandate.getMaxAmount()) {
            throw new VacademyException("Razorpay recurring amount " + request.getAmount()
                    + " exceeds mandate max_amount " + mandate.getMaxAmount());
        }
        try {
            RazorpayClient razorpayClient = createRazorpayClient(paymentGatewaySpecificData);
            long amountInPaise = CurrencyRegistry.toMinorUnits(request.getAmount(), request.getCurrency());

            JSONObject orderRequest = new JSONObject();
            orderRequest.put("amount", amountInPaise);
            orderRequest.put("currency", request.getCurrency().toUpperCase());
            orderRequest.put("receipt", request.getOrderId());
            orderRequest.put("payment_capture", 1);
            JSONObject notes = new JSONObject();
            notes.put("orderId", request.getOrderId());
            notes.put("instituteId", request.getInstituteId());
            notes.put("payment_type", PaymentType.RENEWAL.name());
            orderRequest.put("notes", notes);
            Order order = razorpayClient.orders.create(orderRequest);

            JSONObject rec = new JSONObject();
            rec.put("email", request.getEmail());
            if (StringUtils.hasText(request.getVendorId())) {
                rec.put("contact", request.getVendorId());
            }
            rec.put("amount", amountInPaise);
            rec.put("currency", request.getCurrency().toUpperCase());
            rec.put("order_id", order.get("id").toString());
            rec.put("customer_id", mandate.getCustomerId());
            rec.put("token", mandate.getProviderRef());
            rec.put("recurring", "1");
            rec.put("notes", notes);

            Payment payment = razorpayClient.payments.createRecurringPayment(rec);

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("razorpayOrderId", order.get("id"));
            responseData.put("razorpayPaymentId", payment.has("id") ? payment.get("id") : null);
            String status = payment.has("status") && payment.get("status") != null
                    ? payment.get("status").toString() : "created";
            responseData.put("status", status);
            PaymentStatusEnum paymentStatus = ("captured".equalsIgnoreCase(status) || "authorized".equalsIgnoreCase(status))
                    ? PaymentStatusEnum.PAID : PaymentStatusEnum.PAYMENT_PENDING;
            responseData.put("paymentStatus", paymentStatus.name());

            PaymentResponseDTO dto = new PaymentResponseDTO();
            dto.setResponseData(responseData);
            dto.setOrderId(request.getOrderId());
            dto.setMessage("Recurring payment submitted");
            return dto;
        } catch (RazorpayException e) {
            throw new VacademyException("Error charging Razorpay recurring payment: " + e.getMessage());
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
        notes.put("payment_type",
                request.getPaymentType() != null ? request.getPaymentType().name() : PaymentType.INITIAL.name());

        if (StringUtils.hasText(request.getDescription())) {
            notes.put("description", request.getDescription());
        }

        if (request.getRazorpayRequest() != null) {
            String applicantId = request.getRazorpayRequest().getApplicantId();
            if (StringUtils.hasText(applicantId)) {
                notes.put("applicantId", applicantId);
            }
            String optionId = request.getRazorpayRequest().getPaymentOptionId();
            if (StringUtils.hasText(optionId)) {
                notes.put("paymentOptionId", optionId);
            }
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
            responseData.put("createdAt",
                    order.has("created_at") ? order.get("created_at") : System.currentTimeMillis() / 1000);

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

    /**
     * Create a Razorpay-hosted Payment Link (rzp.io/i/…) for this request.
     *
     * Used by the AI-credit top-up: the platform serves the admin app on many
     * white-labelled custom domains, which Razorpay won't let checkout.js run on.
     * Payment instead happens on Razorpay's own (always-allowed) hosted page, and
     * on success the browser is redirected to {@code callbackUrl} — back on the
     * originating admin domain.
     *
     * The link carries the SAME notes (orderId / instituteId / payment_type) as
     * {@link #createRazorpayOrder}, so the existing {@code payment.captured}
     * webhook grants credits with zero changes — fulfillment never moves.
     *
     * @return map with {@code paymentLinkId}, {@code paymentLinkUrl} (short_url),
     *         {@code razorpayKeyId}
     */
    public Map<String, Object> createPaymentLink(UserDTO user, PaymentInitiationRequestDTO request,
            Map<String, Object> paymentGatewaySpecificData, String callbackUrl) {
        try {
            validateRequest(request);
            RazorpayClient razorpayClient = createRazorpayClient(paymentGatewaySpecificData);
            long amountInPaise = CurrencyRegistry.toMinorUnits(request.getAmount(), request.getCurrency());

            JSONObject plReq = new JSONObject();
            plReq.put("amount", amountInPaise);
            plReq.put("currency", request.getCurrency().toUpperCase());
            plReq.put("accept_partial", false);
            // reference_id must be unique per link — our platform_payment_id is.
            plReq.put("reference_id", request.getOrderId());
            if (StringUtils.hasText(request.getDescription())) {
                plReq.put("description", request.getDescription());
            }

            // Prefill the payer (best-effort — Razorpay still collects on its page).
            JSONObject customer = new JSONObject();
            if (user != null) {
                if (StringUtils.hasText(user.getFullName())) customer.put("name", user.getFullName());
                if (StringUtils.hasText(user.getEmail())) customer.put("email", user.getEmail());
                if (StringUtils.hasText(user.getMobileNumber())) customer.put("contact", user.getMobileNumber());
            } else if (StringUtils.hasText(request.getEmail())) {
                customer.put("email", request.getEmail());
            }
            if (customer.length() > 0) {
                plReq.put("customer", customer);
            }

            // We drive the return + balance refresh ourselves; suppress Razorpay's
            // own SMS/email so the user isn't double-notified.
            JSONObject notify = new JSONObject();
            notify.put("sms", false);
            notify.put("email", false);
            plReq.put("notify", notify);
            plReq.put("reminder_enable", false);

            // notes MUST mirror createRazorpayOrder so PlatformRazorpayWebHookService
            // (keyed on notes.orderId + notes.payment_type) grants exactly as today.
            JSONObject notes = new JSONObject();
            notes.put("orderId", request.getOrderId());
            notes.put("instituteId", request.getInstituteId());
            notes.put("payment_type", request.getPaymentType() != null
                    ? request.getPaymentType().name() : PaymentType.INITIAL.name());
            if (StringUtils.hasText(request.getDescription())) {
                notes.put("description", request.getDescription());
            }
            plReq.put("notes", notes);

            if (StringUtils.hasText(callbackUrl)) {
                plReq.put("callback_url", callbackUrl);
                plReq.put("callback_method", "get");
            }

            PaymentLink paymentLink = razorpayClient.paymentLink.create(plReq);

            Map<String, Object> out = new HashMap<>();
            out.put("paymentLinkId", paymentLink.has("id") ? paymentLink.get("id") : null);
            out.put("paymentLinkUrl", paymentLink.has("short_url") ? paymentLink.get("short_url") : null);
            out.put("razorpayKeyId", extractApiKey(paymentGatewaySpecificData));
            return out;

        } catch (RazorpayException e) {
            throw new VacademyException("Error creating Razorpay payment link: " + e.getMessage());
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
                    ? razorpayCustomer.get("name").toString()
                    : null);
            dto.setEmail(razorpayCustomer.has("email") && razorpayCustomer.get("email") != null
                    ? razorpayCustomer.get("email").toString()
                    : null);
            dto.setContact(razorpayCustomer.has("contact") && razorpayCustomer.get("contact") != null
                    ? razorpayCustomer.get("contact").toString()
                    : null);
            dto.setGstin(razorpayCustomer.has("gstin") && razorpayCustomer.get("gstin") != null
                    ? razorpayCustomer.get("gstin").toString()
                    : null);

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
