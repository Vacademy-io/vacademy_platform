package vacademy.io.admin_core_service.features.student.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.student.manager.StudentBulkInitUploadManager;
import vacademy.io.admin_core_service.features.student.manager.StudentBulkUploadManager;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.dto.bulk_csv_upload.CsvInitResponse;
import vacademy.io.common.core.utils.CSVHelper;
import vacademy.io.common.exceptions.VacademyException;

@RestController
@RequestMapping("/admin-core-service/institute/student-bulk/v1")
public class InstituteCSVBulkStudentController {


    @Autowired
    private StudentBulkInitUploadManager studentBulkInitUploadManager;

    @Autowired
    private StudentBulkUploadManager studentBulkUpload;

    // Add User to Institute
    @GetMapping("/init-student-upload")
    public ResponseEntity<CsvInitResponse> getCSVUploadSetupDetailsForStudent(@RequestParam(name = "instituteId") String instituteId, @RequestParam(name = "sessionId") String sessionId) {
        return ResponseEntity.ok(studentBulkInitUploadManager.generateCsvUploadForStudents(instituteId, sessionId));
    }

    @PostMapping("/upload-csv")
    public ResponseEntity<byte[]> uploadStudentCsv(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "instituteId", required = false) String instituteId,
            @RequestAttribute(name = "user") CustomUserDetails user) {

        // Check if the uploaded file has a CSV format
        if (CSVHelper.hasCSVFormat(file)) {
            return studentBulkUpload.uploadStudentCsv(file, instituteId, user);
        }

        throw new VacademyException("Please upload a valid CSV file");
    }
}
