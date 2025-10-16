package vacademy.io.admin_core_service.features.institute_learner.manager;


import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.RandomStringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.controller.InstituteCertificateController;
import vacademy.io.admin_core_service.features.institute_learner.constants.StudentConstants;
import vacademy.io.admin_core_service.features.institute_learner.dto.*;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.learner.service.LearnerCouponService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;

@Component
public class StudentRegistrationManager {

    private final InstituteCertificateController instituteCertificateController;

    @Autowired
    InternalClientUtils internalClientUtils;

    @Autowired
    InstituteStudentRepository instituteStudentRepository;

    @Autowired
    StudentSessionRepository studentSessionRepository;

    @Value("${auth.server.baseurl}")
    private String authServerBaseUrl;
    @Value("${spring.application.name}")
    private String applicationName;

    @Autowired
    private LearnerCouponService learnerCouponService;


    StudentRegistrationManager(InstituteCertificateController instituteCertificateController) {
        this.instituteCertificateController = instituteCertificateController;
    }


    public InstituteStudentDTO addStudentToInstitute(CustomUserDetails user, InstituteStudentDTO instituteStudentDTO, BulkUploadInitRequest bulkUploadInitRequest) {
        instituteStudentDTO = this.updateAsPerConfig(instituteStudentDTO, bulkUploadInitRequest);
        Student student = checkAndCreateStudent(instituteStudentDTO);
        linkStudentToInstitute(student, instituteStudentDTO.getInstituteStudentDetails());
        learnerCouponService.generateCouponCodeForLearner(student.getUserId());
        return instituteStudentDTO;
    }

    public ResponseEntity<StudentDTO> addOpenStudentToInstitute(UserDTO userDTO, String instituteId) {
        InstituteStudentDTO instituteStudentDTO = new InstituteStudentDTO();
        instituteStudentDTO.setUserDetails(userDTO);
        instituteStudentDTO.setInstituteStudentDetails(InstituteStudentDetails.builder().instituteId(instituteId).build());

        Student student = checkAndCreateStudent(instituteStudentDTO);
        if (instituteStudentDTO.getInstituteStudentDetails() != null)
            linkStudentToInstitute(student, instituteStudentDTO.getInstituteStudentDetails());
        return ResponseEntity.ok(new StudentDTO(student));
    }


    public UserDTO createUserFromAuthService(UserDTO userDTO, String instituteId, boolean isNotify) {
        try {
            userDTO.setRootUser(true);
            ObjectMapper objectMapper = new ObjectMapper();
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(applicationName, HttpMethod.POST.name(), authServerBaseUrl, StudentConstants.addUserRoute + "?instituteId=" + instituteId + "&isNotify=" + isNotify, userDTO);
            return objectMapper.readValue(response.getBody(), UserDTO.class);

        } catch (Exception e) {
            throw new vacademy.io.common.exceptions.VacademyException(e.getMessage());
        }
    }

    private Student checkAndCreateStudent(InstituteStudentDTO instituteStudentDTO) {
        instituteStudentDTO.getUserDetails().setRoles(getStudentRoles());
        setRandomPasswordIfNull(instituteStudentDTO.getUserDetails());
        setRandomUserNameIfNull(instituteStudentDTO.getUserDetails());
        instituteStudentDTO.getUserDetails().setUsername(instituteStudentDTO.getUserDetails().getUsername().toLowerCase());
        setEnrollmentNumberIfNull(instituteStudentDTO.getInstituteStudentDetails());
        UserDTO createdUser = createUserFromAuthService(instituteStudentDTO.getUserDetails(), instituteStudentDTO.getInstituteStudentDetails().getInstituteId(), true);
        instituteStudentDTO.getUserDetails().setId(createdUser.getId());
        return createStudentFromRequest(createdUser, instituteStudentDTO.getStudentExtraDetails());
    }

    private void setRandomUserNameIfNull(UserDTO userDetails) {
        if (userDetails.getUsername() == null || !StringUtils.hasText(userDetails.getUsername())) {
            userDetails.setUsername(generateUsername(userDetails.getFullName()));
        }
        userDetails.setUsername(userDetails.getUsername().toLowerCase());
    }

    private void setEnrollmentNumberIfNull(InstituteStudentDetails instituteStudentDetails) {
        if (instituteStudentDetails.getEnrollmentId() == null || !StringUtils.hasText(instituteStudentDetails.getEnrollmentId())) {
            instituteStudentDetails.setEnrollmentId(generateEnrollmentId());
        }
    }

    private void setRandomPasswordIfNull(UserDTO userDTO) {
        if (userDTO.getPassword() == null || !StringUtils.hasText(userDTO.getPassword())) {
            userDTO.setPassword(generatePassword());
        }
    }


