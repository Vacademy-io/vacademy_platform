package vacademy.io.admin_core_service.features.invoice.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.invoice.dto.InvoiceData;

/**
 * Placeholders for a monthly fee invoice: the month being billed, and the parent / year group
 * read off the learner's own custom fields.
 */
class MonthlyInvoicePlaceholdersTest {

    @Test
    @DisplayName("the billed month follows the due date, so an invoice raised in advance names the right month")
    void billingMonthFollowsDueDate() {
        InvoiceData data = InvoiceData.builder()
                .invoiceDate(LocalDateTime.of(2026, 9, 25, 10, 0))
                .dueDate(LocalDateTime.of(2026, 10, 1, 0, 0))
                .build();
        LocalDate billed = InvoiceService.billingPeriodDate(data);
        assertEquals(LocalDate.of(2026, 10, 1), billed);
        assertEquals("October", InvoiceService.billingMonthName(billed));
    }

    @Test
    @DisplayName("without a due date the invoice date is used, and without either the month is blank")
    void billingMonthFallsBack() {
        InvoiceData data = InvoiceData.builder().invoiceDate(LocalDateTime.of(2026, 11, 3, 9, 0)).build();
        assertEquals("November", InvoiceService.billingMonthName(InvoiceService.billingPeriodDate(data)));
        assertNull(InvoiceService.billingPeriodDate(InvoiceData.builder().build()));
        assertEquals("", InvoiceService.billingMonthName(null));
    }

    @Test
    @DisplayName("parent name fields are recognised however the institute labelled them")
    void parentNameFieldsMatch() {
        for (String label : new String[] {"Parent Name", "Parent's Name", "Parent/Guardian", "Guardian Name",
                "PARENTS NAME", "Name of Parent"}) {
            assertEquals("parent_name", InvoiceService.learnerProfilePlaceholderFor(label), label);
        }
    }

    @Test
    @DisplayName("a parent's email or phone is never taken for the parent's name")
    void parentContactFieldsDoNotMatch() {
        for (String label : new String[] {"Parent Email", "Parent's Mobile Number", "Guardian Phone",
                "Parent Contact", "Parent WhatsApp", "Parent Occupation", "Relation with Guardian"}) {
            assertNull(InvoiceService.learnerProfilePlaceholderFor(label), label);
        }
    }

    @Test
    @DisplayName("year group fields are recognised, unrelated fields are not")
    void yearGroupFieldsMatch() {
        for (String label : new String[] {"Year Group", "Year group (2026-27)", "Grade", "Class", "Year"}) {
            assertEquals("year_group", InvoiceService.learnerProfilePlaceholderFor(label), label);
        }
        for (String label : new String[] {"Class Timing", "Year of Passing", "Full Name", "Email", ""}) {
            assertNull(InvoiceService.learnerProfilePlaceholderFor(label), label);
        }
        assertNull(InvoiceService.learnerProfilePlaceholderFor(null));
    }

    @Test
    @DisplayName("the custom-field lookup only runs for templates that ask for it")
    void lookupIsGatedOnTheTemplate() {
        assertTrue(InvoiceService.usesLearnerProfileFields("<td>{{parent_name}}</td>"));
        assertTrue(InvoiceService.usesLearnerProfileFields("<td>{{year_group}}</td>"));
        assertFalse(InvoiceService.usesLearnerProfileFields("<td>{{user_name}} {{billing_period}}</td>"));
        assertFalse(InvoiceService.usesLearnerProfileFields(null));
    }
}
