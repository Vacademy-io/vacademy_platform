package vacademy.io.admin_core_service.features.migration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.institute.entity.InstitutePaymentGatewayMapping;
import vacademy.io.admin_core_service.features.institute.repository.InstitutePaymentGatewayMappingRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.migration.dto.KeapPaymentDTO;
import vacademy.io.admin_core_service.features.migration.dto.KeapUserDTO;
import vacademy.io.admin_core_service.features.migration.entity.MigrationStagingKeapPayment;
import vacademy.io.admin_core_service.features.migration.entity.MigrationStagingKeapUser;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import java.util.Random;

@Service
@Slf4j
public class IndividualMemberKeapMigrationService {

    @Autowired
    private AuthService authService;

    @Autowired
    private InstituteStudentRepository studentRepository;

    @Autowired
    private UserPlanRepository userPlanRepository;

    @Autowired
    private StudentSessionInstituteGroupMappingRepository ssigmRepository;

    @Autowired
    private PaymentLogRepository paymentLogRepository;

    @Autowired
    private IndividualMemberKeapStagingService stagingService;

    @Autowired
    private EnrollInviteRepository enrollInviteRepository;

    @Autowired
    private InstitutePaymentGatewayMappingRepository institutePaymentGatewayMappingRepository;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private vacademy.io.admin_core_service.features.user_subscription.repository.UserInstitutePaymentGatewayMappingRepository userGatewayMappingRepository;

    @Autowired
    private vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository customFieldValuesRepository;


    private static final String DEFAULT_INSTITUTE_ID = "0bd9421e-2e74-4cfb-bbee-03bc09845bc6";
    private static final String PAYMENT_OPTION_ID = "575d4c02-ff5e-4b4e-9157-f874677ba542";
    private static final String DEFAULT_PAYMENT_PLAN_ID = "38a1f5d2-8eb7-4614-a510-e5729556fee7";
    private static final String DEFAULT_ENROLL_INVITE = "aac8ac89-b9c8-4a2c-be77-ab46a1ba286a";
    private static final String INSTITUTE_PAYMENT_GATEWAY_MAPPING_ID = "ewway";
    private static final String PACKAGE_SESSION_ID = "8c29df0e-d5a5-4700-9392-c981bac8021b";

    // TODO: Replace with actual Custom Field IDs
    private static final java.util.Map<String, String> CUSTOM_FIELD_MAPPING = java.util.Map.of(
            "Country", "74308836-4433-4bbf-9f64-ce4668866df2",
            "State", "6da14e72-2a77-448e-988a-d70e6de5c32b",
            "City", "c7db1741-569f-4cac-af11-b13d1ee2284e",
            "Zip/Postal Code", "bdf3f600-aa55-45ef-b152-3280098afb43",
            "Phone", "04193a58-8ce5-4a26-ac90-846671601b64",
            "Phone Type", "3e3f0534-892f-4960-9eaf-4331887f4e62",
            "Job Title", "3004dfd6-2e28-4472-8742-73172ee5b4f5");

