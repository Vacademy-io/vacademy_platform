package vacademy.io.admin_core_service.features.migration.service;

import org.springframework.stereotype.Service;
import vacademy.io.common.core.dto.bulk_csv_upload.CsvInitResponse;
import vacademy.io.common.core.dto.bulk_csv_upload.Header;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Service
public class MigrationSetupService {

        // --- INDIVIDUAL MIGRATION SETUP ---

        public CsvInitResponse getIndividualActiveRenewMigrationSetup() {
                return createIndividualRenewResponse("Individual Active Renew Member Migration",
                                Arrays.asList("ACTIVE"));
        }

        public CsvInitResponse getIndividualActiveCancelledMigrationSetup() {
                return createIndividualResponse("Individual Active Cancelled Member Migration",
                                Arrays.asList("CANCELLED"));
        }

        public CsvInitResponse getIndividualExpiredMigrationSetup() {
                return createIndividualResponse("Individual Expired Member Migration", Arrays.asList("EXPIRED"));
        }

        // --- PRACTICE MIGRATION SETUP ---

        public CsvInitResponse getPracticeActiveRenewMigrationSetup() {
                return createPracticeRenewResponse("Practice Active Renew Member Migration", Arrays.asList("ACTIVE"));
        }

        public CsvInitResponse getPracticeActiveCancelledMigrationSetup() {
                return createPracticeResponse("Practice Active Cancelled Member Migration", Arrays.asList("CANCELLED"));
        }

        public CsvInitResponse getPracticeExpiredMigrationSetup() {
                return createPracticeResponse("Practice Expired Member Migration", Arrays.asList("EXPIRED"));
        }

        // --- PAYMENT MIGRATION SETUP ---

        public CsvInitResponse getPaymentMigrationSetup() {
                CsvInitResponse response = new CsvInitResponse();
                response.setPage_title("Payment Migration");
                response.setInstructions(
                                Arrays.asList("Upload CSV with the following headers.",
                                                "Ensure mandatory fields are present."));

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
                                createEnumHeader("string", false, "Status", "status", Arrays.asList("PAID", "FAILED"),
                                                order++, null));

