package vacademy.io.admin_core_service.features.student.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.student.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.student.manager.StudentRegistrationManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/institute/student/get/v1")
public class InstituteGetStudentController {


    @Autowired
    private StudentRegistrationManager studentRegistrationManager;


    // Add User to Institute
    @PostMapping("/add-student")
    public ResponseEntity<String> addStudentToInstitute(@RequestAttribute("user") CustomUserDetails user, @RequestBody InstituteStudentDTO instituteStudentDTO) {
        return studentRegistrationManager.addStudentToInstitute(user, instituteStudentDTO);
    }

}
