package vacademy.io.admin_core_service.features.migration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
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

import vacademy.io.admin_core_service.features.migration.enums.MigrationStatus;
import vacademy.io.admin_core_service.features.migration.enums.UserPlanStatus;

@Service
@Slf4j
public class IndividualExpiredMemberKeapMigrationService {

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

    public byte[] processUserBatch(int batchSize,
            vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        List<MigrationStagingKeapUser> pendingUsers = stagingService.getPendingRecords("EXPIRED_INDIVIDUAL", batchSize);

        String enrollInviteId = config != null ? config.getEnrollInviteId() : null;
        if (enrollInviteId == null) {
            throw new VacademyException("Enroll Invite ID is required in config");
        }
        EnrollInvite enrollInvite = enrollInviteRepository.findById(enrollInviteId)
                .orElseThrow(() -> new VacademyException("Enroll invite not found: " + enrollInviteId));

        String paymentGatewayMappingId = config != null ? config.getPaymentGatewayMappingId() : null;
        if (paymentGatewayMappingId == null) {
            throw new VacademyException("Payment Gateway Mapping ID is required in config");
        }
        InstitutePaymentGatewayMapping institutePaymentGatewayMapping = institutePaymentGatewayMappingRepository
                .findById(paymentGatewayMappingId)
                .orElseThrow(() -> new VacademyException(
                        "Institute payment gateway mapping not found: " + paymentGatewayMappingId));

        StringBuilder csvOutput = new StringBuilder();
        csvOutput.append("Email,ContactId,MigrationStatus,ErrorMessage\n");

        String packageSessionId = config != null ? config.getPackageSessionId() : null;
        if (packageSessionId == null) {
            throw new VacademyException("Package Session ID is required in config");
        }
        PackageSession packageSession = packageSessionRepository.findById(packageSessionId)
                .orElseThrow(() -> new VacademyException("Package session not found: " + packageSessionId));

        for (MigrationStagingKeapUser stagingUser : pendingUsers) {
            String status = MigrationStatus.COMPLETED.name();
            String error = "";
            try {
                ObjectMapper mapper = new ObjectMapper();
                KeapUserDTO data = mapper.readValue(stagingUser.getRawData(), KeapUserDTO.class);

                migrateUserProfile(data, enrollInvite, institutePaymentGatewayMapping, packageSession, config);

                stagingService.updateStatus(stagingUser, MigrationStatus.COMPLETED.name(), null);
            } catch (Exception e) {
                status = MigrationStatus.FAILED.name();
                error = e.getMessage();
                log.error("Failed to migrate staging user id: {}", stagingUser.getId(), e);
                stagingService.updateStatus(stagingUser, MigrationStatus.FAILED.name(), e.getMessage());
            }
            csvOutput.append(String.format("%s,%s,%s,\"%s\"\n", stagingUser.getEmail(), stagingUser.getKeapContactId(),
                    status, error.replace("\"", "\"\"")));
        }
        return csvOutput.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void migrateUserProfile(KeapUserDTO data, EnrollInvite enrollInvite,
            InstitutePaymentGatewayMapping institutePaymentGatewayMapping, PackageSession packageSession,
            vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        // 1. Create or Get User (Idempotent)
        UserDTO user = createOrGetUser(data, config);
        String userId = user.getId();

        // 2. Create/Update Student Profile (Idempotent)
        createStudentProfile(userId, data);

        // 2.1 Create User Gateway Mapping (Idempotent)
        // For expired members, token might be null, but if present, we map it.
        createUserGatewayMapping(userId, data, institutePaymentGatewayMapping);

        // 2.2 Migrate Custom Fields (Idempotent)
        migrateCustomFields(userId, data, enrollInvite, config);

        // 3. Create User Plan (Idempotent - checks for existing active plan)
        // For expired members, we create a plan with status EXPIRED
        UserPlan plan = createUserPlan(userId, data, enrollInvite, config);

        // If plan is null, it means an active plan already exists. We need to fetch it
        // to link payments.

        if (plan == null) {
            String paymentPlanId = config != null ? config.getPaymentPlanId() : null;
            if (paymentPlanId == null) {
                throw new VacademyException("Payment Plan ID is required in config");
            }
            Optional<UserPlan> existingPlan = userPlanRepository.findFirstByUserIdAndPaymentPlanIdAndStatus(userId,
                    paymentPlanId, UserPlanStatus.EXPIRED.name()); // Check for EXPIRED plan
            if (existingPlan.isPresent()) {
                plan = existingPlan.get();
            } else {
                // Fallback to check ACTIVE just in case, or create new if not found?
                // Assuming if not found we create new EXPIRED plan. But createUserPlan handles
                // creation.
                // If createUserPlan returns null, it means it found one.
                // Let's re-fetch with EXPIRED status if createUserPlan returns null.
                // Wait, createUserPlan logic below checks for EXPIRED too?
                // Let's adjust createUserPlan to check for EXPIRED status for this service.
                throw new VacademyException("Failed to retrieve existing plan for user: " + data.getEmail());
            }
        } else {
            // 4. Create Access (SSIGM) only if we created a new plan
            createAccess(userId, plan, data, packageSession, config);
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

    private UserDTO createOrGetUser(KeapUserDTO data,
            vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        UserDTO userDTO = new UserDTO();
        userDTO.setEmail(data.getEmail());
        userDTO.setFullName(data.getFirstName() + " " + data.getLastName());
        userDTO.setUsername(data.getEmail());
        userDTO.setMobileNumber(data.getPhone());
        userDTO.setPassword(generateRandomPassword());
        userDTO.setRoles(List.of("STUDENT"));
        String instituteId = config.getInstituteId();
        return authService.createUserFromAuthService(userDTO, instituteId, false);
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

    private UserPlan createUserPlan(String userId, KeapUserDTO data, EnrollInvite enrollInvite,
            vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        // Use constant ID instead of CSV product ID
        String planId = config != null ? config.getPaymentPlanId() : null;
        if (planId == null) {
            throw new VacademyException("Payment Plan ID is required in config");
        }

        // Check for existing plan with EXPIRED status
        Optional<UserPlan> existingPlan = userPlanRepository.findFirstByUserIdAndPaymentPlanIdAndStatus(userId, planId,
                UserPlanStatus.EXPIRED.name());
        if (existingPlan.isPresent()) {
            return null;
        }

        // Use constant Payment Option ID
        String paymentOptionId = config != null ? config.getPaymentOptionId() : null;
        if (paymentOptionId == null) {
            throw new VacademyException("Payment Option ID is required in config");
        }

        UserPlan userPlan = new UserPlan();
        userPlan.setUserId(userId);
        userPlan.setPaymentPlanId(planId);
        userPlan.setPaymentOptionId(paymentOptionId);

        // Force status to EXPIRED for this service
        userPlan.setStatus(UserPlanStatus.EXPIRED.name());

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

        paymentInitiationRequest.put("description", "Migration Import - Expired");
        paymentInitiationRequest.put("charge_automatically", true);
        String instituteId = config != null ? config.getInstituteId() : null;
        if (instituteId == null) {
            throw new VacademyException("Institute ID is required in config");
        }
        paymentInitiationRequest.put("institute_id", instituteId);
        paymentInitiationRequest.put("email", data.getEmail());
        paymentInitiationRequest.put("vendor", "EWAY");

        // Empty/Null other vendors
        paymentInitiationRequest.set("stripe_request", mapper.createObjectNode());
        paymentInitiationRequest.set("razorpay_request", mapper.createObjectNode());
        paymentInitiationRequest.set("pay_pal_request", mapper.createObjectNode());

        // Eway Request
        ObjectNode ewayRequest = mapper.createObjectNode();
        if (data.getEwayToken() != null) {
            ewayRequest.put("customer_id", data.getEwayToken());
        }
        ewayRequest.put("country_code", data.getCountry());
        paymentInitiationRequest.set("eway_request", ewayRequest);

        paymentInitiationRequest.put("include_pending_items", true);

        userPlan.setJsonPaymentDetails(paymentInitiationRequest.toString());

        return userPlanRepository.save(userPlan);
    }

    private void createAccess(String userId, UserPlan plan, KeapUserDTO data, PackageSession packageSession,
            vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        StudentSessionInstituteGroupMapping ssigm = new StudentSessionInstituteGroupMapping();
        ssigm.setUserId(userId);
        ssigm.setInstituteEnrolledNumber(data.getContactId());
        ssigm.setEnrolledDate(plan.getStartDate());
        ssigm.setExpiryDate(plan.getEndDate());

        // Specific fields for Expired Members
        ssigm.setStatus("INVITED");
        ssigm.setSource("EXPIRED");
        ssigm.setType("PACKAGE_SESSION");

        String ssigmTypeId = config != null ? config.getSsigmTypeId() : null;
        if (ssigmTypeId == null) {
            ssigmTypeId = packageSession.getId(); // Fallback to packageSessionId if not provided? Or require it?
            // User said "what ever will happend that will happpend by config".
            // But logic was: config.getSsigmTypeId() != null ? config.getSsigmTypeId() :
            // packageSession.getId();
            // packageSession.getId() comes from packageSession which comes from
            // config.getPackageSessionId().
            // So this is effectively using config.
        }
        // User said "remove this harcoded things as default". PACKAGE_SESSION_ID was
        // hardcoded.
        // We already replaced PACKAGE_SESSION_ID usage in processUserBatch.
        // So packageSession passed here is already derived from config.

        ssigm.setTypeId(ssigmTypeId);

        ssigm.setUserPlanId(plan.getId());
        ssigm.setPackageSession(packageSession);
        Institute institute = new Institute();
        String instituteId = config != null ? config.getInstituteId() : null;
        if (instituteId == null) {
            throw new VacademyException("Institute ID is required in config");
        }
        institute.setId(instituteId);
        ssigm.setInstitute(institute);

        ssigmRepository.save(ssigm);
    }

    private void createUserGatewayMapping(String userId, KeapUserDTO data,
            InstitutePaymentGatewayMapping gatewayMapping) {
        if (data.getEwayToken() == null || data.getEwayToken().isEmpty() || !StringUtils.hasText(data.getEwayToken())) {
            return;
        }

        // Check if mapping already exists
        Optional<vacademy.io.admin_core_service.features.user_subscription.entity.UserInstitutePaymentGatewayMapping> existingMapping = userGatewayMappingRepository
                .findByUserIdAndInstitutePaymentGatewayMappingId(userId, gatewayMapping.getId());

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

    private void migrateCustomFields(String userId, KeapUserDTO data, EnrollInvite enrollInvite,
            vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        saveCustomField(userId, "Country", data.getCountry(), enrollInvite, config);
        saveCustomField(userId, "State", data.getState(), enrollInvite, config);
        saveCustomField(userId, "City", data.getCity(), enrollInvite, config);
        saveCustomField(userId, "Zip/Postal Code", data.getZipCode(), enrollInvite, config);
        saveCustomField(userId, "Phone", data.getPhone(), enrollInvite, config);
        saveCustomField(userId, "Job Title", data.getJobType(), enrollInvite, config);
        saveCustomField(userId, "Phone Type", data.getPhoneType(), enrollInvite, config);
    }

    private void saveCustomField(String userId, String fieldName, String value, EnrollInvite enrollInvite,
            vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        if (value == null || value.isEmpty()) {
            return;
        }

        String sourceType = "USER";
        String sourceId = userId;
        String type = "ENROLL_INVITE";
        String typeId = enrollInvite.getId();

        String customFieldId = null;
        if (config != null && config.getCustomFieldMapping() != null) {
            customFieldId = config.getCustomFieldMapping().get(fieldName);
        }

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
