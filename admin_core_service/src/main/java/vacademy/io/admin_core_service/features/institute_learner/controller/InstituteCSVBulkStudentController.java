package vacademy.io.admin_core_service.features.institute_learner.controller;


import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.institute_learner.dto.BulkUploadInitRequest;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentBulkInitUploadManager;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentBulkUploadManager;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.dto.bulk_csv_upload.CsvInitResponse;
import vacademy.io.common.core.utils.CSVHelper;
import vacademy.io.common.exceptions.VacademyException;

@RestController
@RequestMapping("/admin-core-service/institute/institute_learner-bulk/v1")
public class InstituteCSVBulkStudentController {


    @Autowired
    private StudentBulkInitUploadManager studentBulkInitUploadManager;

    @Autowired
    private StudentBulkUploadManager studentBulkUpload;

    // Add User to Institute
    @PostMapping("/content_structure-institute_learner-upload")
    public ResponseEntity<CsvInitResponse> getCSVUploadSetupDetailsForStudent(@RequestParam(name = "instituteId") String instituteId,
                                                                              @RequestBody BulkUploadInitRequest bulkUploadInitRequest) {
        return ResponseEntity.ok(studentBulkInitUploadManager.generateCsvUploadForStudents(instituteId, bulkUploadInitRequest));
    }

    @PostMapping(value = "/upload-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<byte[]> uploadStudentCsv(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "instituteId", required = false) String instituteId,
            @RequestParam("bulkUploadInitRequest") String bulkUploadInitRequestJson,
            @RequestParam("packageSessionId") String packageSessionId,
            @RequestParam(value = "notify", required = false, defaultValue = "true") Boolean notify,
            @RequestAttribute(name = "user") CustomUserDetails user) {

        // Convert JSON string to BulkUploadInitRequest object
        ObjectMapper objectMapper = new ObjectMapper();
        BulkUploadInitRequest bulkUploadInitRequest;
        try {
            bulkUploadInitRequest = objectMapper.readValue(bulkUploadInitRequestJson, BulkUploadInitRequest.class);
        } catch (JsonProcessingException e) {
            throw new VacademyException("Invalid bulkUploadInitRequest format");
        }

        if (CSVHelper.hasCSVFormat(file)) {
            return studentBulkUpload.uploadStudentCsv(file, instituteId, bulkUploadInitRequest, packageSessionId, notify, user);
        }

        throw new VacademyException("Please upload a valid CSV file");
    }

}