    public Student createStudentFromRequest(UserDTO userDTO, StudentExtraDetails studentExtraDetails) {
        Student student = new Student();
        Optional<Student> existingStudent = getExistingStudentByUserNameAndUserId(userDTO.getUsername(), userDTO.getId());
        if (existingStudent.isPresent()) {
            student = existingStudent.get();
        }
        if (userDTO.getId() != null) {
            student.setUserId(userDTO.getId());
        }
        if (userDTO.getUsername() != null) {
            student.setUsername(userDTO.getUsername());
        }
        if (userDTO.getFullName() != null) {
            student.setFullName(userDTO.getFullName());
        }
        if (userDTO.getEmail() != null) {
            student.setEmail(userDTO.getEmail());
        }
        if (userDTO.getMobileNumber() != null) {
            student.setMobileNumber(userDTO.getMobileNumber());
        }
        if (userDTO.getAddressLine() != null) {
            student.setAddressLine(userDTO.getAddressLine());
        }
        if (userDTO.getProfilePicFileId() != null) {
            student.setFaceFileId(userDTO.getProfilePicFileId());
        }
        if (userDTO.getCity() != null) {
            student.setCity(userDTO.getCity());
        }
        if (userDTO.getPinCode() != null) {
            student.setPinCode(userDTO.getPinCode());
        }
        if (userDTO.getGender() != null) {
            student.setGender(userDTO.getGender());
        }
        if (userDTO.getDateOfBirth() != null) {
            student.setDateOfBirth(userDTO.getDateOfBirth());
        }
        if (userDTO.getRegion() != null) {
            student.setRegion(userDTO.getRegion());
        }

        if (studentExtraDetails != null) {
            if (studentExtraDetails.getFathersName() != null) {
                student.setFatherName(studentExtraDetails.getFathersName());
            }
            if (studentExtraDetails.getMothersName() != null) {
                student.setMotherName(studentExtraDetails.getMothersName());
            }
            if (studentExtraDetails.getParentsMobileNumber() != null) {
                student.setParentsMobileNumber(studentExtraDetails.getParentsMobileNumber());
            }
            if (studentExtraDetails.getParentsEmail() != null) {
                student.setParentsEmail(studentExtraDetails.getParentsEmail());
            }
            if (studentExtraDetails.getLinkedInstituteName() != null) {
                student.setLinkedInstituteName(studentExtraDetails.getLinkedInstituteName());
            }
            if (studentExtraDetails.getParentsToMotherEmail() != null) {
                student.setParentsToMotherEmail(studentExtraDetails.getParentsToMotherEmail());
            }
            if (studentExtraDetails.getParentsToMotherMobileNumber() != null) {
                student.setParentToMotherMobileNumber(studentExtraDetails.getParentsToMotherMobileNumber());
            }
        }
        return instituteStudentRepository.save(student);
    }

    public String linkStudentToInstitute(Student student, InstituteStudentDetails details) {
        try {
            Optional<StudentSessionInstituteGroupMapping> activeDestinationMapping = getActiveDestinationMapping(student, details);
            Optional<StudentSessionInstituteGroupMapping> existingMapping = getExistingMapping(student, details);

            if (existingMapping.isPresent()) {
                return updateExistingMapping(existingMapping.get(), activeDestinationMapping, details);
            } else {
                return createNewMapping(student, activeDestinationMapping, details);
            }
        } catch (Exception e) {
            throw new VacademyException("Failed to link student to institute: " + e.getMessage());
        }
    }

    private Optional<StudentSessionInstituteGroupMapping> getActiveDestinationMapping(Student student, InstituteStudentDetails details) {
        if (!StringUtils.hasText(details.getDestinationPackageSessionId())) {
            return Optional.empty();
        }

        return studentSessionRepository.findTopByPackageSessionIdAndUserIdAndStatusIn(
            details.getDestinationPackageSessionId(),
            details.getInstituteId(),
            student.getUserId(),
            List.of(LearnerSessionStatusEnum.ACTIVE.name())
        );
    }

    private Optional<StudentSessionInstituteGroupMapping> getExistingMapping(Student student, InstituteStudentDetails details) {
        return studentSessionRepository.findTopByPackageSessionIdAndUserIdAndStatusIn(
            details.getPackageSessionId(),
            details.getInstituteId(),
            student.getUserId(),
            List.of(
                LearnerSessionStatusEnum.ACTIVE.name(),
                LearnerSessionStatusEnum.INVITED.name(),
                LearnerSessionStatusEnum.TERMINATED.name(),
                LearnerSessionStatusEnum.INACTIVE.name()
            )
        );
    }