                response.setHeaders(headers);
                return response;
        }

        // --- HELPER METHODS ---

        private CsvInitResponse createIndividualResponse(String title, List<String> statusOptions) {
                CsvInitResponse response = new CsvInitResponse();
                response.setPage_title(title);
                response.setInstructions(
                                Arrays.asList("Upload CSV with the following headers.",
                                                "Ensure mandatory fields are present."));

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
                                "Mobile number must include country code and be in the format +<country_code>-<number>",
                                order++,
                                null));
                headers.add(createHeader("string", true, "City", "city", order++, null));
                headers.add(createHeader("string", true, "State", "state", order++, null));
                headers.add(createHeader("string", true, "PostalCode", "zip_code", order++, null));
                headers.add(createHeader("string", false, "StartDate", "start_date", order++, null));
                headers.add(createHeader("string", false, "Currency", "currency", order++, null));
                headers.add(createEnumHeader("string", false, "Status", "status", statusOptions, order++, null));
                headers.add(createHeader("string", true, "NextBillDate", "next_bill_date", order++, null));
                headers.add(createHeader("string", true, "Token", "eway_token", order++, null));

                // Optional Fields
                headers.add(createHeader("string", true, "StreetAddress1", "address", order++, null));
                headers.add(createEnumHeader("string", true, "Country", "country",
                                Arrays.asList("Australia", "Austria", "Brazil", "Canada", "China", "New Zealand",
                                                "United Kingdom",
                                                "United States", "India"),
                                order++, null));
                headers.add(createEnumHeader("string", true, "Job Type", "Job Type",
                                Arrays.asList("Veterinarian", "Vet Nurse/Tech", "Vet Nurse/Tech Student", "Vet Student",
                                                "Practice Manager", "Others"),
                                order++, null));
                headers.add(createEnumHeader("string", true, "Phone Type", "Phone Type",
                                Arrays.asList("Work", "Home", "Mobile", "Other"), order++, null));

                response.setHeaders(headers);
                return response;
        }

        private CsvInitResponse createIndividualRenewResponse(String title, List<String> statusOptions) {
                CsvInitResponse response = new CsvInitResponse();
                response.setPage_title(title);
                response.setInstructions(
                                Arrays.asList("Upload CSV with the following headers.",
                                                "Ensure mandatory fields are present."));

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
                                "Mobile number must include country code and be in the format +<country_code>-<number>",
                                order++,
                                null));
                headers.add(createHeader("string", true, "City", "city", order++, null));
                headers.add(createHeader("string", true, "State", "state", order++, null));
                headers.add(createHeader("string", true, "PostalCode", "zip_code", order++, null));
                headers.add(createHeader("string", false, "StartDate", "start_date", order++, null));
                headers.add(createHeader("string", false, "Currency", "currency", order++, null));
                headers.add(createEnumHeader("string", false, "Status", "status", statusOptions, order++, null));
                headers.add(createHeader("string", false, "NextBillDate", "next_bill_date", order++, null));
                headers.add(createHeader("string", false, "Token", "eway_token", order++, null));

                // Optional Fields
                headers.add(createHeader("string", true, "StreetAddress1", "address", order++, null));
                headers.add(createEnumHeader("string", true, "Country", "country",
                                Arrays.asList("Australia", "Austria", "Brazil", "Canada", "China", "New Zealand",
                                                "United Kingdom",
                                                "United States", "India"),
                                order++, null));
                headers.add(createEnumHeader("string", true, "Job Type", "Job Type",
                                Arrays.asList("Veterinarian", "Vet Nurse/Tech", "Vet Nurse/Tech Student", "Vet Student",
                                                "Practice Manager", "Others"),
                                order++, null));
                headers.add(createEnumHeader("string", true, "Phone Type", "Phone Type",
                                Arrays.asList("Work", "Home", "Mobile", "Other"), order++, null));

                response.setHeaders(headers);
                return response;
        }

        private CsvInitResponse createPracticeResponse(String title, List<String> statusOptions) {
                CsvInitResponse response = new CsvInitResponse();
                response.setPage_title(title);
                response.setInstructions(
                                Arrays.asList("Upload CSV with the following headers.",
                                                "Ensure mandatory fields are present."));

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
                                "Mobile number must include country code and be in the format +<country_code>-<number>",
                                order++,
                                null));
                headers.add(createHeader("string", true, "City", "city", order++, null));
                headers.add(createHeader("string", true, "State", "state", order++, null));
                headers.add(createHeader("string", true, "PostalCode", "zip_code", order++, null));
                headers.add(createHeader("string", false, "Practice Name", "practice_name", order++, null));
                headers.add(createEnumHeader("string", false, "PRACTICE_ROLE", "practice_role",
                                Arrays.asList("ROOT_ADMIN", "ADMIN", "LEARNER"), order++, null));

                headers.add(createHeader("string", false, "StartDate", "start_date", order++, null));
                headers.add(createHeader("string", false, "Currency", "currency", order++, null));
                headers.add(createEnumHeader("string", false, "Status", "status", statusOptions, order++, null));
                headers.add(createHeader("string", false, "NextBillDate", "next_bill_date", order++, null));
                headers.add(createHeader("string", false, "Token", "eway_token", order++, null));

                // Optional Fields
                headers.add(createHeader("string", true, "StreetAddress1", "address", order++, null));
                headers.add(createEnumHeader("string", true, "Country", "country",
                                Arrays.asList("Australia", "Austria", "Brazil", "Canada", "China", "New Zealand",
                                                "United Kingdom",
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
                return response;
        }

        private CsvInitResponse createPracticeRenewResponse(String title, List<String> statusOptions) {
                CsvInitResponse response = new CsvInitResponse();
                response.setPage_title(title);
                response.setInstructions(
                                Arrays.asList("Upload CSV with the following headers.",
                                                "Ensure mandatory fields are present."));

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
                                "Mobile number must include country code and be in the format +<country_code>-<number>",
                                order++,
                                null));
                headers.add(createHeader("string", true, "City", "city", order++, null));
                headers.add(createHeader("string", true, "State", "state", order++, null));
                headers.add(createHeader("string", true, "PostalCode", "zip_code", order++, null));

                // Practice Name is mandatory only for ROOT_ADMIN
                headers.add(createHeader("string", false, "Practice Name", "practice_name", order++, null));

                headers.add(createEnumHeader("string", false, "PRACTICE_ROLE", "practice_role",
                                Arrays.asList("ROOT_ADMIN", "ADMIN", "LEARNER"), order++, null));
                headers.add(createHeader("string", false, "StartDate", "start_date", order++, null));
                headers.add(createHeader("string", false, "Currency", "currency", order++, null));
                headers.add(createEnumHeader("string", false, "Status", "status", statusOptions, order++, null));
                headers.add(createHeader("string", false, "NextBillDate", "next_bill_date", order++, null));
                headers.add(createHeader("string", false, "Token", "eway_token", order++, null));

                // Optional Fields
                headers.add(createHeader("string", true, "StreetAddress1", "address", order++, null));
                headers.add(createEnumHeader("string", true, "Country", "country",
                                Arrays.asList("Australia", "Austria", "Brazil", "Canada", "China", "New Zealand",
                                                "United Kingdom",
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
                return response;
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

        private Header createEnumHeader(String type, boolean isOptional, String key, String field,
                        List<String> enumValues,
                        int order, List<String> examples) {
                Header header = createHeader(type, isOptional, key, field, order, examples);
                header.setOptions(enumValues);
                return header;
        }
}
