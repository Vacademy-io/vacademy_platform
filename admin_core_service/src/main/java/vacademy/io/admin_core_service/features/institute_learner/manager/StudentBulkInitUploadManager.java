package vacademy.io.admin_core_service.features.institute_learner.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.institute_learner.dto.BulkUploadInitRequest;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.core.dto.bulk_csv_upload.CsvInitResponse;
import vacademy.io.common.core.dto.bulk_csv_upload.CsvSubmitApi;
import vacademy.io.common.core.dto.bulk_csv_upload.Header;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.*;

import static vacademy.io.common.core.utils.BulkCsvUploadHelper.*;

@Component
public class StudentBulkInitUploadManager {

    @Autowired
    PackageSessionRepository packageSessionRepository;

    public CsvInitResponse generateCsvUploadForStudents(String instituteId, BulkUploadInitRequest bulkUploadInitRequest) {

        BulkUploadInitRequest.AutoGenerateConfig autoGenerateConfig = bulkUploadInitRequest.getAutoGenerateConfig();
        BulkUploadInitRequest.ExpiryAndStatusConfig expiryAndStatusConfig = bulkUploadInitRequest.getExpiryAndStatusConfig();
        BulkUploadInitRequest.OptionalFieldsConfig optionalFieldsConfig = bulkUploadInitRequest.getOptionalFieldsConfig();

        String title = "Student Bulk CSV Upload";
        List<String> instructions = Arrays.asList("Upload A Valid CSV", "Ensure all mandatory fields are filled.");
        Map<String, String> requestMap = new HashMap<>();

        requestMap.put("instituteId", instituteId);
        CsvSubmitApi api = createSubmitApi("/admin-core-service/institute/institute_learner-bulk/v1/upload-csv", "STATUS", "ERROR", requestMap);

        List<Header> headers = new ArrayList<>();

        // Adding mandatory string headers one by one
        int order = 1;
        headers.add(createHeader("string", false, "FULL_NAME", order++, List.of("John Henry", "Doe Walker", "Smith Jones")));

        if (!autoGenerateConfig.isAutoGenerateUsername()) {
            headers.add(createHeader("string", false, "USERNAME", order++, List.of("johnhenry", "doewalker", "smithjones")));
        }
        if (!autoGenerateConfig.isAutoGeneratePassword()) {
            headers.add(createRegexHeader("regex", false, "PASSWORD", "^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d]{8}$",
                    "Password must be exactly 8 characters long and contain both letters and numbers",
                    order++, List.of("a1b2C3oa", "Xy9zaq8W", "pQ4r5iaT")));
        }

        Map<String, List<String>> enumValues = new HashMap<>();
        enumValues.put("GENDER", Arrays.asList("MALE", "FEMALE", "OTHER"));
        headers.add(createEnumHeader("enum", false, "GENDER", Arrays.asList("MALE", "FEMALE", "OTHER"), order++, List.of("MALE", "FEMALE", "OTHER")));
        // Adding date header
        Header enrollmentDateHeader = createRegexHeader("regex", false, "ENROLLMENT_DATE",
                "^(0[1-9]|[12][0-9]|3[01])([./-])(0[1-9]|1[0-2])\\2\\d{4}$",
                "Date must be in format dd/mm/yyyy, dd-mm-yyyy, or dd.mm.yyyy",
                order++, List.of("01-11-2000", "21/01/2001", "11.12.2002"));
        headers.add(enrollmentDateHeader);

        if (!autoGenerateConfig.isAutoGenerateEnrollmentId()) {
            headers.add(createHeader("string", false, "ENROLLMENT_NUMBER", order++, List.of("1234", "5678", "9012")));
        }
        headers.add(createRegexHeader("regex", false, "MOBILE_NUMBER", "^\\d+$",
                "Mobile number must contain only digits", order++, List.of("911234567890", "919876543210", "911234567891")));


        // Adding date header
        Header dateHeader = createRegexHeader("regex", true, "DATE_OF_BIRTH",
                "^(0[1-9]|[12][0-9]|3[01])([./-])(0[1-9]|1[0-2])\\2\\d{4}$",
                "Date must be in format dd/mm/yyyy, dd-mm-yyyy, or dd.mm.yyyy",
                order++, List.of("01/11/2000", "21-01-2001", "11.12.2002"));
        headers.add(dateHeader);


        // Adding package session header
        if (!expiryAndStatusConfig.isIncludeExpiryDays()) {
            headers.add(createHeader("integer", false, "ACCESS_DAYS", order++, List.of("30", "180", "365")));
        }

        // integer

        // Adding regex header for email validation
        Header emailHeader = createRegexHeader("regex", false, "EMAIL",
                "^(?![\\s\\S])|^((?!\\.)[\\w\\-_.]*[^.])(@\\w+)(\\.\\w+(\\.\\w+)?[^.\\W])$",
                "Invalid email format", order++, List.of("john@example.com", "doe@example.com", "smith@example.com"));
        headers.add(emailHeader);

        // Adding optional string headers one by one
        if (!expiryAndStatusConfig.isIncludeEnrollmentStatus()) {
            headers.add(createEnumHeader("string", true, "ENROLLMENT_STATUS", Arrays.asList("ACTIVE", "PENDING", "INACTIVE"), order++, List.of("PENDING", "ACTIVE", "INACTIVE")));
        }
        if (optionalFieldsConfig.isIncludeAddressLine()) {
            headers.add(createHeader("string", false, "ADDRESS_LINE", order++, List.of("Street 1", "Street 2", "Street 3")));
        } else {
            headers.add(createHeader("string", true, "ADDRESS_LINE", order++, List.of("Street 1", "Street 2", "Street 3")));
        }
        if (optionalFieldsConfig.isIncludeRegion()) {
            headers.add(createHeader("string", false, "REGION", order++, List.of("MP", "UP", "AP")));
        } else {
            headers.add(createHeader("string", true, "REGION", order++, List.of("MP", "UP", "AP")));
        }
        if (optionalFieldsConfig.isIncludeCity()) {
            headers.add(createHeader("string", false, "CITY", order++, List.of("Indore", "Bhopal", "Jaipur")));
        } else {
            headers.add(createHeader("string", true, "CITY", order++, List.of("Indore", "Bhopal", "Jaipur")));
        }
        if (optionalFieldsConfig.isIncludePinCode()) {
            headers.add(createRegexHeader("regex", false, "PIN_CODE", "\\d{6}","Invalid pin code",order++, List.of("452001", "462001", "452002")));
        } else {
            headers.add(createRegexHeader("regex", true, "PIN_CODE", "\\d{6}","Invalid pin code",order++, List.of("452001", "462001", "452002")));
        }
        if (optionalFieldsConfig.isIncludeFatherName()) {
            headers.add(createHeader("string", false, "FATHER_NAME", order++, List.of("John Henry", "Doe Walker", "Smith Jones")));
        } else {
            headers.add(createHeader("string", true, "FATHER_NAME", order++, List.of("John Henry", "Doe Walker", "Smith Jones")));
        }
        if (optionalFieldsConfig.isIncludeMotherName()) {
            headers.add(createHeader("string", false, "MOTHER_NAME", order++, List.of("John Henry", "Doe Walker", "Smith Jones")));
        } else {
            headers.add(createHeader("string", true, "MOTHER_NAME", order++, List.of("John Henry", "Doe Walker", "Smith Jones")));
        }
        if (optionalFieldsConfig.isIncludeParentsMobileNumber()) {
            headers.add(createRegexHeader("regex", false, "PARENTS_MOBILE_NUMBER", "^\\d+$",
                    "Mobile number must contain only digits", order++, List.of("911234567890", "919876543210", "911234567891")));
        } else {
            headers.add(createRegexHeader("regex", true, "PARENTS_MOBILE_NUMBER", "^\\d+$",
                    "Mobile number must contain only digits", order++, List.of("911234567890", "919876543210", "911234567891")));
        }
        if (optionalFieldsConfig.isIncludeParentsEmail()) {
            emailHeader = createRegexHeader("regex", false, "PARENTS_EMAIL",
                    "^(?![\\s\\S])|^((?!\\.)[\\w\\-_.]*[^.])(@\\w+)(\\.\\w+(\\.\\w+)?[^.\\W])$",
                    "Invalid email format", order++, List.of("john@example.com", "doe@example.com", "smith@example.com"));
            headers.add(emailHeader);
        } else {
            emailHeader = createRegexHeader("regex", true, "PARENTS_EMAIL",
                    "^(?![\\s\\S])|^((?!\\.)[\\w\\-_.]*[^.])(@\\w+)(\\.\\w+(\\.\\w+)?[^.\\W])$",
                    "Invalid email format", order++, List.of("john@example.com", "doe@example.com", "smith@example.com"));
            headers.add(emailHeader);
        }
        if (optionalFieldsConfig.isIncludeLinkedInstituteName()) {
            headers.add(createHeader("string", false, "LINKED_INSTITUTE_NAME", order++, List.of("St. Joseph coed School", "St. Paul coed School", "St. Xavier coed School")));
        } else {
            headers.add(createHeader("string", true, "LINKED_INSTITUTE_NAME", order++, List.of("St. Joseph coed School", "St. Paul coed School", "St. Xavier coed School")));
        }
        return new CsvInitResponse(title, instructions, api, headers);
    }

    private Map<String, String> createPackageSessionMapForInstituteAndSession(String instituteId, String sessionId) {
        Map<String, String> packageSessionMap = new HashMap<>();
        List<PackageSession> packageSessions = packageSessionRepository.findPackageSessionsByInstituteIdAndSessionId(instituteId, sessionId);

        for (PackageSession packageSession : packageSessions) {
            String packageSessionId = packageSession.getId();
            String name = packageSession.getLevel().getLevelName() + " - " + packageSession.getPackageEntity().getPackageName() + " - " + packageSession.getSession().getSessionName();

            packageSessionMap.put(packageSessionId, name);
        }

        return packageSessionMap;
    }
}