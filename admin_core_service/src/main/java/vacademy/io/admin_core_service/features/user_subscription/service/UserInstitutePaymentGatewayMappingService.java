package vacademy.io.admin_core_service.features.user_subscription.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.user_subscription.dto.MandateInfo;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserInstitutePaymentGatewayMapping;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserInstitutePaymentGatewayMappingRepository;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class UserInstitutePaymentGatewayMappingService {

    private static final Logger logger = LoggerFactory.getLogger(UserInstitutePaymentGatewayMappingService.class);

    @Autowired
    private UserInstitutePaymentGatewayMappingRepository userInstitutePaymentGatewayMappingRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;

    public Optional<UserInstitutePaymentGatewayMapping> findByUserIdAndInstituteId(String userId, String instituteId,String vendorId) {
        return userInstitutePaymentGatewayMappingRepository.findByUserIdAndInstituteIdAndVendorAndStatuses(userId,instituteId,vendorId, List.of(StatusEnum.ACTIVE.name()),List.of(StatusEnum.ACTIVE.name()));
    }

    public UserInstitutePaymentGatewayMapping saveUserInstituteVendorMapping(String userId, String instituteId,
            String vendor,
            String paymentGatewayCustomerId,
            Object paymentGatewaySpecificData) {
        UserInstitutePaymentGatewayMapping mapping = new UserInstitutePaymentGatewayMapping();
        mapping.setUserId(userId);
        mapping.setInstitutePaymentGatewayMapping(
                institutePaymentGatewayMappingService.findByInstituteIdAndVendor(instituteId, vendor));
        mapping.setPaymentGatewayCustomerId(paymentGatewayCustomerId);
        mapping.setStatus(StatusEnum.ACTIVE.name());

        try {
            String jsonData = objectMapper.writeValueAsString(paymentGatewaySpecificData);
            mapping.setPaymentGatewayCustomerData(jsonData);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize payment gateway data to JSON", e);
        }

        return userInstitutePaymentGatewayMappingRepository.save(mapping);
    }

    @Transactional
    public void savePaymentMethodInCustomerData(String userId, String instituteId, String vendor,
                                                String paymentMethodId, String paymentMethodType,
                                                String cardLast4, String cardBrand) {
        logger.info("Saving payment method for user: {}, institute: {}, vendor: {}", 
                   userId, instituteId, vendor);

        try {
            // Find existing mapping
            Optional<UserInstitutePaymentGatewayMapping> mappingOptional = 
                findByUserIdAndInstituteId(userId, instituteId, vendor);

            if (!mappingOptional.isPresent()) {
                logger.warn("No payment gateway mapping found for user: {}, institute: {}, vendor: {}. " +
                           "Cannot save payment method.", userId, instituteId, vendor);
                return;
            }

            UserInstitutePaymentGatewayMapping mapping = mappingOptional.get();

            // Parse existing JSON data
            Map<String, Object> customerData = parseCustomerDataJson(mapping.getPaymentGatewayCustomerData());

            // Add payment method information
            customerData.put("paymentMethodId", paymentMethodId);
            customerData.put("paymentMethodType", paymentMethodType);
            customerData.put("cardLast4", cardLast4);
            customerData.put("cardBrand", cardBrand);
            customerData.put("paymentMethodUpdatedAt", LocalDateTime.now().toString());

            // Convert back to JSON and save
            String updatedJson = objectMapper.writeValueAsString(customerData);
            mapping.setPaymentGatewayCustomerData(updatedJson);
            userInstitutePaymentGatewayMappingRepository.save(mapping);

            logger.info("Payment method saved successfully: {} for user: {}", paymentMethodId, userId);

        } catch (Exception e) {
            logger.error("Failed to save payment method for user: {}, vendor: {}", userId, vendor, e);
            // Don't throw exception - payment already processed, this is just metadata
        }
    }


    public String getPaymentMethodId(String userId, String instituteId, String vendor) {
        logger.debug("Retrieving payment method for user: {}, institute: {}, vendor: {}", 
                    userId, instituteId, vendor);

        try {
            Optional<UserInstitutePaymentGatewayMapping> mappingOptional = 
                findByUserIdAndInstituteId(userId, instituteId, vendor);

            if (!mappingOptional.isPresent()) {
                logger.warn("No mapping found for user: {}, institute: {}, vendor: {}", 
                           userId, instituteId, vendor);
                return null;
            }

            UserInstitutePaymentGatewayMapping mapping = mappingOptional.get();
            String customerDataJson = mapping.getPaymentGatewayCustomerData();

            if (customerDataJson == null || customerDataJson.isEmpty()) {
                logger.debug("No customer data JSON for user: {}", userId);
                return null;
            }

            Map<String, Object> customerData = parseCustomerDataJson(customerDataJson);
            String paymentMethodId = (String) customerData.get("paymentMethodId");

            if (paymentMethodId != null) {
                logger.debug("Found payment method: {} for user: {}", paymentMethodId, userId);
            } else {
                logger.debug("No payment method found in JSON for user: {}", userId);
            }

            return paymentMethodId;

        } catch (Exception e) {
            logger.error("Error retrieving payment method for user: {}", userId, e);
            return null;
        }
    }

    public Map<String, Object> getPaymentMethodDetails(String userId, String instituteId, String vendor) {
        logger.debug("Retrieving payment method details for user: {}, vendor: {}", userId, vendor);

        Map<String, Object> paymentMethodDetails = new HashMap<>();

        try {
            Optional<UserInstitutePaymentGatewayMapping> mappingOptional = 
                findByUserIdAndInstituteId(userId, instituteId, vendor);

            if (!mappingOptional.isPresent()) {
                return paymentMethodDetails;
            }

            UserInstitutePaymentGatewayMapping mapping = mappingOptional.get();
            Map<String, Object> customerData = parseCustomerDataJson(mapping.getPaymentGatewayCustomerData());

            // Extract payment method fields if they exist
            if (customerData.containsKey("paymentMethodId")) {
                paymentMethodDetails.put("paymentMethodId", customerData.get("paymentMethodId"));
                paymentMethodDetails.put("paymentMethodType", customerData.get("paymentMethodType"));
                paymentMethodDetails.put("cardLast4", customerData.get("cardLast4"));
                paymentMethodDetails.put("cardBrand", customerData.get("cardBrand"));
                paymentMethodDetails.put("paymentMethodUpdatedAt", customerData.get("paymentMethodUpdatedAt"));
            }

            return paymentMethodDetails;

        } catch (Exception e) {
            logger.error("Error retrieving payment method details for user: {}", userId, e);
            return paymentMethodDetails;
        }
    }

    // ── Recurring-payment mandates (stored per userPlanId in the same JSON) ──
    //
    // Layout inside payment_gateway_customer_data:
    //   { "customerId": "...", "mandates": { "<userPlanId>": { ...MandateInfo } } }
    // Read as a Map (parseCustomerDataJson), so adding this key never breaks the
    // existing bare-token / saved-card reads.

    private static final String MANDATES_KEY = "mandates";

    /**
     * Insert or replace the mandate for a given plan. A learner can hold one
     * mandate per plan in the same institute (multiple paid courses → multiple
     * mandates), so they are keyed by userPlanId and never overwrite each other.
     */
    @Transactional
    public void upsertMandate(String userId, String instituteId, String vendor,
                              String userPlanId, MandateInfo mandate) {
        Optional<UserInstitutePaymentGatewayMapping> mappingOptional =
                findByUserIdAndInstituteId(userId, instituteId, vendor);
        if (mappingOptional.isEmpty()) {
            logger.warn("No payment gateway mapping for user: {}, institute: {}, vendor: {} — cannot save mandate for plan {}",
                    userId, instituteId, vendor, userPlanId);
            return;
        }
        UserInstitutePaymentGatewayMapping mapping = mappingOptional.get();
        try {
            Map<String, Object> customerData = parseCustomerDataJson(mapping.getPaymentGatewayCustomerData());
            @SuppressWarnings("unchecked")
            Map<String, Object> mandates = (Map<String, Object>) customerData
                    .computeIfAbsent(MANDATES_KEY, k -> new HashMap<String, Object>());
            mandate.setUpdatedAt(LocalDateTime.now().toString());
            mandates.put(userPlanId, objectMapper.convertValue(mandate, Map.class));
            mapping.setPaymentGatewayCustomerData(objectMapper.writeValueAsString(customerData));
            userInstitutePaymentGatewayMappingRepository.save(mapping);
            logger.info("Saved mandate (status={}) for user: {}, plan: {}", mandate.getStatus(), userId, userPlanId);
        } catch (Exception e) {
            logger.error("Failed to save mandate for user: {}, plan: {}", userId, userPlanId, e);
        }
    }

    /** Returns the mandate for a plan, or null if none / not parseable. */
    public MandateInfo getMandate(String userId, String instituteId, String vendor, String userPlanId) {
        Optional<UserInstitutePaymentGatewayMapping> mappingOptional =
                findByUserIdAndInstituteId(userId, instituteId, vendor);
        if (mappingOptional.isEmpty()) {
            return null;
        }
        Map<String, Object> customerData = parseCustomerDataJson(mappingOptional.get().getPaymentGatewayCustomerData());
        Object mandates = customerData.get(MANDATES_KEY);
        if (!(mandates instanceof Map)) {
            return null;
        }
        Object entry = ((Map<?, ?>) mandates).get(userPlanId);
        if (entry == null) {
            return null;
        }
        try {
            return objectMapper.convertValue(entry, MandateInfo.class);
        } catch (Exception e) {
            logger.error("Failed to parse mandate for user: {}, plan: {}", userId, userPlanId, e);
            return null;
        }
    }

    /**
     * Resolve a chargeable mandate for a plan, falling back to a pre-existing
     * saved token for providers whose stored customer id IS the chargeable token
     * (eWay TokenCustomerID). This lets existing autopay-enabled eWay customers —
     * who have a token in the bare payment_gateway_customer_id column but no
     * per-plan mandate JSON yet — be auto-renewed without a fresh registration.
     *
     * For token/e-mandate providers (Razorpay) the bare customer id is NOT
     * chargeable on its own (a token_id is required), so no fallback is returned;
     * those must have a real registered mandate.
     */
    public MandateInfo getMandateOrLegacyToken(String userId, String instituteId, String vendor, String userPlanId) {
        MandateInfo mandate = getMandate(userId, instituteId, vendor, userPlanId);
        if (mandate != null) {
            return mandate;
        }
        // Fallback only for card-on-file providers where customerId == the chargeable token.
        if (vendor == null || !"EWAY".equalsIgnoreCase(vendor)) {
            return null;
        }
        Optional<UserInstitutePaymentGatewayMapping> mappingOptional =
                findByUserIdAndInstituteId(userId, instituteId, vendor);
        if (mappingOptional.isEmpty()) {
            return null;
        }
        String tokenCustomerId = mappingOptional.get().getPaymentGatewayCustomerId();
        if (tokenCustomerId == null || tokenCustomerId.trim().isEmpty()) {
            return null;
        }
        logger.info("Using legacy eWay TokenCustomerID as mandate for user: {}, plan: {}", userId, userPlanId);
        return MandateInfo.builder()
                .vendor(vendor)
                .customerId(tokenCustomerId)
                .providerRef(tokenCustomerId)
                .status(MandateInfo.STATUS_ACTIVE)
                .build();
    }

    /**
     * Mark a plan's mandate as REVOKED (learner cancelled autopay). Does NOT
     * touch the plan's access window — the caller keeps access until end_date.
     * No-op if there is no mandate for the plan.
     */
    @Transactional
    public void revokeMandate(String userId, String instituteId, String vendor, String userPlanId) {
        MandateInfo mandate = getMandate(userId, instituteId, vendor, userPlanId);
        if (mandate == null) {
            logger.info("No mandate to revoke for user: {}, plan: {}", userId, userPlanId);
            return;
        }
        mandate.setStatus(MandateInfo.STATUS_REVOKED);
        upsertMandate(userId, instituteId, vendor, userPlanId, mandate);
    }

    /**
     * Helper method to parse customer data JSON string into a Map.
     * Returns empty map if JSON is null, empty, or invalid.
     *
     * @param customerDataJson JSON string
     * @return Map representation of JSON
     */
    private Map<String, Object> parseCustomerDataJson(String customerDataJson) {
        if (customerDataJson == null || customerDataJson.trim().isEmpty()) {
            return new HashMap<>();
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> customerData = objectMapper.readValue(customerDataJson, Map.class);
            return customerData != null ? customerData : new HashMap<>();
        } catch (JsonProcessingException e) {
            logger.error("Failed to parse customer data JSON: {}", e.getMessage());
            return new HashMap<>();
        }
    }
}
