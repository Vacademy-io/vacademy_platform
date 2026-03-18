package vacademy.io.admin_core_service.features.institute_learner.manager;


import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVRecord;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.institute_learner.dto.BulkUploadInitRequest;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.institute_learner.notification.LearnerEnrollmentNotificationService;
import vacademy.io.admin_core_service.features.institute_learner.service.CsvToStudentDataMapper;
import vacademy.io.admin_core_service.features.institute_learner.service.StudentDataToCsvWriter;
import vacademy.io.admin_core_service.features.learner.dto.SubOrgEnrollRequestDTO;
import vacademy.io.admin_core_service.features.learner.service.SubOrgLearnerService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.io.ByteArrayOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.Reader;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Component
public class StudentBulkUploadManager {

    @Autowired
    StudentRegistrationManager studentRegistrationManager;

    @Autowired
    private LearnerEnrollmentNotificationService learnerEnrollmentNotificationService;

    @Autowired
    private SubOrgLearnerService subOrgLearnerService;

    public ResponseEntity<byte[]> uploadStudentCsv(MultipartFile file, String instituteId, BulkUploadInitRequest bulkUploadInitRequest, String packageSessionId, boolean notify, CustomUserDetails user, String subOrgId) {


        try (Reader reader = new InputStreamReader(file.getInputStream())) {
            // Configure CSV format to parse the CSV file with headers and trimming options
            CSVFormat csvFormat = CSVFormat.DEFAULT
                    .withFirstRecordAsHeader()  // Treat the first line as headers
                    .withIgnoreHeaderCase()     // Ignore case for headers
                    .withIgnoreEmptyLines()      // Skip empty lines
                    .withTrim();

            // Parse the CSV file and retrieve records
            Iterable<CSVRecord> records = csvFormat.parse(reader);
            List<InstituteStudentDTO> students = CsvToStudentDataMapper.mapCsvRecordsToInstituteStudentDTOs(records, instituteId, packageSessionId);
            List<InstituteStudentDTO> notifyStudents = new ArrayList<>();
            for (InstituteStudentDTO student : students) {
                try {
                    if (StringUtils.hasText(subOrgId)) {
                        // Sub-org enrollment: use SubOrgLearnerService for seat validation + UserPlan
                        UserDTO studentUser = student.getUserDetails();
                        SubOrgEnrollRequestDTO subOrgRequest = SubOrgEnrollRequestDTO.builder()
                                .user(studentUser)
                                .packageSessionId(packageSessionId)
                                .subOrgId(subOrgId)
                                .instituteId(instituteId)
                                .enrolledDate(new Date())
                                .status("ACTIVE")
                                .commaSeparatedOrgRoles("LEARNER")
                                .build();
                        subOrgLearnerService.enrollLearnerToSubOrg(subOrgRequest, user);
                    } else {
                        studentRegistrationManager.addStudentToInstitute(user, student, bulkUploadInitRequest);
                    }
                    notifyStudents.add(student);
                    student.setStatus(true);
                    student.setStatusMessage("Student added successfully with username : " + student.getUserDetails().getUsername());
                } catch (Exception e) {
                    student.setStatus(false);
                    student.setErrorMessage(e.getMessage());
                }
            }

            if (notify) {
                learnerEnrollmentNotificationService.sendLearnerEnrollmentNotification(notifyStudents, instituteId);
            }

            ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
            OutputStreamWriter writer = new OutputStreamWriter(byteArrayOutputStream);

            // 3. Write the processed tenant data to the CSV format
            StudentDataToCsvWriter.writeInstituteStudentDTOsToCsv(students, writer);

            // 4. Convert the written CSV data to a byte array for response
            byte[] csvData = byteArrayOutputStream.toByteArray();

            // 5. Set headers for the response to trigger a CSV download
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("text/csv"));
            headers.setContentDisposition(ContentDisposition.builder("attachment").filename("students.csv").build());

            // 6. Return the CSV data in the ResponseEntity
            return new ResponseEntity<>(csvData, headers, HttpStatus.OK);

        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }

    }

}