    private String updateExistingMapping(
        StudentSessionInstituteGroupMapping mapping,
        Optional<StudentSessionInstituteGroupMapping> activeDestinationMapping,
        InstituteStudentDetails details
    ) {
        mapping.setEnrolledDate(new Date());

        if (details.getEnrollmentStatus() != null)
            mapping.setStatus(details.getEnrollmentStatus());

        if (details.getEnrollmentId() != null)
            mapping.setInstituteEnrolledNumber(details.getEnrollmentId());

        mapping.setUserPlanId(details.getUserPlanId());

        if (details.getAccessDays() != null) {
            Date baseDate = determineBaseDate(mapping, activeDestinationMapping);
            mapping.setExpiryDate(makeExpiryDate(baseDate, details.getAccessDays()));
        }

        return studentSessionRepository.save(mapping).getId();
    }

    private String createNewMapping(
        Student student,
        Optional<StudentSessionInstituteGroupMapping> activeDestinationMapping,
        InstituteStudentDetails details
    ) {
        UUID studentSessionId = UUID.randomUUID();
        Date baseDate = determineBaseDate(null, activeDestinationMapping);

        studentSessionRepository.addStudentToInstitute(
            studentSessionId.toString(),
            student.getUserId(),
            details.getEnrollmentDate() == null ? new Date() : details.getEnrollmentDate(),
            details.getEnrollmentStatus(),
            generateEnrollmentId(),
            details.getGroupId(),
            details.getInstituteId(),
            makeExpiryDate(baseDate, details.getAccessDays()),
            details.getPackageSessionId(),
            details.getDestinationPackageSessionId(),
            details.getUserPlanId()
        );

        return studentSessionId.toString();
    }


    private Date determineBaseDate(
        StudentSessionInstituteGroupMapping currentMapping,
        Optional<StudentSessionInstituteGroupMapping> activeDestinationMapping
    ) {
        Date now = new Date();

        if (activeDestinationMapping.isPresent()) {
            Date destExpiry = activeDestinationMapping.get().getExpiryDate();
            if (destExpiry != null && destExpiry.after(now)) {
                return destExpiry; // Extend from destination’s expiry
            }
        }

        if (currentMapping != null &&
            LearnerSessionStatusEnum.ACTIVE.name().equalsIgnoreCase(currentMapping.getStatus()) &&
            currentMapping.getExpiryDate() != null) {
            return currentMapping.getExpiryDate().after(now) ? currentMapping.getExpiryDate() : now;
        }

        return now;
    }



    public String shiftStudentBatch(
        StudentSessionInstituteGroupMapping invitedPackageSession,
        String newStatus
    ) {
        try {
            String userId = invitedPackageSession.getUserId();
            String instituteId = invitedPackageSession.getInstitute().getId();

            StudentSessionInstituteGroupMapping mappingToUse = findOrCreateMapping(
                instituteId, userId, newStatus, invitedPackageSession
            );


            markOldMappingDeleted(invitedPackageSession);

            return studentSessionRepository.save(mappingToUse).getId();
        } catch (Exception e) {
            e.printStackTrace();
            throw new VacademyException("Failed to link student to institute: " + e.getMessage());
        }
    }

    private StudentSessionInstituteGroupMapping findOrCreateMapping(
        String instituteId,
        String userId,
        String newStatus,
        StudentSessionInstituteGroupMapping invitedPackageSession
    ) {
        Optional<StudentSessionInstituteGroupMapping> existingMappingOpt =
            studentSessionRepository.findTopByPackageSessionIdAndUserIdAndStatusIn(
                invitedPackageSession.getDestinationPackageSession().getId(),instituteId, userId, List.of(LearnerSessionStatusEnum.ACTIVE.name())
            );
        StudentSessionInstituteGroupMapping activePackageSession;
        if (existingMappingOpt.isPresent()) {
            activePackageSession = existingMappingOpt.get();
        }
        else{
           activePackageSession = new StudentSessionInstituteGroupMapping();
            activePackageSession.setInstitute(invitedPackageSession.getInstitute());
            activePackageSession.setUserId(invitedPackageSession.getUserId());
            activePackageSession.setInstituteEnrolledNumber(invitedPackageSession.getInstituteEnrolledNumber());
            activePackageSession.setEnrolledDate(new Date());
            activePackageSession.setStatus(newStatus);
            activePackageSession.setPackageSession(invitedPackageSession.getDestinationPackageSession());
            activePackageSession.setUserPlanId(invitedPackageSession.getUserPlanId());
            activePackageSession.setType(invitedPackageSession.getType());
            activePackageSession.setTypeId(invitedPackageSession.getTypeId());
        }
        activePackageSession.setExpiryDate(invitedPackageSession.getExpiryDate());
        return activePackageSession;
    }

