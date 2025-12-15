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
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.migration.dto.KeapUserDTO;
import vacademy.io.admin_core_service.features.migration.dto.KeapPaymentDTO;
import vacademy.io.admin_core_service.features.migration.entity.MigrationStagingKeapUser;
import vacademy.io.admin_core_service.features.migration.entity.MigrationStagingKeapPayment;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;

@Service
@Slf4j
public class PracticeMemberKeapMigrationService {

    @Autowired
    private AuthService authService;

    @Autowired
    private InstituteStudentRepository studentRepository;

    @Autowired
    private UserPlanRepository userPlanRepository;

    @Autowired
    private StudentSessionInstituteGroupMappingRepository ssigmRepository;

    @Autowired
    private PracticeMemberKeapStagingService stagingService;

    @Autowired
    private EnrollInviteRepository enrollInviteRepository;

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private InstitutePaymentGatewayMappingRepository institutePaymentGatewayMappingRepository;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private vacademy.io.admin_core_service.features.user_subscription.repository.UserInstitutePaymentGatewayMappingRepository userGatewayMappingRepository;

    @Autowired
    private vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository customFieldValuesRepository;

    @Autowired
    private vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository paymentLogRepository;

    private static final String DEFAULT_PARENT_INSTITUTE_ID = "0bd9421e-2e74-4cfb-bbee-03bc09845bc6"; // The main org
    private static final String PAYMENT_OPTION_ID = "aee3fc07-7b65-4020-a6d5-7669520bd4a5";
    private static final String DEFAULT_PAYMENT_PLAN_ID = "e589191d-cd78-4f54-88b9-4796006cf5a9";
    private static final String DEFAULT_ENROLL_INVITE = "65b9dcc7-aef5-484e-81dc-292b36f0ea2f";
    private static final String INSTITUTE_PAYMENT_GATEWAY_MAPPING_ID = "ewway";
    private static final String PACKAGE_SESSION_ID = "8886af95-1337-458d-8dbd-74eca2f11cec";

    // TODO: Replace with actual Custom Field IDs
    private static final java.util.Map<String, String> CUSTOM_FIELD_MAPPING = java.util.Map.of(
            "Practice Name", "f0c3eb16-7421-45ed-8bcc-20d80bf9c923",
            "Country", "74308836-4433-4bbf-9f64-ce4668866df2",
            "State", "6da14e72-2a77-448e-988a-d70e6de5c32b",
            "City", "c7db1741-569f-4cac-af11-b13d1ee2284e",
            "Zip/Postal Code", "bdf3f600-aa55-45ef-b152-3280098afb43",
            "Phone", "04193a58-8ce5-4a26-ac90-846671601b64",
            "Job Title", "3004dfd6-2e28-4472-8742-73172ee5b4f5");

