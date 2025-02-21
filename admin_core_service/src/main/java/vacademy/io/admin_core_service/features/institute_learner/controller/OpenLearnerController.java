package vacademy.io.admin_core_service.features.institute_learner.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentDTO;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentRegistrationManager;
import vacademy.io.common.auth.dto.UserDTO;

@RestController
@RequestMapping("/admin-core-service/institute/open_learner/v1")
public class OpenLearnerController {

    @Autowired
    private StudentRegistrationManager studentRegistrationManager;

    // Add User to Institute
    @PostMapping("/add-institute_learner")
    public ResponseEntity<StudentDTO> addStudentToInstitute(@RequestBody UserDTO userDTO, @RequestParam String instituteId) {
        return studentRegistrationManager.addOpenStudentToInstitute(userDTO, instituteId);

    }

}
