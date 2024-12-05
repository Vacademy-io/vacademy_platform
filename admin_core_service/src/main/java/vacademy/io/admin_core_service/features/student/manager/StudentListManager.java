package vacademy.io.admin_core_service.features.student.manager;


import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.student.constants.StudentConstants;
import vacademy.io.admin_core_service.features.student.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.student.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.student.dto.StudentExtraDetails;
import vacademy.io.admin_core_service.features.student.entity.Student;
import vacademy.io.admin_core_service.features.student.repository.StudentRepository;
import vacademy.io.admin_core_service.features.student.repository.StudentSessionRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Date;
import java.util.UUID;

@Component
public class StudentListManager {

    @Autowired
    InternalClientUtils internalClientUtils;

    @Autowired
    StudentRepository studentRepository;

    @Autowired
    StudentSessionRepository studentSessionRepository;

    @Value("${auth.server.baseurl}")
    private String authServerBaseUrl;
    @Value("${spring.application.name}")
    private String applicationName;

}
