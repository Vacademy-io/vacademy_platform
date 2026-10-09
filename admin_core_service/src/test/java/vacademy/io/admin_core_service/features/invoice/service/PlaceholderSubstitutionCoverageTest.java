package vacademy.io.admin_core_service.features.invoice.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * A placeholder offered to template authors but never substituted renders as a literal
 * "{{token}}" on a live PDF. That already happened once with {{discount_amount}}, so the
 * registry and the substitution code are checked against each other here.
 */
class PlaceholderSubstitutionCoverageTest {

    private static final Path SERVICE = Path.of(
            "src/main/java/vacademy/io/admin_core_service/features/invoice/service/InvoiceService.java");

    @Test
    @DisplayName("every placeholder the editor offers is actually substituted")
    void everyRegisteredPlaceholderIsSubstituted() throws IOException {
        String src = Files.readString(SERVICE);

        List<String> registered = new ArrayList<>();
        Matcher reg = Pattern.compile("PLACEHOLDER_META\\.put\\(\"([a-z_0-9]+)\"").matcher(src);
        while (reg.find()) {
            registered.add(reg.group(1));
        }
        assertTrue(registered.size() > 20, "expected the placeholder registry to be found, got " + registered.size());

        List<String> missing = new ArrayList<>();
        for (String key : registered) {
            if (!src.contains("replace(\"{{" + key + "}}\"")) {
                missing.add(key);
            }
        }
        assertTrue(missing.isEmpty(),
                "these placeholders are offered to template authors but never substituted, so they "
                        + "would print literally on the PDF: " + missing);
    }

    @Test
    @DisplayName("the receipt placeholders are registered so an admin can edit and override them")
    void receiptPlaceholdersAreRegistered() throws IOException {
        String src = Files.readString(SERVICE);
        for (String key : List.of("course_name", "course_code", "user_mobile", "course_fees", "total_fees",
                "previous_paid", "fees_paid_now", "total_fees_due", "total_amount_paid",
                "next_installment_amount", "next_installment_date", "amount_in_words")) {
            assertTrue(src.contains("PLACEHOLDER_META.put(\"" + key + "\""),
                    key + " must be in the registry or the template editor will not offer it");
        }
    }
}
