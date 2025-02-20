package vacademy.io.admin_core_service.features.institute_learner.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentRegistrationManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/institute/institute_learner/v1")
public class InstituteStudentController {

    @Autowired
    private StudentRegistrationManager studentRegistrationManager;

    // Add User to Institute
    @PostMapping("/add-institute_learner")
    public ResponseEntity<String> addStudentToInstitute(@RequestAttribute("user") CustomUserDetails user, @RequestBody InstituteStudentDTO instituteStudentDTO) {
        return studentRegistrationManager.addStudentToInstitute(user, instituteStudentDTO, null);
    }

}