    private void updateMappingFields(
        StudentSessionInstituteGroupMapping mappingToUse,
        StudentSessionInstituteGroupMapping sourceMapping,
        String newStatus
    ) {
        mappingToUse.setEnrolledDate(new Date());
        mappingToUse.setStatus(newStatus);

        if (sourceMapping.getInstituteEnrolledNumber() != null) {
            mappingToUse.setInstituteEnrolledNumber(sourceMapping.getInstituteEnrolledNumber());
        }

        if (sourceMapping.getExpiryDate() != null) {
            mappingToUse.setExpiryDate(sourceMapping.getExpiryDate());
        }
    }

    private void markOldMappingDeleted(StudentSessionInstituteGroupMapping mapping) {
        mapping.setStatus(LearnerSessionStatusEnum.DELETED.name());
        studentSessionRepository.save(mapping);
    }



    public List<String> getStudentRoles() {
        List<String> roles = new ArrayList<>();
        roles.add(StudentConstants.studentRole);
        return roles;
    }

    public Date makeExpiryDate(Date enrollmentDate, String accessDays) {
        try {
            if (enrollmentDate == null || accessDays == null) {
                return null;
            }
            Date expiryDate = new Date();
            expiryDate.setTime(enrollmentDate.getTime() + Long.parseLong(accessDays) * 24 * 60 * 60 * 1000);
            return expiryDate;
        } catch (Exception e) {
        }
        return null;
    }

    private Optional<Student> getExistingStudentByUserNameAndUserId(String username, String userId) {
        return instituteStudentRepository.findTopByUserIdOrderByCreatedAtDesc(userId);
    }

    public InstituteStudentDTO updateAsPerConfig(InstituteStudentDTO instituteStudentDTO, BulkUploadInitRequest bulkUploadInitRequest) {
        if (Objects.isNull(bulkUploadInitRequest)) {
            return instituteStudentDTO;
        }
        BulkUploadInitRequest.AutoGenerateConfig autoConfig = bulkUploadInitRequest.getAutoGenerateConfig();
        BulkUploadInitRequest.ExpiryAndStatusConfig expiryAndStatusConfig = bulkUploadInitRequest.getExpiryAndStatusConfig();
        BulkUploadInitRequest.OptionalFieldsConfig optionalFieldsConfig = bulkUploadInitRequest.getOptionalFieldsConfig();

        // Auto-generate username if required
        if (autoConfig.isAutoGenerateUsername()) {
            instituteStudentDTO.getUserDetails().setUsername(generateUsername(instituteStudentDTO.getUserDetails().getFullName()).toLowerCase());
        }

        // Auto-generate password if required
        if (autoConfig.isAutoGeneratePassword() || StringUtils.isEmpty(instituteStudentDTO.getUserDetails().getPassword())) {
            instituteStudentDTO.getUserDetails().setPassword(generatePassword());
        }

        // Auto-generate enrollment number if required
        if (autoConfig.isAutoGenerateEnrollmentId()) {
            instituteStudentDTO.getInstituteStudentDetails().setEnrollmentId(generateEnrollmentId());
        }

        // Set expiry days if included
        if (expiryAndStatusConfig.isIncludeExpiryDays()) {
            instituteStudentDTO.getInstituteStudentDetails().setAccessDays(bulkUploadInitRequest.getExpiryAndStatusConfig().getExpiryDays().toString());
        }

        // Set enrollment status if included
        if (expiryAndStatusConfig.isIncludeEnrollmentStatus()) {
            instituteStudentDTO.getInstituteStudentDetails().setEnrollmentStatus(bulkUploadInitRequest.getExpiryAndStatusConfig().getEnrollmentStatus());
        }

        return instituteStudentDTO;
    }

    private String generateUsername(String fullName) {
        // Ensure full name has at least 4 characters, else pad with "X"
        String namePart = fullName.replaceAll("\\s+", "").substring(0, Math.min(fullName.length(), 4)).toLowerCase();
        if (namePart.length() < 4) {
            namePart = String.format("%-4s", namePart).replace(' ', 'X');
        }

        // Generate 4 random digits
        String randomDigits = RandomStringUtils.randomNumeric(4);

        return namePart + randomDigits;
    }


    private String generatePassword() {
        return RandomStringUtils.randomAlphanumeric(8);
    }

    private String generateEnrollmentId() {
        return RandomStringUtils.randomNumeric(6);
    }

    public String addStudent(UserDTO userDTO){
        return createStudentFromRequest(userDTO, null).getId();
    }
}
