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
public class PracticeExpiredMemberKeapMigrationService {

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
    private PaymentLogRepository paymentLogRepository;

    // Removed hardcoded constants

    public byte[] processPracticeBatch(int batchSize,
            vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config, String recordType) {
        List<MigrationStagingKeapUser> pendingRootAdmins = stagingService.getPendingRootAdmins(recordType,
                batchSize);

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

        String packageSessionId = config != null ? config.getPackageSessionId() : null;
        if (packageSessionId == null) {
            throw new VacademyException("Package Session ID is required in config");
        }
        PackageSession packageSession = packageSessionRepository.findById(packageSessionId)
                .orElseThrow(() -> new VacademyException("Package session not found: " + packageSessionId));

        StringBuilder csvOutput = new StringBuilder();
        csvOutput.append("Email,ContactId,MigrationStatus,ErrorMessage\n");

        for (MigrationStagingKeapUser rootAdminStaging : pendingRootAdmins) {
            String status = MigrationStatus.COMPLETED.name();
            String error = "";
            try {
                ObjectMapper mapper = new ObjectMapper();
                KeapUserDTO rootAdminData = mapper.readValue(rootAdminStaging.getRawData(), KeapUserDTO.class);

                // Fetch associated members
                List<MigrationStagingKeapUser> members = stagingService
                        .getPendingMembersForRootAdmin(rootAdminStaging.getKeapContactId(), "EXPIRED_PRACTICE");

                String parentInstituteId = config != null ? config.getInstituteId() : null;
                if (parentInstituteId == null) {
                    throw new VacademyException("Parent Institute ID is required in config");
                }
                Institute parentInstitute = instituteRepository.findById(parentInstituteId)
                        .orElseThrow(() -> new VacademyException("Parent Institute not found: " + parentInstituteId));

                migratePractice(rootAdminData, members, enrollInvite, institutePaymentGatewayMapping, packageSession,
                        parentInstitute, config);

                stagingService.updateStatus(rootAdminStaging, MigrationStatus.COMPLETED.name(), null);
                for (MigrationStagingKeapUser member : members) {
                    stagingService.updateStatus(member, MigrationStatus.COMPLETED.name(), null);
                }

            } catch (Exception e) {
                status = MigrationStatus.FAILED.name();
                error = e.getMessage();
                log.error("Failed to migrate practice for root admin id: {}", rootAdminStaging.getId(), e);
                stagingService.updateStatus(rootAdminStaging, MigrationStatus.FAILED.name(), e.getMessage());
                // Mark members as failed too? Or keep them pending?
                // For now, let's mark them failed to avoid partial state issues if they are
                // re-picked up without root admin
                try {
                    List<MigrationStagingKeapUser> members = stagingService
                            .getPendingMembersForRootAdmin(rootAdminStaging.getKeapContactId(), "EXPIRED_PRACTICE");
                    for (MigrationStagingKeapUser member : members) {
                        stagingService.updateStatus(member, MigrationStatus.FAILED.name(),
                                "Root Admin Migration Failed: " + e.getMessage());
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
            PackageSession packageSession, Institute parentInstitute,
            vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) throws Exception {

        // 1. Create Root Admin User
        UserDTO rootAdminUser = createOrGetUser(rootAdminData, config);
        String rootAdminUserId = rootAdminUser.getId();
        createStudentProfile(rootAdminUserId, rootAdminData);
        createUserGatewayMapping(rootAdminUserId, rootAdminData, institutePaymentGatewayMapping);
        migrateCustomFields(rootAdminUserId, rootAdminData, enrollInvite, config);

        // 2. Create Institute (Sub-Org)
        Institute subOrg = createSubOrg(rootAdminData);

        // 3. Create User Plan for Root Admin (Source = SUB_ORG)
        // For expired members, we create a plan with status EXPIRED
        UserPlan plan = createUserPlanForRootAdmin(rootAdminUserId, rootAdminData, enrollInvite, subOrg,
                parentInstitute, config);

        // 4. Link Root Admin to Sub-Org (SSIGM)
        createAccess(rootAdminUserId, plan, rootAdminData, packageSession, subOrg, "ROOT_ADMIN,LEARNER", config);

        // 4.1 Process Payments for Root Admin
        processUserPayments(rootAdminData.getContactId(), rootAdminData.getEmail(), plan, rootAdminUserId);

        // 5. Process Members
        ObjectMapper mapper = new ObjectMapper();
        for (MigrationStagingKeapUser memberStaging : members) {
            KeapUserDTO memberData = mapper.readValue(memberStaging.getRawData(), KeapUserDTO.class);

            UserDTO memberUser = createOrGetUser(memberData, config);
            String memberUserId = memberUser.getId();
            createStudentProfile(memberUserId, memberData);
            // Members might not have gateway mapping or custom fields in this context, but
            // if they do:
            createUserGatewayMapping(memberUserId, memberData, institutePaymentGatewayMapping);
            migrateCustomFields(memberUserId, memberData, enrollInvite, config);

            // Link Member to Sub-Org (SSIGM) - No UserPlan for them
            String roles = "LEARNER"; // Default
            if ("ADMIN".equalsIgnoreCase(memberData.getPracticeRole())) {
                roles = "ADMIN,LEARNER";
            } else if ("LEARNER".equalsIgnoreCase(memberData.getPracticeRole())) {
                roles = "LEARNER";
            }

            createAccess(memberUserId, plan, memberData, packageSession, subOrg, roles, config);
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
            Institute subOrg, Institute parentInstitute,
            vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        String planId = config != null ? config.getPaymentPlanId() : null;
        if (planId == null) {
            throw new VacademyException("Payment Plan ID is required in config");
        }

        // Check existing plan with EXPIRED status
        Optional<UserPlan> existingPlan = userPlanRepository.findFirstByUserIdAndPaymentPlanIdAndStatus(userId, planId,
                UserPlanStatus.EXPIRED.name());
        if (existingPlan.isPresent())
            return existingPlan.get();

        String paymentOptionId = config != null ? config.getPaymentOptionId() : null;
        if (paymentOptionId == null) {
            throw new VacademyException("Payment Option ID is required in config");
        }

        UserPlan userPlan = new UserPlan();
        userPlan.setUserId(userId);
        userPlan.setPaymentPlanId(planId);
        userPlan.setPaymentOptionId(paymentOptionId);

        // Force status to EXPIRED
        userPlan.setStatus(UserPlanStatus.EXPIRED.name());

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

        paymentInitiationRequest.put("description", "Migration Import - Practice Expired");
        paymentInitiationRequest.put("charge_automatically", true);
        paymentInitiationRequest.put("institute_id", parentInstitute.getId()); // Linked to Parent for billing
        paymentInitiationRequest.put("email", data.getEmail());
        paymentInitiationRequest.put("vendor", "EWAY");

        paymentInitiationRequest.set("stripe_request", mapper.createObjectNode());
        paymentInitiationRequest.set("razorpay_request", mapper.createObjectNode());
        paymentInitiationRequest.set("pay_pal_request", mapper.createObjectNode());

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
            Institute subOrg, String roles,
            vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        // Check if access exists?
        // For migration, we assume we are creating.

        StudentSessionInstituteGroupMapping ssigm = new StudentSessionInstituteGroupMapping();
        ssigm.setUserId(userId);
        ssigm.setInstituteEnrolledNumber(data.getContactId());

        ssigm.setEnrolledDate(plan.getStartDate());
        ssigm.setExpiryDate(plan.getEndDate());

        ssigm.setCommaSeparatedOrgRoles(roles);
        ssigmRepository.save(ssigm);
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
        String instituteId = config != null ? config.getInstituteId() : null;
        if (instituteId == null) {
            throw new VacademyException("Institute ID is required in config");
        }
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

    private void createUserGatewayMapping(String userId, KeapUserDTO data,
            InstitutePaymentGatewayMapping gatewayMapping) {
        if (data.getEwayToken() == null || data.getEwayToken().isEmpty())
            return;
        Optional<vacademy.io.admin_core_service.features.user_subscription.entity.UserInstitutePaymentGatewayMapping> existingMapping = userGatewayMappingRepository
                .findByUserIdAndInstitutePaymentGatewayMappingId(userId, gatewayMapping.getId());
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

    private void migrateCustomFields(String userId, KeapUserDTO data, EnrollInvite enrollInvite,
            vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        saveCustomField(userId, "Practice Name", data.getPracticeName(), enrollInvite, config);
        saveCustomField(userId, "Country", data.getCountry(), enrollInvite, config);
        saveCustomField(userId, "State", data.getState(), enrollInvite, config);
        saveCustomField(userId, "City", data.getCity(), enrollInvite, config);
        saveCustomField(userId, "Zip/Postal Code", data.getZipCode(), enrollInvite, config);
        saveCustomField(userId, "Phone", data.getPhone(), enrollInvite, config);
        saveCustomField(userId, "Job Title", data.getJobType(), enrollInvite, config);
    }

    private void saveCustomField(String userId, String fieldName, String value, EnrollInvite enrollInvite,
            vacademy.io.admin_core_service.features.migration.dto.MigrationConfigDTO config) {
        if (value == null || value.isEmpty())
            return;
        String sourceType = "USER";
        String sourceId = userId;
        String type = "ENROLL_INVITE";
        String typeId = enrollInvite.getId();

        String customFieldId = null;
        if (config != null && config.getCustomFieldMapping() != null) {
            customFieldId = config.getCustomFieldMapping().get(fieldName);
        }

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
