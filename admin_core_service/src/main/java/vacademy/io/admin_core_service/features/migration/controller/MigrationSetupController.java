package vacademy.io.admin_core_service.features.migration.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.core.dto.bulk_csv_upload.CsvInitResponse;
import vacademy.io.common.core.dto.bulk_csv_upload.Header;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/admin-core-service/migration/setup/v1")
public class MigrationSetupController {

    @GetMapping("/individual")
    public ResponseEntity<CsvInitResponse> getIndividualMigrationSetup() {
        CsvInitResponse response = new CsvInitResponse();
        response.setPage_title("Individual Member Migration");
        response.setInstructions(
                Arrays.asList("Upload CSV with the following headers.", "Ensure mandatory fields are present."));

        List<Header> headers = new ArrayList<>();
        int order = 1;

        // Mandatory Fields
        headers.add(createHeader("string", false, "ContactId", "contact_id", order++, null));
        headers.add(createRegexHeader("regex", false, "Email", "email",
                "^(?![\\s\\S])|^((?!\\.)[\\w\\-_.]*[^.])(@\\w+)(\\.\\w+(\\.\\w+)?[^.\\W])$",
                "Invalid email format", order++, null));
        headers.add(createHeader("string", false, "FirstName", "first_name", order++, null));
        headers.add(createHeader("string", false, "LastName", "last_name", order++, null));
        headers.add(createRegexHeader("regex", false, "Phone1", "phone",
                "^\\+\\d{1,3}-\\d{6,14}$",
                "Mobile number must include country code and be in the format +<country_code>-<number>", order++,
                null));
        headers.add(createHeader("string", false, "City", "city", order++, null));
        headers.add(createHeader("string", false, "State", "state", order++, null));
        headers.add(createHeader("string", false, "PostalCode", "zip_code", order++, null));
        headers.add(createHeader("string", false, "StartDate", "start_date", order++, null));
        headers.add(createHeader("string", false, "Currency", "currency", order++, null));
        headers.add(createEnumHeader("string", false, "Status", "status", Arrays.asList("ACTIVE", "CANCELLED"), order++,
                null));
        headers.add(createHeader("string", false, "NextBillDate", "next_bill_date", order++, null));
        headers.add(createHeader("string", false, "Token", "eway_token", order++, null));

        // Optional Fields
        headers.add(createHeader("string", true, "StreetAddress1", "address", order++, null));
        headers.add(createEnumHeader("string", true, "Country", "country",
                Arrays.asList("Australia", "Austria", "Brazil", "Canada", "China", "New Zealand", "United Kingdom",
                        "United States", "India"),
                order++, null));
        headers.add(createEnumHeader("string", true, "Job Type", "Job Type",
                Arrays.asList("Veterinarian", "Vet Nurse/Tech", "Vet Nurse/Tech Student", "Vet Student",
                        "Practice Manager", "Others"),
                order++, null));
        headers.add(createEnumHeader("string", true, "Phone Type", "Phone Type",
                Arrays.asList("Work", "Home", "Mobile", "Other"), order++, null));

        response.setHeaders(headers);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/practice")
    public ResponseEntity<CsvInitResponse> getPracticeMigrationSetup() {
        CsvInitResponse response = new CsvInitResponse();
        response.setPage_title("Practice Member Migration");
        response.setInstructions(
                Arrays.asList("Upload CSV with the following headers.", "Ensure mandatory fields are present."));

        List<Header> headers = new ArrayList<>();
        int order = 1;

        // Mandatory Fields
        headers.add(createHeader("string", false, "ContactId", "contact_id", order++, null));
        headers.add(createRegexHeader("regex", false, "Email", "email",
                "^(?![\\s\\S])|^((?!\\.)[\\w\\-_.]*[^.])(@\\w+)(\\.\\w+(\\.\\w+)?[^.\\W])$",
                "Invalid email format", order++, null));
        headers.add(createHeader("string", false, "FirstName", "first_name", order++, null));
        headers.add(createHeader("string", false, "LastName", "last_name", order++, null));
        headers.add(createRegexHeader("regex", false, "Phone1", "phone",
                "^\\+\\d{1,3}-\\d{6,14}$",
                "Mobile number must include country code and be in the format +<country_code>-<number>", order++,
                null));
        headers.add(createHeader("string", false, "City", "city", order++, null));
        headers.add(createHeader("string", false, "State", "state", order++, null));
        headers.add(createHeader("string", false, "PostalCode", "zip_code", order++, null));
        headers.add(createHeader("string", false, "Practice Name", "practice_name", order++, null));
        headers.add(createEnumHeader("string", false, "PRACTICE_ROLE", "practice_role",
                Arrays.asList("ROOT_ADMIN", "ADMIN", "LEARNER"), order++, null));

        headers.add(createHeader("string", false, "StartDate", "start_date", order++, null));
        headers.add(createHeader("string", false, "Currency", "currency", order++, null));
        headers.add(createEnumHeader("string", false, "Status", "status", Arrays.asList("ACTIVE", "CANCELLED"), order++,
                null));
        headers.add(createHeader("string", false, "NextBillDate", "next_bill_date", order++, null));
        headers.add(createHeader("string", false, "Token", "eway_token", order++, null));

        // Optional Fields
        headers.add(createHeader("string", true, "StreetAddress1", "address", order++, null));
        headers.add(createEnumHeader("string", true, "Country", "country",
                Arrays.asList("Australia", "Austria", "Brazil", "Canada", "China", "New Zealand", "United Kingdom",
                        "United States", "India"),
                order++, null));
        headers.add(createEnumHeader("string", true, "Job Type", "Job Type",
                Arrays.asList("Veterinarian", "Vet Nurse/Tech", "Vet Nurse/Tech Student", "Vet Student",
                        "Practice Manager", "Others"),
                order++, null));
        headers.add(createEnumHeader("string", true, "Phone Type", "Phone Type",
                Arrays.asList("Work", "Home", "Mobile", "Other"), order++, null));
        headers.add(createHeader("string", true, "ROOT_ADMIN_ID", "root_admin_id", order++, null));

        response.setHeaders(headers);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/payment")
    public ResponseEntity<CsvInitResponse> getPaymentMigrationSetup() {
        CsvInitResponse response = new CsvInitResponse();
        response.setPage_title("Payment Migration");
        response.setInstructions(
                Arrays.asList("Upload CSV with the following headers.", "Ensure mandatory fields are present."));

        List<Header> headers = new ArrayList<>();
        int order = 1;

        // Mandatory Fields
        headers.add(createHeader("string", false, "ContactId", "contact_id", order++, null));
        headers.add(createRegexHeader("regex", false, "Email", "email",
                "^(?![\\s\\S])|^((?!\\.)[\\w\\-_.]*[^.])(@\\w+)(\\.\\w+(\\.\\w+)?[^.\\W])$",
                "Invalid email format", order++, null));
        headers.add(createHeader("double", false, "Amount", "amount", order++, null));
        headers.add(createHeader("string", false, "Date", "date", order++, null)); // Transaction Date
        headers.add(createHeader("string", false, "TransactionId", "transaction_id", order++, null));
        headers.add(
                createEnumHeader("string", false, "Status", "status", Arrays.asList("PAID", "FAILED"), order++, null));

        response.setHeaders(headers);
        return ResponseEntity.ok(response);
    }

    private Header createHeader(String type, boolean isOptional, String key, String field, int order,
            List<String> examples) {
        Header header = new Header();
        header.setType(type);
        header.setOptional(isOptional);
        header.setColumn_name(key);
        header.setOrder(order);
        header.setSample_values(examples);
        return header;
    }

    private Header createRegexHeader(String type, boolean isOptional, String key, String field, String regex,
            String error, int order, List<String> examples) {
        Header header = createHeader(type, isOptional, key, field, order, examples);
        header.setRegex(regex);
        header.setRegex_error_message(error);
        return header;
    }

    private Header createEnumHeader(String type, boolean isOptional, String key, String field, List<String> enumValues,
            int order, List<String> examples) {
        Header header = createHeader(type, isOptional, key, field, order, examples);
        header.setOptions(enumValues);
        return header;
    }
}
