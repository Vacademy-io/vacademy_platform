package vacademy.io.admin_core_service.features.institute_learner.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentRegistrationManager;
import vacademy.io.admin_core_service.features.institute_learner.notification.LearnerEnrollmentNotificationService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Collections;

@RestController
@RequestMapping("/admin-core-service/institute/institute_learner/v1")
public class InstituteStudentController {

    @Autowired
    private StudentRegistrationManager studentRegistrationManager;

    @Autowired
    private LearnerEnrollmentNotificationService learnerEnrollmentNotificationService;

    // Add User to Institute
    @PostMapping("/add-institute_learner")
    public ResponseEntity<String> addStudentToInstitute(@RequestAttribute("user") CustomUserDetails user, @RequestParam(value = "notify", required = false, defaultValue = "true") boolean notify, @RequestBody InstituteStudentDTO instituteStudentDTO) {
        InstituteStudentDTO instituteStudentDTO1 = studentRegistrationManager.addStudentToInstitute(user, instituteStudentDTO, null);
        if (notify) {
            learnerEnrollmentNotificationService.sendLearnerEnrollmentNotification(Collections.singletonList(instituteStudentDTO), instituteStudentDTO.getInstituteStudentDetails().getInstituteId());
        }
        return ResponseEntity.ok("Student added successfully.");
    }

}