    public byte[] processPracticeBatch(int batchSize) {
        List<MigrationStagingKeapUser> pendingRootAdmins = stagingService.getPendingRootAdmins(batchSize);

        EnrollInvite enrollInvite = enrollInviteRepository.findById(DEFAULT_ENROLL_INVITE)
                .orElseThrow(() -> new VacademyException("Enroll invite not found"));
        InstitutePaymentGatewayMapping institutePaymentGatewayMapping = institutePaymentGatewayMappingRepository
                .findById(INSTITUTE_PAYMENT_GATEWAY_MAPPING_ID)
                .orElseThrow(() -> new VacademyException("Institute payment gateway mapping not found"));
        PackageSession packageSession = packageSessionRepository.findById(PACKAGE_SESSION_ID)
                .orElseThrow(() -> new VacademyException("Package session not found"));

        StringBuilder csvOutput = new StringBuilder();
        csvOutput.append("Email,ContactId,MigrationStatus,ErrorMessage\n");

        for (MigrationStagingKeapUser rootAdminStaging : pendingRootAdmins) {
            String status = "COMPLETED";
            String error = "";
            try {
                ObjectMapper mapper = new ObjectMapper();
                KeapUserDTO rootAdminData = mapper.readValue(rootAdminStaging.getRawData(), KeapUserDTO.class);

                // Fetch associated members
                List<MigrationStagingKeapUser> members = stagingService
                        .getPendingMembersForRootAdmin(rootAdminStaging.getKeapContactId());

                Institute parentInstitute = instituteRepository.findById(DEFAULT_PARENT_INSTITUTE_ID)
                        .orElseThrow(() -> new VacademyException("Parent Institute not found"));

                migratePractice(rootAdminData, members, enrollInvite, institutePaymentGatewayMapping, packageSession,
                        parentInstitute);

                stagingService.updateStatus(rootAdminStaging, "COMPLETED", null);
                for (MigrationStagingKeapUser member : members) {
                    stagingService.updateStatus(member, "COMPLETED", null);
                }

            } catch (Exception e) {
                status = "FAILED";
                error = e.getMessage();
                log.error("Failed to migrate practice for root admin id: {}", rootAdminStaging.getId(), e);
                stagingService.updateStatus(rootAdminStaging, "FAILED", e.getMessage());
                // Mark members as failed too? Or keep them pending?
                // For now, let's mark them failed to avoid partial state issues if they are
                // re-picked up without root admin
                try {
                    List<MigrationStagingKeapUser> members = stagingService
                            .getPendingMembersForRootAdmin(rootAdminStaging.getKeapContactId());
                    for (MigrationStagingKeapUser member : members) {
                        stagingService.updateStatus(member, "FAILED", "Root Admin Migration Failed: " + e.getMessage());
                    }
                } catch (Exception ignored) {
                }
            }

            csvOutput.append(
                    String.format("%s,%s,%s,\"%s\"\n", rootAdminStaging.getEmail(), rootAdminStaging.getKeapContactId(),
                            status, error.replace("\"", "\"\"")));
        }
        return csvOutput.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void migratePractice(KeapUserDTO rootAdminData, List<MigrationStagingKeapUser> members,
            EnrollInvite enrollInvite, InstitutePaymentGatewayMapping institutePaymentGatewayMapping,
            PackageSession packageSession, Institute parentInstitute) throws Exception {

        // 1. Create Root Admin User
        UserDTO rootAdminUser = createOrGetUser(rootAdminData);
        String rootAdminUserId = rootAdminUser.getId();
        createStudentProfile(rootAdminUserId, rootAdminData);
        createUserGatewayMapping(rootAdminUserId, rootAdminData, institutePaymentGatewayMapping);
        migrateCustomFields(rootAdminUserId, rootAdminData, enrollInvite);

        // 2. Create Institute (Sub-Org)
        Institute subOrg = createSubOrg(rootAdminData);

        // 3. Create User Plan for Root Admin (Source = SUB_ORG)
        UserPlan plan = createUserPlanForRootAdmin(rootAdminUserId, rootAdminData, enrollInvite, subOrg,
                parentInstitute);

        // 4. Link Root Admin to Sub-Org (SSIGM)
        createAccess(rootAdminUserId, plan, rootAdminData, packageSession, subOrg, "ROOT_ADMIN,LEARNER");

        // 4.1 Process Payments for Root Admin
        processUserPayments(rootAdminData.getContactId(), rootAdminData.getEmail(), plan, rootAdminUserId);

        // 5. Process Members
        ObjectMapper mapper = new ObjectMapper();
        for (MigrationStagingKeapUser memberStaging : members) {
            KeapUserDTO memberData = mapper.readValue(memberStaging.getRawData(), KeapUserDTO.class);

            UserDTO memberUser = createOrGetUser(memberData);
            String memberUserId = memberUser.getId();
            createStudentProfile(memberUserId, memberData);
            // Members might not have gateway mapping or custom fields in this context, but
            // if they do:
            createUserGatewayMapping(memberUserId, memberData, institutePaymentGatewayMapping);
            migrateCustomFields(memberUserId, memberData, enrollInvite);

            // Link Member to Sub-Org (SSIGM) - No UserPlan for them
            String roles = "LEARNER"; // Default
            if ("ADMIN".equalsIgnoreCase(memberData.getPracticeRole())) {
                roles = "ADMIN,LEARNER";
            } else if ("LEARNER".equalsIgnoreCase(memberData.getPracticeRole())) {
                roles = "LEARNER";
            }

            createAccess(memberUserId, plan, memberData, packageSession, subOrg, roles);
        }
    }

    private Institute createSubOrg(KeapUserDTO rootAdminData) {
        // Check if institute exists by name? Or always create new?
        // Assuming create new for migration based on practice name.
        // Ideally we should check if it exists to be idempotent.

        // Simple check by name (This might need refinement based on requirements)
        Institute institute = new Institute();
        institute.setInstituteName(rootAdminData.getPracticeName());
        // Set other required fields for Institute...
        return instituteRepository.save(institute);
    }

    private UserPlan createUserPlanForRootAdmin(String userId, KeapUserDTO data, EnrollInvite enrollInvite,
            Institute subOrg, Institute parentInstitute) {
        String planId = DEFAULT_PAYMENT_PLAN_ID;

        // Check existing plan
        Optional<UserPlan> existingPlan = userPlanRepository.findFirstByUserIdAndPaymentPlanIdAndStatus(userId, planId,
                "ACTIVE");
        if (existingPlan.isPresent())
            return existingPlan.get();

        UserPlan userPlan = new UserPlan();
        userPlan.setUserId(userId);
        userPlan.setPaymentPlanId(planId);
        userPlan.setPaymentOptionId(PAYMENT_OPTION_ID);

        String status = "ACTIVE";
        if (data.getStatus() != null && !data.getStatus().isEmpty()) {
            status = data.getStatus().toUpperCase();
        }
        userPlan.setStatus(status);

        userPlan.setSource("SUB_ORG"); // Source is SUB_ORG
        userPlan.setStartDate(new Timestamp(data.getStartDate().getTime()));
        userPlan.setEnrollInvite(enrollInvite);
        userPlan.setEnrollInviteId(enrollInvite.getId());
        if (data.getNextBillDate() != null) {
            userPlan.setEndDate(new Timestamp(data.getNextBillDate().getTime()));
        }
        userPlan.setSubOrgId(subOrg.getId());

        // Payment Details (Similar to Individual)
        ObjectMapper mapper = new ObjectMapper();
        ObjectNode paymentInitiationRequest = mapper.createObjectNode();
        paymentInitiationRequest.put("amount", data.getAmount());
        paymentInitiationRequest.put("currency", data.getCurrency());
        paymentInitiationRequest.put("description", "Migration Import - Practice");
        paymentInitiationRequest.put("charge_automatically", true);
        paymentInitiationRequest.put("institute_id", parentInstitute.getId()); // Linked to Parent for billing
        paymentInitiationRequest.put("email", data.getEmail());
        paymentInitiationRequest.put("vendor", "EWAY");

        paymentInitiationRequest.set("stripe_request", mapper.createObjectNode());
        paymentInitiationRequest.set("razorpay_request", mapper.createObjectNode());
        paymentInitiationRequest.set("pay_pal_request", mapper.createObjectNode());

        ObjectNode ewayRequest = mapper.createObjectNode();
        ewayRequest.put("customer_id", data.getEwayToken());
        ewayRequest.put("country_code", data.getCountry());
        paymentInitiationRequest.set("eway_request", ewayRequest);

        paymentInitiationRequest.put("include_pending_items", true);
        userPlan.setJsonPaymentDetails(paymentInitiationRequest.toString());

        return userPlanRepository.save(userPlan);
    }

    private void createAccess(String userId, UserPlan plan, KeapUserDTO data, PackageSession packageSession,
            Institute subOrg, String roles) {
        // Check if access exists?
        // For migration, we assume we are creating.

        StudentSessionInstituteGroupMapping ssigm = new StudentSessionInstituteGroupMapping();
        ssigm.setUserId(userId);
        ssigm.setInstituteEnrolledNumber(data.getContactId());

        ssigm.setEnrolledDate(plan.getStartDate());
        ssigm.setExpiryDate(plan.getEndDate());

        ssigm.setStatus("ACTIVE");
        ssigm.setUserPlanId(plan.getId());
        ssigm.setPackageSession(packageSession);
        // Fetch Parent Institute
        Institute parentInstitute = instituteRepository.findById(DEFAULT_PARENT_INSTITUTE_ID)
                .orElseThrow(() -> new VacademyException("Parent Institute not found"));

        ssigm.setInstitute(parentInstitute); // Linked to Parent Institute
        ssigm.setSubOrg(subOrg); // Set Sub Org ID explicitly

        ssigm.setCommaSeparatedOrgRoles(roles);
        ssigmRepository.save(ssigm);
    }

    private UserDTO createOrGetUser(KeapUserDTO data) {
        UserDTO userDTO = new UserDTO();
        userDTO.setEmail(data.getEmail());
        userDTO.setFullName(data.getFirstName() + " " + data.getLastName());
        userDTO.setUsername(data.getEmail());
        userDTO.setMobileNumber(data.getPhone());
        userDTO.setPassword(generateRandomPassword());
        return authService.createUserFromAuthService(userDTO, DEFAULT_PARENT_INSTITUTE_ID, false);
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

    private void createUserGatewayMapping(String userId, KeapUserDTO data,
            InstitutePaymentGatewayMapping gatewayMapping) {
        if (data.getEwayToken() == null || data.getEwayToken().isEmpty())
            return;
        Optional<vacademy.io.admin_core_service.features.user_subscription.entity.UserInstitutePaymentGatewayMapping> existingMapping = userGatewayMappingRepository
                .findByUserIdAndInstitutePaymentGatewayMappingId(userId, INSTITUTE_PAYMENT_GATEWAY_MAPPING_ID);
        if (existingMapping.isPresent())
            return;
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
        saveCustomField(userId, "Practice Name", data.getPracticeName(), enrollInvite);
        saveCustomField(userId, "Country", data.getCountry(), enrollInvite);
        saveCustomField(userId, "State", data.getState(), enrollInvite);
        saveCustomField(userId, "City", data.getCity(), enrollInvite);
        saveCustomField(userId, "Zip/Postal Code", data.getZipCode(), enrollInvite);
        saveCustomField(userId, "Phone", data.getPhone(), enrollInvite);
        saveCustomField(userId, "Job Title", data.getJobType(), enrollInvite);
    }

    private void saveCustomField(String userId, String fieldName, String value, EnrollInvite enrollInvite) {
        if (value == null || value.isEmpty())
            return;
        String sourceType = "USER";
        String sourceId = userId;
        String type = "ENROLL_INVITE";
        String typeId = enrollInvite.getId();

        String customFieldId = CUSTOM_FIELD_MAPPING.get(fieldName);
        if (customFieldId == null)
            return;

        Optional<vacademy.io.admin_core_service.features.common.entity.CustomFieldValues> existingValue = customFieldValuesRepository
                .findTopByCustomFieldIdAndSourceTypeAndSourceIdOrderByCreatedAtDesc(customFieldId, sourceType,
                        sourceId);
        if (existingValue.isPresent()) {
            vacademy.io.admin_core_service.features.common.entity.CustomFieldValues customFieldValue = existingValue
                    .get();
            customFieldValue.setValue(value);
            customFieldValue.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
            customFieldValuesRepository.save(customFieldValue);
        } else {
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
}
