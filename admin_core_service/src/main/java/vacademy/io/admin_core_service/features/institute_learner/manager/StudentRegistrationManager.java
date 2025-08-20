package vacademy.io.admin_core_service.features.institute_learner.manager;


import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.RandomStringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute_learner.constants.StudentConstants;
import vacademy.io.admin_core_service.features.institute_learner.dto.*;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;

@Component
public class StudentRegistrationManager {

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


    public InstituteStudentDTO addStudentToInstitute(CustomUserDetails user, InstituteStudentDTO instituteStudentDTO, BulkUploadInitRequest bulkUploadInitRequest) {
        instituteStudentDTO = this.updateAsPerConfig(instituteStudentDTO, bulkUploadInitRequest);
        Student student = checkAndCreateStudent(instituteStudentDTO);
        linkStudentToInstitute(student, instituteStudentDTO.getInstituteStudentDetails());
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


    public UserDTO createUserFromAuthService(UserDTO userDTO, String instituteId) {
        try {
            userDTO.setRootUser(true);
            ObjectMapper objectMapper = new ObjectMapper();
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(applicationName, HttpMethod.POST.name(), authServerBaseUrl, StudentConstants.addUserRoute + "?instituteId=" + instituteId, userDTO);
            return objectMapper.readValue(response.getBody(), UserDTO.class);

        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

    private Student checkAndCreateStudent(InstituteStudentDTO instituteStudentDTO) {
        instituteStudentDTO.getUserDetails().setRoles(getStudentRoles());
        setRandomPasswordIfNull(instituteStudentDTO.getUserDetails());
        setRandomUserNameIfNull(instituteStudentDTO.getUserDetails());
        instituteStudentDTO.getUserDetails().setUsername(instituteStudentDTO.getUserDetails().getUsername().toLowerCase());
        setEnrollmentNumberIfNull(instituteStudentDTO.getInstituteStudentDetails());
        UserDTO createdUser = createUserFromAuthService(instituteStudentDTO.getUserDetails(), instituteStudentDTO.getInstituteStudentDetails().getInstituteId());
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

    public String linkStudentToInstitute(Student student, InstituteStudentDetails instituteStudentDetails) {
        try {
            Optional<StudentSessionInstituteGroupMapping> studentSessionInstituteGroupMappingOptional =
                    studentSessionRepository.findTopByPackageSessionIdAndUserIdAndStatusIn(
                            instituteStudentDetails.getPackageSessionId(),
                            instituteStudentDetails.getInstituteId(),
                            student.getUserId(),
                            List.of(
                                    LearnerSessionStatusEnum.ACTIVE.name(),
                                    LearnerSessionStatusEnum.INVITED.name(),
                                    LearnerSessionStatusEnum.TERMINATED.name(),
                                    LearnerSessionStatusEnum.INACTIVE.name()
                            )
                    );

            if (studentSessionInstituteGroupMappingOptional.isPresent()) {
                StudentSessionInstituteGroupMapping mapping = studentSessionInstituteGroupMappingOptional.get();

                // Always update enrolledDate to current time
                mapping.setEnrolledDate(new Date());

                // Conditionally update fields
                if (instituteStudentDetails.getEnrollmentStatus() != null) {
                    mapping.setStatus(instituteStudentDetails.getEnrollmentStatus());
                }

                if (instituteStudentDetails.getEnrollmentId() != null) {
                    mapping.setInstituteEnrolledNumber(studentSessionInstituteGroupMappingOptional.get().getInstituteEnrolledNumber());
                }

                mapping.setUserPlanId(instituteStudentDetails.getUserPlanId());

                if (instituteStudentDetails.getAccessDays() != null) {
                    mapping.setExpiryDate(
                            makeExpiryDate(
                                    instituteStudentDetails.getEnrollmentDate(),
                                    (instituteStudentDetails.getAccessDays())
                            )
                    );
                }

              return  studentSessionRepository.save(mapping).getId();
            } else {
                UUID studentSessionId = UUID.randomUUID();
                studentSessionRepository.addStudentToInstitute(
                        studentSessionId.toString(),
                        student.getUserId(),
                        instituteStudentDetails.getEnrollmentDate() == null ? new Date() : instituteStudentDetails.getEnrollmentDate(),
                        instituteStudentDetails.getEnrollmentStatus(),
                        generateEnrollmentId(),
                        instituteStudentDetails.getGroupId(),
                        instituteStudentDetails.getInstituteId(),
                        makeExpiryDate(
                                instituteStudentDetails.getEnrollmentDate(),
                                instituteStudentDetails.getAccessDays()
                        ),
                        instituteStudentDetails.getPackageSessionId(),
                        instituteStudentDetails.getDestinationPackageSessionId(),
                        instituteStudentDetails.getUserPlanId()
                );
                return studentSessionId.toString();
            }
        } catch (Exception e) {
            throw new VacademyException("Failed to link student to institute: " + e.getMessage());
        }
    }

    // to do: There are some issues about expiry days as if making actual active today than his plan or expriry will be based on today

    public String shiftStudentBatch(String destinationPackageSession,StudentSessionInstituteGroupMapping studentSessionInstituteGroupMapping,String newStatus) {
        try {
            Optional<StudentSessionInstituteGroupMapping> studentSessionInstituteGroupMappingOptional =
                    studentSessionRepository.findTopByPackageSessionIdAndUserIdAndStatusIn(
                            destinationPackageSession,
                            studentSessionInstituteGroupMapping.getInstitute().getId(),
                            studentSessionInstituteGroupMapping.getUserId(),
                            List.of(
                                    LearnerSessionStatusEnum.ACTIVE.name(),
                                    LearnerSessionStatusEnum.INVITED.name(),
                                    LearnerSessionStatusEnum.TERMINATED.name(),
                                    LearnerSessionStatusEnum.INACTIVE.name()
                            )
                    );

            if (studentSessionInstituteGroupMappingOptional.isPresent()) {
                StudentSessionInstituteGroupMapping mapping = studentSessionInstituteGroupMappingOptional.get();

                // Always update enrolledDate to current time
                mapping.setEnrolledDate(new Date());


                mapping.setStatus(newStatus);


                if (studentSessionInstituteGroupMapping.getInstituteEnrolledNumber() != null) {
                    mapping.setInstituteEnrolledNumber(studentSessionInstituteGroupMapping.getInstituteEnrolledNumber());
                }

                if (studentSessionInstituteGroupMapping.getExpiryDate() != null) {
                    mapping.setExpiryDate(
                            studentSessionInstituteGroupMapping.getExpiryDate()
                    );
                }
                studentSessionRepository.save(studentSessionInstituteGroupMapping);
                return  studentSessionRepository.save(mapping).getId();
            } else {
                UUID studentSessionId = UUID.randomUUID();
                studentSessionRepository.addStudentToInstitute(
                        studentSessionId.toString(),
                        studentSessionInstituteGroupMapping.getUserId(),
                        new Date(),
                        newStatus,
                        studentSessionInstituteGroupMapping.getInstituteEnrolledNumber(),
                        (studentSessionInstituteGroupMapping.getGroup() != null ? studentSessionInstituteGroupMapping.getGroup().getId() : null),
                        studentSessionInstituteGroupMapping.getInstitute().getId(),
                        studentSessionInstituteGroupMapping.getExpiryDate(),
                        destinationPackageSession,
                        null,
                        studentSessionInstituteGroupMapping.getUserPlanId()
                );
                studentSessionInstituteGroupMapping.setStatus(LearnerSessionStatusEnum.DELETED.name());
                studentSessionRepository.save(studentSessionInstituteGroupMapping);
                return studentSessionId.toString();
            }
        } catch (Exception e) {
            throw new VacademyException("Failed to link student to institute: " + e.getMessage());
        }
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
        return instituteStudentRepository.findByUserId(userId);
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