    public byte[] processUserBatch(int batchSize) {
        List<MigrationStagingKeapUser> pendingUsers = stagingService.getPendingRecords("INDIVIDUAL", batchSize);
        EnrollInvite enrollInvite = enrollInviteRepository.findById(DEFAULT_ENROLL_INVITE)
                .orElseThrow(() -> new VacademyException("Enroll invite not found"));
        InstitutePaymentGatewayMapping institutePaymentGatewayMapping = institutePaymentGatewayMappingRepository
                .findById(INSTITUTE_PAYMENT_GATEWAY_MAPPING_ID)
                .orElseThrow(() -> new VacademyException("Institute payment gateway mapping not found"));
        StringBuilder csvOutput = new StringBuilder();
        csvOutput.append("Email,ContactId,MigrationStatus,ErrorMessage\n");
        PackageSession packageSession = packageSessionRepository.findById(PACKAGE_SESSION_ID)
                .orElseThrow(() -> new VacademyException("Package session not found"));
        for (MigrationStagingKeapUser stagingUser : pendingUsers) {
            String status = "COMPLETED";
            String error = "";
            try {
                ObjectMapper mapper = new ObjectMapper();
                KeapUserDTO data = mapper.readValue(stagingUser.getRawData(), KeapUserDTO.class);

                migrateUserProfile(data, enrollInvite, institutePaymentGatewayMapping, packageSession);

                stagingService.updateStatus(stagingUser, "COMPLETED", null);
            } catch (Exception e) {
                status = "FAILED";
                error = e.getMessage();
                log.error("Failed to migrate staging user id: {}", stagingUser.getId(), e);
                stagingService.updateStatus(stagingUser, "FAILED", e.getMessage());
            }
            csvOutput.append(String.format("%s,%s,%s,\"%s\"\n", stagingUser.getEmail(), stagingUser.getKeapContactId(),
                    status, error.replace("\"", "\"\"")));
        }
        return csvOutput.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void migrateUserProfile(KeapUserDTO data, EnrollInvite enrollInvite,
            InstitutePaymentGatewayMapping institutePaymentGatewayMapping, PackageSession packageSession) {
        // 1. Create or Get User (Idempotent)
        UserDTO user = createOrGetUser(data);
        String userId = user.getId();

        // 2. Create/Update Student Profile (Idempotent)
        createStudentProfile(userId, data);

        // 2.1 Create User Gateway Mapping (Idempotent)
        createUserGatewayMapping(userId, data, institutePaymentGatewayMapping);

        // 2.2 Migrate Custom Fields (Idempotent)
        migrateCustomFields(userId, data, enrollInvite);

        // 3. Create User Plan (Idempotent - checks for existing active plan)
        UserPlan plan = createUserPlan(userId, data, enrollInvite);

        // If plan is null, it means an active plan already exists. We need to fetch it
        // to link payments.
        if (plan == null) {
            Optional<UserPlan> existingPlan = userPlanRepository.findFirstByUserIdAndPaymentPlanIdAndStatus(userId,
                    DEFAULT_PAYMENT_PLAN_ID, "ACTIVE");
            if (existingPlan.isPresent()) {
                plan = existingPlan.get();
            } else {
                // Should not happen if createUserPlan logic is correct, but safe fallback
                throw new VacademyException("Failed to retrieve existing active plan for user: " + data.getEmail());
            }
        } else {
            // 4. Create Access (SSIGM) only if we created a new plan
            createAccess(userId, plan, data, packageSession);
        }

        // 5. Unified Migration: Process Payment Logs for this user immediately
        // Pass the plan and userId directly to avoid re-querying and ensure atomicity
        processUserPayments(data.getContactId(), data.getEmail(), plan, userId);
    }

    private void processUserPayments(String contactId, String email, UserPlan plan, String userId) {
        List<MigrationStagingKeapPayment> pendingPayments = stagingService.getPaymentsForUser(contactId);

        // Sort by Date
        ObjectMapper mapper = new ObjectMapper();
        pendingPayments.sort((p1, p2) -> {
            try {
                KeapPaymentDTO d1 = mapper.readValue(p1.getRawData(), KeapPaymentDTO.class);
                KeapPaymentDTO d2 = mapper.readValue(p2.getRawData(), KeapPaymentDTO.class);
                if (d1.getDate() == null)
                    return -1;
                if (d2.getDate() == null)
                    return 1;
                return d1.getDate().compareTo(d2.getDate());
            } catch (Exception e) {
                return 0;
            }
        });

        for (MigrationStagingKeapPayment stagingPayment : pendingPayments) {
            try {
                KeapPaymentDTO paymentData = mapper.readValue(stagingPayment.getRawData(), KeapPaymentDTO.class);
                migratePaymentLog(paymentData, plan, userId);
                stagingService.updatePaymentStatus(stagingPayment, "COMPLETED", null);
            } catch (Exception e) {
                // Throwing exception here to trigger rollback of the entire user migration
                // (User + Plan + All Payments)
                throw new VacademyException("Failed to migrate payment for user " + email + " (contactId: " + contactId
                        + "): " + e.getMessage());
            }
        }
    }

    public void migratePaymentLog(KeapPaymentDTO data, UserPlan plan, String userId) {
        // 3. Create Payment Log
        PaymentLog log = new PaymentLog();
        log.setUserPlan(plan);
        log.setUserId(userId);
        log.setPaymentAmount(data.getAmount());
        log.setDate(data.getDate());

        // Set historical dates
        if (data.getDate() != null) {
            java.time.LocalDateTime txnDate = new java.sql.Timestamp(data.getDate().getTime()).toLocalDateTime();
            log.setCreatedAt(txnDate);
            log.setUpdatedAt(txnDate);
        }

        log.setStatus("ACTIVE");
        String txnStatus = data.getStatus() != null ? data.getStatus().toUpperCase() : "PAID";
        log.setPaymentStatus(txnStatus);

        log.setVendor("EWAY");

        ObjectMapper mapper = new ObjectMapper();
        ObjectNode specificData = mapper.createObjectNode();
        specificData.put("keap_transaction_id", data.getTransactionId());
        log.setPaymentSpecificData(specificData.toString());

        paymentLogRepository.save(log);
    }

    private UserDTO createOrGetUser(KeapUserDTO data) {
        UserDTO userDTO = new UserDTO();
        userDTO.setEmail(data.getEmail());
        userDTO.setFullName(data.getFirstName() + " " + data.getLastName());
        userDTO.setUsername(data.getEmail());
        userDTO.setMobileNumber(data.getPhone());
        userDTO.setPassword(generateRandomPassword());
        userDTO.setRoles(List.of("STUDENT"));
        return authService.createUserFromAuthService(userDTO, DEFAULT_INSTITUTE_ID, false);
    }

    private String generateRandomPassword() {
        String characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        Random random = new Random();
        StringBuilder password = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            int index = random.nextInt(characters.length());
            password.append(characters.charAt(index));
        }
        return password.toString();
    }

