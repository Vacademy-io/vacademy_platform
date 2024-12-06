package vacademy.io.admin_core_service.features.student.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.student.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.student.dto.student_list_dto.AllStudentResponse;
import vacademy.io.admin_core_service.features.student.dto.student_list_dto.StudentListFilter;
import vacademy.io.admin_core_service.features.student.manager.StudentListManager;
import vacademy.io.admin_core_service.features.student.manager.StudentRegistrationManager;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

import static vacademy.io.common.auth.config.PageConstants.DEFAULT_PAGE_NUMBER;

@RestController
@RequestMapping("/admin-core-service/institute/student/get/v1")
public class InstituteGetStudentController {


    @Autowired
    private StudentListManager studentListManager;


    @PostMapping("/all")
    public ResponseEntity<AllStudentResponse> getLinkedStudents(@RequestAttribute(name = "user") CustomUserDetails user,
                                                                @RequestBody StudentListFilter studentListFilter,
                                                                @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                                                                @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE, required = false) int pageSize) {
        return studentListManager.getLinkedStudents(user, studentListFilter, pageNo, pageSize);
    }

}
