package vacademy.io.admin_core_service.features.migration.validator;

import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
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
        // City, State, PostalCode are OPTIONAL
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
        // City, State, PostalCode are OPTIONAL

        // Practice Name is mandatory only for ROOT_ADMIN
        String roleStr = record.isMapped("PRACTICE_ROLE") ? record.get("PRACTICE_ROLE") : null;
        List<String> roles = roleStr != null ? Arrays.asList(roleStr.split("\\s*,\\s*")) : new ArrayList<>();

        if (roles.stream().anyMatch("ROOT_ADMIN"::equalsIgnoreCase)) {
            validateMandatory(record, "Practice Name", error);
        } else if (roles.stream().anyMatch(r -> "ADMIN".equalsIgnoreCase(r) || "LEARNER".equalsIgnoreCase(r))) {
            validateMandatory(record, "ROOT_ADMIN_ID", error);
        }

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
        for (String role : roles) {
            if (!VALID_PRACTICE_ROLES.contains(role.toUpperCase())) {
                appendError(error, "Invalid value for PRACTICE_ROLE: " + role);
            }
        }

        validateEnum(record, "Status", Arrays.asList("ACTIVE", "CANCELLED", "CANCLED"), error);
        validateEnum(record, "Country", VALID_COUNTRIES, error);
        validateEnum(record, "Job Type", VALID_JOB_TYPES, error);
        validateEnum(record, "Phone Type", VALID_PHONE_TYPES, error);

        return error.toString();
    }

    public String validateExpiredIndividualUser(CSVRecord record) {
        StringBuilder error = new StringBuilder();

        // Mandatory Fields
        validateMandatory(record, "ContactId", error);
        validateMandatory(record, "Email", error);
        validateMandatory(record, "FirstName", error);
        validateMandatory(record, "LastName", error);
        validateMandatory(record, "Phone1", error);
        // City, State, PostalCode are OPTIONAL
        validateMandatory(record, "StartDate", error);
        // Currency and Token are OPTIONAL for expired members
        validateMandatory(record, "Status", error);
        validateMandatory(record, "NextBillDate", error);

        // Regex Validation
        validateRegex(record, "Email", EMAIL_PATTERN, "Invalid Email format", error);
        validateRegex(record, "Phone1", PHONE_PATTERN, "Invalid Phone format", error);

        // Enum Validation
        validateEnum(record, "Status", Arrays.asList("ACTIVE", "CANCELLED", "CANCLED", "INACTIVE", "EXPIRED"), error);
        validateEnum(record, "Country", VALID_COUNTRIES, error);
        validateEnum(record, "Job Type", VALID_JOB_TYPES, error);
        validateEnum(record, "Phone Type", VALID_PHONE_TYPES, error);

        return error.toString();
    }

    public String validateExpiredPracticeUser(CSVRecord record) {
        StringBuilder error = new StringBuilder();

        // Mandatory Fields
        validateMandatory(record, "ContactId", error);
        validateMandatory(record, "Email", error);
        validateMandatory(record, "FirstName", error);
        validateMandatory(record, "LastName", error);
        validateMandatory(record, "Phone1", error);
        // City, State, PostalCode are OPTIONAL

        // Practice Name is mandatory only for ROOT_ADMIN
        String roleStr = record.isMapped("PRACTICE_ROLE") ? record.get("PRACTICE_ROLE") : null;
        List<String> roles = roleStr != null ? Arrays.asList(roleStr.split("\\s*,\\s*")) : new ArrayList<>();

        if (roles.stream().anyMatch("ROOT_ADMIN"::equalsIgnoreCase)) {
            validateMandatory(record, "Practice Name", error);
        } else if (roles.stream().anyMatch(r -> "ADMIN".equalsIgnoreCase(r) || "LEARNER".equalsIgnoreCase(r))) {
            validateMandatory(record, "ROOT_ADMIN_ID", error);
        }

        validateMandatory(record, "PRACTICE_ROLE", error);
        validateMandatory(record, "StartDate", error);
        // Currency and Token are OPTIONAL for expired members
        validateMandatory(record, "Status", error);
        validateMandatory(record, "NextBillDate", error);

        // Regex Validation
        validateRegex(record, "Email", EMAIL_PATTERN, "Invalid Email format", error);
        validateRegex(record, "Phone1", PHONE_PATTERN, "Invalid Phone format", error);

        // Enum Validation
        for (String role : roles) {
            if (!VALID_PRACTICE_ROLES.contains(role.toUpperCase())) {
                appendError(error, "Invalid value for PRACTICE_ROLE: " + role);
            }
        }

        validateEnum(record, "Status", Arrays.asList("ACTIVE", "CANCELLED", "CANCLED", "INACTIVE"), error);
        validateEnum(record, "Country", VALID_COUNTRIES, error);
        validateEnum(record, "Job Type", VALID_JOB_TYPES, error);
        validateEnum(record, "Phone Type", VALID_PHONE_TYPES, error);

        return error.toString();
    }

    public String validateIndividualActiveRenew(CSVRecord record) {
        StringBuilder error = new StringBuilder();

        // Mandatory Fields
        validateMandatory(record, "ContactId", error);
        validateMandatory(record, "Email", error);
        validateMandatory(record, "FirstName", error);
        validateMandatory(record, "LastName", error);
        validateMandatory(record, "Phone1", error);
        // City, State, PostalCode are OPTIONAL
        validateMandatory(record, "StartDate", error);
        validateMandatory(record, "Currency", error);
        validateMandatory(record, "Status", error);
        validateMandatory(record, "NextBillDate", error);
        validateMandatory(record, "Token", error);

        // Regex Validation
        validateRegex(record, "Email", EMAIL_PATTERN, "Invalid Email format", error);
        validateRegex(record, "Phone1", PHONE_PATTERN, "Invalid Phone format", error);

        // Enum Validation
        validateEnum(record, "Status", Arrays.asList("ACTIVE"), error); // Strict ACTIVE
        validateEnum(record, "Country", VALID_COUNTRIES, error);
        validateEnum(record, "Job Type", VALID_JOB_TYPES, error);
        validateEnum(record, "Phone Type", VALID_PHONE_TYPES, error);

        return error.toString();
    }

    public String validateIndividualActiveCancelled(CSVRecord record) {
        StringBuilder error = new StringBuilder();

        // Mandatory Fields
        validateMandatory(record, "ContactId", error);
        validateMandatory(record, "Email", error);
        validateMandatory(record, "FirstName", error);
        validateMandatory(record, "LastName", error);
        validateMandatory(record, "Phone1", error);
        // City, State, PostalCode are OPTIONAL
        validateMandatory(record, "StartDate", error);
        validateMandatory(record, "Currency", error);
        validateMandatory(record, "Status", error);
        validateMandatory(record, "NextBillDate", error);
        validateMandatory(record, "Token", error);

        // Regex Validation
        validateRegex(record, "Email", EMAIL_PATTERN, "Invalid Email format", error);
        validateRegex(record, "Phone1", PHONE_PATTERN, "Invalid Phone format", error);

        // Enum Validation
        validateEnum(record, "Status", Arrays.asList("CANCELLED", "CANCLED"), error); // Strict CANCELLED
        validateEnum(record, "Country", VALID_COUNTRIES, error);
        validateEnum(record, "Job Type", VALID_JOB_TYPES, error);
        validateEnum(record, "Phone Type", VALID_PHONE_TYPES, error);

        return error.toString();
    }

    public String validatePracticeActiveRenew(CSVRecord record) {
        StringBuilder error = new StringBuilder();

        // Mandatory Fields
        validateMandatory(record, "ContactId", error);
        validateMandatory(record, "Email", error);
        validateMandatory(record, "FirstName", error);
        validateMandatory(record, "LastName", error);
        validateMandatory(record, "Phone1", error);
        // City, State, PostalCode are OPTIONAL

        // Practice Name is mandatory only for ROOT_ADMIN
        String roleStr = record.isMapped("PRACTICE_ROLE") ? record.get("PRACTICE_ROLE") : null;
        List<String> roles = roleStr != null ? Arrays.asList(roleStr.split("\\s*,\\s*")) : new ArrayList<>();

        if (roles.stream().anyMatch("ROOT_ADMIN"::equalsIgnoreCase)) {
            validateMandatory(record, "Practice Name", error);
        } else if (roles.stream().anyMatch(r -> "ADMIN".equalsIgnoreCase(r) || "LEARNER".equalsIgnoreCase(r))) {
            validateMandatory(record, "ROOT_ADMIN_ID", error);
        }

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
        for (String role : roles) {
            if (!VALID_PRACTICE_ROLES.contains(role.toUpperCase())) {
                appendError(error, "Invalid value for PRACTICE_ROLE: " + role);
            }
        }

        validateEnum(record, "Status", Arrays.asList("ACTIVE"), error); // Strict ACTIVE
        validateEnum(record, "Country", VALID_COUNTRIES, error);
        validateEnum(record, "Job Type", VALID_JOB_TYPES, error);
        validateEnum(record, "Phone Type", VALID_PHONE_TYPES, error);

        return error.toString();
    }

    public String validatePracticeActiveCancelled(CSVRecord record) {
        StringBuilder error = new StringBuilder();

        // Mandatory Fields
        validateMandatory(record, "ContactId", error);
        validateMandatory(record, "Email", error);
        validateMandatory(record, "FirstName", error);
        validateMandatory(record, "LastName", error);
        validateMandatory(record, "Phone1", error);
        // City, State, PostalCode are OPTIONAL

        // Practice Name is mandatory only for ROOT_ADMIN
        String roleStr = record.isMapped("PRACTICE_ROLE") ? record.get("PRACTICE_ROLE") : null;
        List<String> roles = roleStr != null ? Arrays.asList(roleStr.split("\\s*,\\s*")) : new ArrayList<>();

        if (roles.stream().anyMatch("ROOT_ADMIN"::equalsIgnoreCase)) {
            validateMandatory(record, "Practice Name", error);
        } else if (roles.stream().anyMatch(r -> "ADMIN".equalsIgnoreCase(r) || "LEARNER".equalsIgnoreCase(r))) {
            validateMandatory(record, "ROOT_ADMIN_ID", error);
        }

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
        for (String role : roles) {
            if (!VALID_PRACTICE_ROLES.contains(role.toUpperCase())) {
                appendError(error, "Invalid value for PRACTICE_ROLE: " + role);
            }
        }

        validateEnum(record, "Status", Arrays.asList("CANCELLED", "CANCLED"), error); // Strict CANCELLED
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

    // --- DTO Validation Methods ---

    public String validateIndividualUser(vacademy.io.admin_core_service.features.migration.dto.KeapUserDTO user,
            String recordType) {
        StringBuilder error = new StringBuilder();

        validateMandatory(user.getContactId(), "ContactId", error);
        validateMandatory(user.getEmail(), "Email", error);

        if ("INDIVIDUAL_ACTIVE_RENEW".equals(recordType)) {
            validateMandatory(user.getFirstName(), "FirstName", error);
            validateMandatory(user.getLastName(), "LastName", error);
            validateMandatory(user.getPhone(), "Phone1", error);
            // City, State, PostalCode are OPTIONAL
            validateMandatory(user.getStartDate(), "StartDate", error);
            validateMandatory(user.getStatus(), "Status", error);
            validateMandatory(user.getNextBillDate(), "NextBillDate", error);
            validateMandatory(user.getEwayToken(), "Token", error);
            validateEnum(user.getStatus(), "Status", Arrays.asList("ACTIVE"), error);
        } else if ("INDIVIDUAL_ACTIVE_CANCELLED".equals(recordType)) {
            validateMandatory(user.getFirstName(), "FirstName", error);
            validateMandatory(user.getLastName(), "LastName", error);
            validateMandatory(user.getPhone(), "Phone1", error);
            // City, State, PostalCode are OPTIONAL
            validateMandatory(user.getStartDate(), "StartDate", error);
            // Currency not in DTO? Assuming it is or handled elsewhere.
            validateMandatory(user.getStatus(), "Status", error);
            validateMandatory(user.getNextBillDate(), "NextBillDate", error);
            validateMandatory(user.getEwayToken(), "Token", error);
            validateEnum(user.getStatus(), "Status", Arrays.asList("CANCELLED", "CANCLED"), error);
        } else if ("EXPIRED_INDIVIDUAL".equals(recordType)) {
            validateMandatory(user.getFirstName(), "FirstName", error);
            validateMandatory(user.getLastName(), "LastName", error);
            validateMandatory(user.getPhone(), "Phone1", error);
            // City, State, PostalCode are OPTIONAL
            validateMandatory(user.getStartDate(), "StartDate", error);
            validateMandatory(user.getStatus(), "Status", error);
            validateMandatory(user.getNextBillDate(), "NextBillDate", error);
            validateEnum(user.getStatus(), "Status",
                    Arrays.asList("ACTIVE", "CANCELLED", "CANCLED", "INACTIVE", "EXPIRED"), error);
        } else {
            // Default INDIVIDUAL
            validateMandatory(user.getFirstName(), "FirstName", error);
            validateMandatory(user.getLastName(), "LastName", error);
            validateMandatory(user.getPhone(), "Phone1", error);
            // City, State, PostalCode are OPTIONAL
            validateMandatory(user.getStartDate(), "StartDate", error);
            validateMandatory(user.getStatus(), "Status", error);
            validateMandatory(user.getNextBillDate(), "NextBillDate", error);
            validateMandatory(user.getEwayToken(), "Token", error);
            validateEnum(user.getStatus(), "Status", Arrays.asList("ACTIVE", "CANCELLED", "CANCLED"), error);
        }

        validateRegex(user.getEmail(), EMAIL_PATTERN, "Invalid Email format", error);
        validateRegex(user.getPhone(), PHONE_PATTERN, "Invalid Phone format", error);

        if (user.getCountry() != null)
            validateEnum(user.getCountry(), "Country", VALID_COUNTRIES, error);
        if (user.getJobType() != null)
            validateEnum(user.getJobType(), "Job Type", VALID_JOB_TYPES, error);
        if (user.getPhoneType() != null)
            validateEnum(user.getPhoneType(), "Phone Type", VALID_PHONE_TYPES, error);

        return error.toString();
    }

    public String validatePracticeUser(vacademy.io.admin_core_service.features.migration.dto.KeapUserDTO user,
            String recordType) {
        StringBuilder error = new StringBuilder();

        validateMandatory(user.getContactId(), "ContactId", error);
        validateMandatory(user.getEmail(), "Email", error);

        String roleStr = user.getPracticeRole();
        List<String> roles = roleStr != null ? Arrays.asList(roleStr.split("\\s*,\\s*")) : new ArrayList<>();

        if ("PRACTICE_ACTIVE_RENEW".equals(recordType)) {
            validateMandatory(user.getFirstName(), "FirstName", error);
            validateMandatory(user.getLastName(), "LastName", error);
            validateMandatory(user.getPhone(), "Phone1", error);
            // City, State, PostalCode are OPTIONAL
            if (roles.stream().anyMatch("ROOT_ADMIN"::equalsIgnoreCase)) {
                validateMandatory(user.getPracticeName(), "Practice Name", error);
            } else if (roles.stream().anyMatch(r -> "ADMIN".equalsIgnoreCase(r) || "LEARNER".equalsIgnoreCase(r))) {
                validateMandatory(user.getRootAdminId(), "ROOT_ADMIN_ID", error);
            }
            validateMandatory(user.getPracticeRole(), "PRACTICE_ROLE", error);
            validateMandatory(user.getStartDate(), "StartDate", error);
            validateMandatory(user.getStatus(), "Status", error);
            validateMandatory(user.getNextBillDate(), "NextBillDate", error);
            validateMandatory(user.getEwayToken(), "Token", error);
            validateEnum(user.getStatus(), "Status", Arrays.asList("ACTIVE"), error);
        } else if ("PRACTICE_ACTIVE_CANCELLED".equals(recordType)) {
            validateMandatory(user.getFirstName(), "FirstName", error);
            validateMandatory(user.getLastName(), "LastName", error);
            validateMandatory(user.getPhone(), "Phone1", error);
            // City, State, PostalCode are OPTIONAL
            if (roles.stream().anyMatch("ROOT_ADMIN"::equalsIgnoreCase)) {
                validateMandatory(user.getPracticeName(), "Practice Name", error);
            } else if (roles.stream().anyMatch(r -> "ADMIN".equalsIgnoreCase(r) || "LEARNER".equalsIgnoreCase(r))) {
                validateMandatory(user.getRootAdminId(), "ROOT_ADMIN_ID", error);
            }
            validateMandatory(user.getPracticeRole(), "PRACTICE_ROLE", error);
            validateMandatory(user.getStartDate(), "StartDate", error);
            validateMandatory(user.getStatus(), "Status", error);
            validateMandatory(user.getNextBillDate(), "NextBillDate", error);
            validateMandatory(user.getEwayToken(), "Token", error);
            validateEnum(user.getStatus(), "Status", Arrays.asList("CANCELLED", "CANCLED"), error);
        } else if ("EXPIRED_PRACTICE".equals(recordType)) {
            validateMandatory(user.getFirstName(), "FirstName", error);
            validateMandatory(user.getLastName(), "LastName", error);
            validateMandatory(user.getPhone(), "Phone1", error);
            // City, State, PostalCode are OPTIONAL
            if (roles.stream().anyMatch("ROOT_ADMIN"::equalsIgnoreCase)) {
                validateMandatory(user.getPracticeName(), "Practice Name", error);
            } else if (roles.stream().anyMatch(r -> "ADMIN".equalsIgnoreCase(r) || "LEARNER".equalsIgnoreCase(r))) {
                validateMandatory(user.getRootAdminId(), "ROOT_ADMIN_ID", error);
            }
            validateMandatory(user.getPracticeRole(), "PRACTICE_ROLE", error);
            validateMandatory(user.getStartDate(), "StartDate", error);
            validateMandatory(user.getStatus(), "Status", error);
            validateMandatory(user.getNextBillDate(), "NextBillDate", error);
            validateEnum(user.getStatus(), "Status", Arrays.asList("ACTIVE", "CANCELLED", "CANCLED", "INACTIVE"),
                    error);
        } else {
            // Default PRACTICE
            validateMandatory(user.getFirstName(), "FirstName", error);
            validateMandatory(user.getLastName(), "LastName", error);
            validateMandatory(user.getPhone(), "Phone1", error);
            // City, State, PostalCode are OPTIONAL
            if (roles.stream().anyMatch("ROOT_ADMIN"::equalsIgnoreCase)) {
                validateMandatory(user.getPracticeName(), "Practice Name", error);
            } else if (roles.stream().anyMatch(r -> "ADMIN".equalsIgnoreCase(r) || "LEARNER".equalsIgnoreCase(r))) {
                validateMandatory(user.getRootAdminId(), "ROOT_ADMIN_ID", error);
            }
            validateMandatory(user.getPracticeRole(), "PRACTICE_ROLE", error);
            validateMandatory(user.getStartDate(), "StartDate", error);
            validateMandatory(user.getStatus(), "Status", error);
            validateMandatory(user.getNextBillDate(), "NextBillDate", error);
            validateMandatory(user.getEwayToken(), "Token", error);
            validateEnum(user.getStatus(), "Status", Arrays.asList("ACTIVE", "CANCELLED", "CANCLED"), error);
        }

        validateRegex(user.getEmail(), EMAIL_PATTERN, "Invalid Email format", error);
        validateRegex(user.getPhone(), PHONE_PATTERN, "Invalid Phone format", error);

        for (String role : roles) {
            if (!VALID_PRACTICE_ROLES.contains(role.toUpperCase())) {
                appendError(error, "Invalid value for PRACTICE_ROLE: " + role);
            }
        }

        if (user.getCountry() != null)
            validateEnum(user.getCountry(), "Country", VALID_COUNTRIES, error);
        if (user.getJobType() != null)
            validateEnum(user.getJobType(), "Job Type", VALID_JOB_TYPES, error);
        if (user.getPhoneType() != null)
            validateEnum(user.getPhoneType(), "Phone Type", VALID_PHONE_TYPES, error);

        return error.toString();
    }

    private void validateMandatory(Object value, String field, StringBuilder error) {
        if (value == null || value.toString().trim().isEmpty()) {
            appendError(error, field + " is required");
        }
    }

    private void validateRegex(String value, Pattern pattern, String msg, StringBuilder error) {
        if (value != null && !value.trim().isEmpty()) {
            if (!pattern.matcher(value.trim()).matches()) {
                appendError(error, msg + " for " + value);
            }
        }
    }

    private void validateEnum(String value, String field, List<String> validValues, StringBuilder error) {
        if (value != null && !value.trim().isEmpty()) {
            if (!validValues.contains(value.trim())) {
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
