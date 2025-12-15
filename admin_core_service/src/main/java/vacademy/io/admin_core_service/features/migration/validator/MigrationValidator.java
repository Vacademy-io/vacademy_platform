package vacademy.io.admin_core_service.features.migration.validator;

import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;

@Component
public class MigrationValidator {

    private static final Pattern EMAIL_PATTERN = Pattern
            .compile("^(?![\\s\\S])|^((?!\\.)[\\w\\-_.]*[^.])(@\\w+)(\\.\\w+(\\.\\w+)?[^.\\W])$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^\\+\\d{1,3}-\\d{6,14}$");

    private static final List<String> VALID_COUNTRIES = Arrays.asList(
            "Australia", "Austria", "Brazil", "Canada", "China", "New Zealand", "United Kingdom", "United States",
            "India");

    private static final List<String> VALID_JOB_TYPES = Arrays.asList(
            "Veterinarian", "Vet Nurse/Tech", "Vet Nurse/Tech Student", "Vet Student", "Practice Manager", "Others");

    private static final List<String> VALID_PHONE_TYPES = Arrays.asList(
            "Work", "Home", "Mobile", "Other");

    private static final List<String> VALID_PRACTICE_ROLES = Arrays.asList(
            "ROOT_ADMIN", "ADMIN", "LEARNER");

    public String validateIndividualUser(CSVRecord record) {
        StringBuilder error = new StringBuilder();

        // Mandatory Fields
        validateMandatory(record, "ContactId", error);
        validateMandatory(record, "Email", error);
        validateMandatory(record, "FirstName", error);
        validateMandatory(record, "LastName", error);
        validateMandatory(record, "Phone1", error);
        validateMandatory(record, "City", error);
        validateMandatory(record, "State", error);
        validateMandatory(record, "PostalCode", error);
        validateMandatory(record, "StartDate", error);
        validateMandatory(record, "Currency", error);
        validateMandatory(record, "Status", error);
        validateMandatory(record, "NextBillDate", error);
        validateMandatory(record, "Token", error);

        // Regex Validation
        validateRegex(record, "Email", EMAIL_PATTERN, "Invalid Email format", error);
        validateRegex(record, "Phone1", PHONE_PATTERN, "Invalid Phone format", error);

        // Enum Validation
        validateEnum(record, "Status", Arrays.asList("ACTIVE", "CANCELLED", "CANCLED"), error);
        validateEnum(record, "Country", VALID_COUNTRIES, error);
        validateEnum(record, "Job Type", VALID_JOB_TYPES, error);
        validateEnum(record, "Phone Type", VALID_PHONE_TYPES, error);

        return error.toString();
    }

    public String validatePracticeUser(CSVRecord record) {
        StringBuilder error = new StringBuilder();

        // Mandatory Fields
        validateMandatory(record, "ContactId", error);
        validateMandatory(record, "Email", error);
        validateMandatory(record, "FirstName", error);
        validateMandatory(record, "LastName", error);
        validateMandatory(record, "Phone1", error);
        validateMandatory(record, "City", error);
        validateMandatory(record, "State", error);
        validateMandatory(record, "PostalCode", error);
        validateMandatory(record, "Practice Name", error);
        validateMandatory(record, "PRACTICE_ROLE", error);
        validateMandatory(record, "StartDate", error);
        validateMandatory(record, "Currency", error);
        validateMandatory(record, "Status", error);
        validateMandatory(record, "NextBillDate", error);
        validateMandatory(record, "Token", error);

        // Regex Validation
        validateRegex(record, "Email", EMAIL_PATTERN, "Invalid Email format", error);
        validateRegex(record, "Phone1", PHONE_PATTERN, "Invalid Phone format", error);

        // Enum Validation
        validateEnum(record, "PRACTICE_ROLE", VALID_PRACTICE_ROLES, error);
        validateEnum(record, "Status", Arrays.asList("ACTIVE", "CANCELLED", "CANCLED"), error);
        validateEnum(record, "Country", VALID_COUNTRIES, error);
        validateEnum(record, "Job Type", VALID_JOB_TYPES, error);
        validateEnum(record, "Phone Type", VALID_PHONE_TYPES, error);

        return error.toString();
    }

    public String validatePayment(CSVRecord record) {
        StringBuilder error = new StringBuilder();

        // Mandatory Fields
        validateMandatory(record, "ContactId", error);
        validateMandatory(record, "Email", error);
        validateMandatory(record, "Amount", error);
        validateMandatory(record, "Date", error);
        validateMandatory(record, "TransactionId", error);
        validateMandatory(record, "Status", error);

        // Regex Validation
        validateRegex(record, "Email", EMAIL_PATTERN, "Invalid Email format", error);

        // Enum Validation
        validateEnum(record, "Status", Arrays.asList("PAID", "FAILED"), error);

        return error.toString();
    }

    private void validateMandatory(CSVRecord record, String field, StringBuilder error) {
        if (!record.isMapped(field) || record.get(field) == null || record.get(field).trim().isEmpty()) {
            appendError(error, field + " is required");
        }
    }

    private void validateRegex(CSVRecord record, String field, Pattern pattern, String msg, StringBuilder error) {
        if (record.isMapped(field) && record.get(field) != null && !record.get(field).trim().isEmpty()) {
            if (!pattern.matcher(record.get(field).trim()).matches()) {
                appendError(error, msg + " for " + field);
            }
        }
    }

    private void validateEnum(CSVRecord record, String field, List<String> validValues, StringBuilder error) {
        if (record.isMapped(field) && record.get(field) != null && !record.get(field).trim().isEmpty()) {
            if (!validValues.contains(record.get(field).trim())) {
                appendError(error, "Invalid value for " + field);
            }
        }
    }

    private void appendError(StringBuilder sb, String msg) {
        if (sb.length() > 0) {
            sb.append("; ");
        }
        sb.append(msg);
    }
}
