package vacademy.io.admin_core_service.features.student.service;


import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVRecord;
import vacademy.io.admin_core_service.features.student.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.student.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.student.dto.StudentExtraDetails;
import vacademy.io.common.auth.dto.UserDTO;

import java.io.Reader;
import java.io.StringReader;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

public class CsvToStudentDataMapper {

    public static List<InstituteStudentDTO> mapCsvRecordsToInstituteStudentDTOs(Iterable<CSVRecord> records, String instituteId) {
        List<InstituteStudentDTO> students = new ArrayList<>();

        for (CSVRecord record : records) {
            UserDTO userDetails = new UserDTO(
                    null,
                    getFieldValue(record, "USERNAME"),
                    getFieldValue(record, "EMAIL"),
                    getFieldValue(record, "FULL_NAME"),
                    getFieldValue(record, "ADDRESS_LINE"),
                    getFieldValue(record, "CITY"),
                    getFieldValue(record, "REGION"),
                    getFieldValue(record, "PIN_CODE"),
                    getFieldValue(record, "MOBILE_NUMBER"),
                    parseDate(getFieldValue(record, "DATE_OF_BIRTH")),
                    getFieldValue(record, "GENDER"),
                    false,
                    null,
                    null,
                    null
            );

            StudentExtraDetails studentExtraDetails = new StudentExtraDetails(
                    getFieldValue(record, "FATHER_NAME"),
                    getFieldValue(record, "MOTHER_NAME"),
                    getFieldValue(record, "PARENTS_MOBILE_NUMBER"),
                    getFieldValue(record, "PARENTS_EMAIL"),
                    getFieldValue(record, "LINKED_INSTITUTE_NAME")
            );

            InstituteStudentDetails instituteStudentDetails = new InstituteStudentDetails(
                    instituteId,
                    getFieldValue(record, "PACKAGE_SESSION_ID"),
                    getFieldValue(record, "ENROLLMENT_NUMBER"),
                    getFieldValue(record, "ENROLLMENT_STATUS"),
                    parseDate(getFieldValue(record, "ENROLLMENT_DATE")),
                    getFieldValue(record, "GROUP_ID"),
                    getFieldValue(record, "ACCESS_DAYS")
            );

            InstituteStudentDTO student = new InstituteStudentDTO(userDetails, studentExtraDetails, instituteStudentDetails, null, null, null);
            students.add(student);

        }

        return students;
    }

    private static Date parseDate(String dateStr) {
        if (dateStr == null || dateStr.isEmpty()) {
            return null;
        }
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd");
        try {
            return formatter.parse(dateStr);
        } catch (ParseException e) {
            return null;
        }
    }

    private static String getFieldValue(CSVRecord record, String fieldName) {
        return record.isMapped(fieldName) ? record.get(fieldName) : null;
    }

}