    private void createStudentProfile(String userId, KeapUserDTO data) {
        Optional<Student> existingStudent = studentRepository.findTopByUserId(userId);

        Student student;
        if (existingStudent.isPresent()) {
            student = existingStudent.get();
            student.setMobileNumber(data.getPhone());
            student.setAddressLine(data.getAddress());
            student.setCity(data.getCity());
            student.setRegion(data.getState());
            student.setPinCode(data.getZipCode());
        } else {
            student = new Student();
            student.setUserId(userId);
            student.setEmail(data.getEmail());
            student.setFullName(data.getFirstName() + " " + data.getLastName());
            student.setMobileNumber(data.getPhone());
            student.setAddressLine(data.getAddress());
            student.setCity(data.getCity());
            student.setRegion(data.getState());
            student.setPinCode(data.getZipCode());
        }
        studentRepository.save(student);
    }

    private UserPlan createUserPlan(String userId, KeapUserDTO data, EnrollInvite enrollInvite) {
        // Use constant ID instead of CSV product ID
        String planId = DEFAULT_PAYMENT_PLAN_ID;

        Optional<UserPlan> existingPlan = userPlanRepository.findFirstByUserIdAndPaymentPlanIdAndStatus(userId, planId,
                "ACTIVE");
        if (existingPlan.isPresent()) {
            return null;
        }

        // Use constant Payment Option ID
        String paymentOptionId = PAYMENT_OPTION_ID;

        UserPlan userPlan = new UserPlan();
        userPlan.setUserId(userId);
        userPlan.setPaymentPlanId(planId);
        userPlan.setPaymentOptionId(paymentOptionId);

        String status = "ACTIVE";
        if (data.getStatus() != null && !data.getStatus().isEmpty()) {
            status = data.getStatus().toUpperCase();
        }
        userPlan.setStatus(status);

        userPlan.setSource("USER");
        userPlan.setStartDate(new Timestamp(data.getStartDate().getTime()));
        userPlan.setEnrollInvite(enrollInvite);
        userPlan.setEnrollInviteId(enrollInvite.getId());
        if (data.getNextBillDate() != null) {
            userPlan.setEndDate(new Timestamp(data.getNextBillDate().getTime()));
        }

        ObjectMapper mapper = new ObjectMapper();

        // Construct PaymentInitiationRequestDTO structure directly
        ObjectNode paymentInitiationRequest = mapper.createObjectNode();
        paymentInitiationRequest.put("amount", data.getAmount());
        paymentInitiationRequest.put("currency", "aud");
        paymentInitiationRequest.put("description", "Migration Import");
        paymentInitiationRequest.put("charge_automatically", true);
        paymentInitiationRequest.put("institute_id", DEFAULT_INSTITUTE_ID);
        paymentInitiationRequest.put("email", data.getEmail());
        paymentInitiationRequest.put("vendor", "EWAY");

        // Empty/Null other vendors
        paymentInitiationRequest.set("stripe_request", mapper.createObjectNode());
        paymentInitiationRequest.set("razorpay_request", mapper.createObjectNode());
        paymentInitiationRequest.set("pay_pal_request", mapper.createObjectNode());

        // Eway Request
        ObjectNode ewayRequest = mapper.createObjectNode();
        ewayRequest.put("customer_id", data.getEwayToken());
        ewayRequest.put("country_code", data.getCountry());
        paymentInitiationRequest.set("eway_request", ewayRequest);

        paymentInitiationRequest.put("include_pending_items", true);

        userPlan.setJsonPaymentDetails(paymentInitiationRequest.toString());

        return userPlanRepository.save(userPlan);
    }

