package vacademy.io.admin_core_service.features.student.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.student.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.student.manager.StudentBulkUploadManager;
import vacademy.io.admin_core_service.features.student.manager.StudentRegistrationManager;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.dto.bulk_csv_upload.CsvInitResponse;

@RestController
@RequestMapping("/admin-core-service/institute/student-bulk/v1")
public class InstituteBulkStudentController {
    @Autowired
    private StudentBulkUploadManager studentBulkUploadManager;

    // Add User to Institute
    @GetMapping("/init-student-upload")
    public ResponseEntity<CsvInitResponse> getCSVUploadSetupDetailsForStudent(@RequestParam(name = "instituteId") String instituteId, @RequestParam(name = "sessionId") String sessionId) {
        return ResponseEntity.ok(studentBulkUploadManager.generateCsvUploadForStudents(instituteId, sessionId));
    }

}
