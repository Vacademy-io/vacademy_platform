package vacademy.io.admin_core_service.features.institute_learner.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute_learner.dto.student_list_dto.AllStudentResponse;
import vacademy.io.admin_core_service.features.institute_learner.dto.student_list_dto.StudentListFilter;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentListManager;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

import static vacademy.io.common.auth.config.PageConstants.DEFAULT_PAGE_NUMBER;

@RestController
@RequestMapping("/admin-core-service/institute/institute_learner/get/v1")
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

    @PostMapping("/all-csv")
    public ResponseEntity<byte[]> getStudentsCsvExport(@RequestAttribute(name = "user") CustomUserDetails user,
                                                       @RequestBody StudentListFilter studentListFilter,
                                                       @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                                                       @RequestParam(value = "pageSize", defaultValue = PageConstants.DEFAULT_PAGE_SIZE, required = false) int pageSize) {
        return studentListManager.getStudentsCsvExport(user, studentListFilter, pageNo, pageSize);
    }

}
