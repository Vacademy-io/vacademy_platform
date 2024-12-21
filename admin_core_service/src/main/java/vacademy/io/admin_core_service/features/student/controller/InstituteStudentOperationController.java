package vacademy.io.admin_core_service.features.student.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.student.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.student.dto.StudentStatusUpdateRequestWrapper;
import vacademy.io.admin_core_service.features.student.manager.StudentRegistrationManager;
import vacademy.io.admin_core_service.features.student.manager.StudentSessionManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/institute/student-operation/v1")
public class InstituteStudentOperationController {

    @Autowired private
    StudentSessionManager manager;

    @PostMapping("/update")
    public void updateStudentStatus(@RequestAttribute("user") CustomUserDetails user, @RequestBody StudentStatusUpdateRequestWrapper requestWrapper) {
        manager.updateStudentStatus(requestWrapper.getRequests(), requestWrapper.getOperation());
    }

}
