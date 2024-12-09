package vacademy.io.admin_core_service.features.student.manager;


import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.student.constants.StudentConstants;
import vacademy.io.admin_core_service.features.student.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.student.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.student.dto.StudentExtraDetails;
import vacademy.io.admin_core_service.features.student.dto.student_list_dto.StudentListFilter;
import vacademy.io.admin_core_service.features.student.entity.Student;
import vacademy.io.admin_core_service.features.student.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.student.repository.StudentSessionRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.core.utils.DataToCsvConverter;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;

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


    public ResponseEntity<String> addStudentToInstitute(CustomUserDetails user, InstituteStudentDTO instituteStudentDTO) {

        UserDTO createdUser = createUserFromAuthService(instituteStudentDTO);
        Student student = createStudentFromRequest(createdUser, instituteStudentDTO.getStudentExtraDetails());
        linkStudentToInstitute(student, instituteStudentDTO.getInstituteStudentDetails());
        return ResponseEntity.ok("Student added successfully");
    }


    private UserDTO createUserFromAuthService(InstituteStudentDTO instituteStudentDTO) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(applicationName, HttpMethod.POST.name(), authServerBaseUrl, StudentConstants.addUserRoute + "?instituteId=" + instituteStudentDTO.getInstituteStudentDetails().getInstituteId(), instituteStudentDTO.getUserDetails());
            return objectMapper.readValue(response.getBody(), UserDTO.class);

        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

    private Student createStudentFromRequest(UserDTO userDTO, StudentExtraDetails studentExtraDetails) {
        Student student = new Student();
        student.setUserId(userDTO.getId());
        student.setFullName(userDTO.getFullName());
        student.setEmail(userDTO.getEmail());
        student.setMobileNumber(userDTO.getMobileNumber());
        student.setAddressLine(userDTO.getAddressLine());
        student.setCity(userDTO.getCity());
        student.setPinCode(userDTO.getPinCode());
        student.setGender(userDTO.getGender());
        student.setDateOfBirth(userDTO.getDateOfBirth());
        student.setFatherName(studentExtraDetails.getFathersName());
        student.setMotherName(studentExtraDetails.getMothersName());
        student.setParentsMobileNumber(studentExtraDetails.getParentsMobileNumber());
        student.setParentsEmail(studentExtraDetails.getParentsEmail());
        student.setLinkedInstituteName(studentExtraDetails.getLinkedInstituteName());
        return instituteStudentRepository.save(student);
    }

    private void linkStudentToInstitute(Student student, InstituteStudentDetails instituteStudentDetails) {

        try {
            UUID studentSessionId = UUID.randomUUID();
            studentSessionRepository.addStudentToInstitute(studentSessionId.toString(), student.getUserId(), instituteStudentDetails.getEnrollmentDate() == null ? new Date() : instituteStudentDetails.getEnrollmentDate(), instituteStudentDetails.getEnrollmentStatus(), instituteStudentDetails.getEnrollmentId(), instituteStudentDetails.getGroupId(), instituteStudentDetails.getInstituteId(), instituteStudentDetails.getPackageSessionId());
        }
        catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

}