    private void createAccess(String userId, UserPlan plan, KeapUserDTO data, PackageSession packageSession) {
        StudentSessionInstituteGroupMapping ssigm = new StudentSessionInstituteGroupMapping();
        ssigm.setUserId(userId);
        ssigm.setInstituteEnrolledNumber(data.getContactId());
        ssigm.setEnrolledDate(plan.getStartDate());
        ssigm.setExpiryDate(plan.getEndDate());
        ssigm.setStatus("ACTIVE");
        ssigm.setUserPlanId(plan.getId());
        ssigm.setPackageSession(packageSession);
        Institute institute = new Institute();
        institute.setId(DEFAULT_INSTITUTE_ID);
        ssigm.setInstitute(institute);

        ssigmRepository.save(ssigm);
    }

    private void createUserGatewayMapping(String userId, KeapUserDTO data,
            InstitutePaymentGatewayMapping gatewayMapping) {
        if (data.getEwayToken() == null || data.getEwayToken().isEmpty()) {
            return;
        }

        // Check if mapping already exists
        Optional<vacademy.io.admin_core_service.features.user_subscription.entity.UserInstitutePaymentGatewayMapping> existingMapping = userGatewayMappingRepository
                .findByUserIdAndInstitutePaymentGatewayMappingId(userId, INSTITUTE_PAYMENT_GATEWAY_MAPPING_ID);

        if (existingMapping.isPresent()) {
            return;
        }

        vacademy.io.admin_core_service.features.user_subscription.entity.UserInstitutePaymentGatewayMapping mapping = new vacademy.io.admin_core_service.features.user_subscription.entity.UserInstitutePaymentGatewayMapping();

        mapping.setUserId(userId);

        mapping.setInstitutePaymentGatewayMapping(gatewayMapping);

        mapping.setPaymentGatewayCustomerId(data.getEwayToken());
        mapping.setStatus("ACTIVE");
        mapping.setCreatedAt(java.time.LocalDateTime.now());
        mapping.setUpdatedAt(java.time.LocalDateTime.now());

        userGatewayMappingRepository.save(mapping);
    }

    private void migrateCustomFields(String userId, KeapUserDTO data, EnrollInvite enrollInvite) {
        saveCustomField(userId, "Country", data.getCountry(), enrollInvite);
        saveCustomField(userId, "State", data.getState(), enrollInvite);
        saveCustomField(userId, "City", data.getCity(), enrollInvite);
        saveCustomField(userId, "Zip/Postal Code", data.getZipCode(), enrollInvite);
        saveCustomField(userId, "Phone", data.getPhone(), enrollInvite);
        saveCustomField(userId, "Job Title", data.getJobType(), enrollInvite);
    }

    private void saveCustomField(String userId, String fieldName, String value, EnrollInvite enrollInvite) {
        if (value == null || value.isEmpty()) {
            return;
        }

        String sourceType = "USER";
        String sourceId = userId;
        String type = "ENROLL_INVITE";
        String typeId = enrollInvite.getId();

        String customFieldId = CUSTOM_FIELD_MAPPING.get(fieldName);

        if (customFieldId == null) {
            return;
        }

        // Check if value exists for same source and sourceId
        Optional<vacademy.io.admin_core_service.features.common.entity.CustomFieldValues> existingValue = customFieldValuesRepository
                .findTopByCustomFieldIdAndSourceTypeAndSourceIdOrderByCreatedAtDesc(
                        customFieldId, sourceType, sourceId);

        if (existingValue.isPresent()) {
            // Update existing value
            vacademy.io.admin_core_service.features.common.entity.CustomFieldValues customFieldValue = existingValue
                    .get();
            customFieldValue.setValue(value);
            customFieldValue.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
            customFieldValuesRepository.save(customFieldValue);
        } else {
            // Create new value
            vacademy.io.admin_core_service.features.common.entity.CustomFieldValues customFieldValue = new vacademy.io.admin_core_service.features.common.entity.CustomFieldValues();
            customFieldValue.setCustomFieldId(customFieldId);
            customFieldValue.setSourceType(sourceType);
            customFieldValue.setSourceId(sourceId);
            customFieldValue.setType(type);
            customFieldValue.setTypeId(typeId);
            customFieldValue.setValue(value);
            customFieldValue.setCreatedAt(new Timestamp(System.currentTimeMillis()));
            customFieldValue.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
            customFieldValuesRepository.save(customFieldValue);
        }
    }
}
