package vacademy.io.admin_core_service.features.student.service;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;

import vacademy.io.admin_core_service.features.student.dto.InstituteStudentDTO;

import java.io.IOException;
import java.io.PrintWriter;
import java.io.Writer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

public class StudentDataToCsvWriter {

    public static void writeInstituteStudentDTOsToCsv(List<InstituteStudentDTO> students, Writer writer) throws IOException {
        String[] headers = {"FULL_NAME", "USERNAME", "GENDER", "ENROLLMENT_DATE", "ENROLLMENT_NUMBER", "MOBILE_NUMBER",
                "DATE_OF_BIRTH", "PACKAGE_SESSION", "ACCESS_DAYS", "EMAIL", "ENROLLMENT_STATUS",
                "ADDRESS_LINE", "REGION", "CITY", "PIN_CODE", "FATHER_NAME", "MOTHER_NAME",
                "PARENTS_MOBILE_NUMBER", "PARENTS_EMAIL", "LINKED_INSTITUTE_NAME", "INSTITUTE_ID", "STATUS", "STATUS_MESSAGE", "ERROR"};

        CSVFormat csvFormat = CSVFormat.DEFAULT
                .withHeader(headers)
                .withQuote(null);

        try (CSVPrinter csvPrinter = new CSVPrinter(writer, csvFormat)) {
            for (InstituteStudentDTO student : students) {
                csvPrinter.printRecord(
                        student.getUserDetails().getFullName(),
                        student.getUserDetails().getUsername(),
                        student.getUserDetails().getGender(),
                        student.getInstituteStudentDetails().getEnrollmentDate(),
                        student.getInstituteStudentDetails().getEnrollmentId(),
                        student.getUserDetails().getMobileNumber(),
                        student.getUserDetails().getDateOfBirth(),
                        student.getInstituteStudentDetails().getPackageSessionId(),
                        null,  // ACCESS_DAYS not provided in InstituteStudentDTO, can be adjusted if needed
                        student.getUserDetails().getEmail(),
                        student.getInstituteStudentDetails().getEnrollmentStatus(),
                        student.getUserDetails().getAddressLine(),
                        student.getUserDetails().getRegion(),
                        student.getUserDetails().getCity(),
                        student.getUserDetails().getPinCode(),
                        student.getStudentExtraDetails().getFathersName(),
                        student.getStudentExtraDetails().getMothersName(),
                        student.getStudentExtraDetails().getParentsMobileNumber(),
                        student.getStudentExtraDetails().getParentsEmail(),
                        student.getStudentExtraDetails().getLinkedInstituteName(),
                        student.getInstituteStudentDetails().getInstituteId(),
                        student.getStatus(),
                        student.getStatusMessage(),
                        student.getErrorMessage()
                );
            }
        }
    }

    private static String getFieldValue(CSVRecord record, String fieldName) {
        return record.isMapped(fieldName) ? record.get(fieldName) : null;
    }

    private static LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isEmpty()) {
            return null;
        }

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd-MM-yyyy");
        try {
            return LocalDate.parse(dateStr, formatter);
        } catch (DateTimeParseException e) {
            e.printStackTrace();
            return null;
        }
    }

}
