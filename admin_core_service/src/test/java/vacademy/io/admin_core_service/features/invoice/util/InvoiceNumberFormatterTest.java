package vacademy.io.admin_core_service.features.invoice.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.invoice.dto.InvoiceNumberConfig;
import vacademy.io.admin_core_service.features.invoice.dto.InvoiceNumberContext;
import vacademy.io.admin_core_service.features.invoice.enums.InvoiceSeqScope;

import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pins the admin-configurable invoice number format.
 *
 * <p>These numbers land on tax documents and are immutable once issued, so the properties that
 * matter are: {@code {{seq}}} is mandatory (uniqueness), nothing can exceed the 100-char column,
 * an unresolvable token degrades cleanly instead of leaving {@code ACME--0001}, and the lazy
 * lookups are not performed for formats that don't use them.
 */
class InvoiceNumberFormatterTest {

    private static final LocalDate AUG_2026 = LocalDate.of(2026, 8, 5);

    private static InvoiceNumberConfig config(String format) {
        return InvoiceNumberConfig.builder()
                .format(format)
                .seqPadding(4)
                .seqScope(InvoiceSeqScope.DAILY)
                .instituteCode("ACME")
                .fyStartMonth(4)
                .sanitizeTokens(true)
                .build();
    }

    private static InvoiceNumberContext context() {
        return InvoiceNumberContext.builder()
                .instituteId("inst-1")
                .instituteName("Acme Academy")
                .instituteCode("ACME")
                .instituteStateCode("27")
                .instituteCity("Mumbai")
                .learnerName("Rahul Sharma")
                .date(AUG_2026)
                .currency("INR")
                .paymentVendor("RAZORPAY")
                .docType("INV")
                .enrollmentNumberSupplier(() -> "482910")
                .packageContextSupplier(() -> null)
                .build();
    }

    private static String render(String format, InvoiceNumberContext ctx, long seq) {
        return InvoiceNumberFormatter.render(format, config(format), ctx, seq);
    }

    @Nested
    @DisplayName("rendering")
    class Rendering {

        @Test
        @DisplayName("reproduces the legacy INV-yyyyMMdd-NNNN default exactly")
        void legacyDefault() {
            assertEquals("INV-20260805-0001",
                    render(InvoiceNumberConfig.LEGACY_FORMAT, context(), 1));
        }

        @Test
        @DisplayName("combines institute, date and sequence tokens with literal separators")
        void combination() {
            assertEquals("ACME/2026/0042", render("{{institute_code}}/{{YYYY}}/{{seq}}", context(), 42));
        }

        @Test
        @DisplayName("sanitises free text: uppercase, accents and spaces stripped")
        void sanitises() {
            InvoiceNumberContext ctx = context();
            ctx.setLearnerName("Rénée O'Brien");
            assertEquals("RENEEOBRIEN-0001", render("{{learner_name}}-{{seq}}", ctx, 1));
        }

        @Test
        @DisplayName("tolerates whitespace inside braces, as pasted from a document")
        void whitespaceInsideBraces() {
            assertEquals("INV-0001", render("INV-{{ seq }}", context(), 1));
        }

        @Test
        @DisplayName("an unresolvable token collapses its separators instead of doubling them")
        void emptyTokenCollapsesSeparators() {
            InvoiceNumberContext ctx = context();
            ctx.setEnrollmentNumberSupplier(() -> null);
            assertEquals("ACME-0001", render("{{institute_code}}-{{enrollment_no}}-{{seq}}", ctx, 1));
        }

        @Test
        @DisplayName("a leading empty token does not leave a leading separator")
        void leadingEmptyToken() {
            InvoiceNumberContext ctx = context();
            ctx.setEnrollmentNumberSupplier(() -> null);
            assertEquals("ACME-0001", render("{{enrollment_no}}-{{institute_code}}-{{seq}}", ctx, 1));
        }

        @Test
        @DisplayName("a learner name containing braces is not re-substituted")
        void singlePassSubstitution() {
            InvoiceNumberContext ctx = context();
            ctx.setLearnerName("{{seq}}");
            // Sanitising strips the braces; the point is that no second pass expands them.
            assertEquals("SEQ-0007", render("{{learner_name}}-{{seq}}", ctx, 7));
        }

        @Test
        @DisplayName("package tokens render empty when the learner has no package context")
        void missingPackageContext() {
            assertEquals("ACME-0001", render("{{institute_code}}-{{course_name}}-{{seq}}", context(), 1));
        }
    }

    @Nested
    @DisplayName("modifiers")
    class Modifiers {

        @Test
        @DisplayName(":N truncates a text token")
        void truncate() {
            assertEquals("RAH-0001", render("{{learner_name:3}}-{{seq}}", context(), 1));
        }

        @Test
        @DisplayName(":initials reduces a name to its initials")
        void initials() {
            assertEquals("RS-0001", render("{{learner_name:initials}}-{{seq}}", context(), 1));
        }

        @Test
        @DisplayName(":initials on a single-word name falls back to the first two letters")
        void initialsSingleWord() {
            InvoiceNumberContext ctx = context();
            ctx.setLearnerName("Prince");
            assertEquals("PR-0001", render("{{learner_name:initials}}-{{seq}}", ctx, 1));
        }

        @Test
        @DisplayName(":N on {{seq}} overrides seqPadding")
        void seqPaddingOverride() {
            assertEquals("INV-000042", render("INV-{{seq:6}}", context(), 42));
        }

        @Test
        @DisplayName("sequence padding grows past its width rather than truncating")
        void sequenceOverflowKeepsAllDigits() {
            assertEquals("INV-123456", render("INV-{{seq}}", context(), 123456));
        }
    }

    @Nested
    @DisplayName("financial year")
    class FinancialYear {

        @Test
        @DisplayName("April start (India/UK): August 2026 falls in 2026-27")
        void aprilStart() {
            assertEquals("2026-27", InvoiceNumberFormatter.financialYear(AUG_2026, 4, true));
            assertEquals("26-27", InvoiceNumberFormatter.financialYear(AUG_2026, 4, false));
        }

        @Test
        @DisplayName("April start: March 2026 still falls in the PREVIOUS financial year")
        void aprilStartBeforeCutover() {
            assertEquals("2025-26",
                    InvoiceNumberFormatter.financialYear(LocalDate.of(2026, 3, 31), 4, true));
        }

        @Test
        @DisplayName("July start (Australia): June and July 2026 straddle the cut-over")
        void julyStart() {
            assertEquals("2025-26",
                    InvoiceNumberFormatter.financialYear(LocalDate.of(2026, 6, 30), 7, true));
            assertEquals("2026-27",
                    InvoiceNumberFormatter.financialYear(LocalDate.of(2026, 7, 1), 7, true));
        }

        @Test
        @DisplayName("January start collapses to the plain calendar year")
        void calendarYear() {
            assertEquals("2026", InvoiceNumberFormatter.financialYear(AUG_2026, 1, true));
        }

        @Test
        @DisplayName("fiscal quarter counts from the configured start month")
        void fiscalQuarter() {
            assertEquals(2, InvoiceNumberFormatter.fiscalQuarter(AUG_2026, 4));   // Aug = Q2 of an Apr FY
            assertEquals(1, InvoiceNumberFormatter.fiscalQuarter(AUG_2026, 7));   // Aug = Q1 of a Jul FY
            assertEquals(3, InvoiceNumberFormatter.fiscalQuarter(AUG_2026, 1));   // Aug = Q3 of a calendar FY
        }
    }

    @Nested
    @DisplayName("validation")
    class Validation {

        @Test
        @DisplayName("accepts a well-formed format")
        void valid() {
            assertTrue(InvoiceNumberFormatter.validate("{{institute_code}}/{{FY}}/{{seq}}", 4).isValid());
        }

        @Test
        @DisplayName("rejects a format with no sequence token")
        void missingSeq() {
            var result = InvoiceNumberFormatter.validate("INV-{{YYYY}}", 4);
            assertFalse(result.isValid());
            assertTrue(result.errors().get(0).contains("{{seq}}"));
        }

        @Test
        @DisplayName("rejects more than one sequence token")
        void duplicateSeq() {
            assertFalse(InvoiceNumberFormatter.validate("{{seq}}-{{seq}}", 4).isValid());
        }

        @Test
        @DisplayName("rejects an unknown token and suggests the right casing")
        void unknownTokenSuggestsCasing() {
            var result = InvoiceNumberFormatter.validate("{{yyyy}}-{{seq}}", 4);
            assertFalse(result.isValid());
            assertTrue(result.errors().get(0).contains("{{YYYY}}"),
                    "expected a casing hint, got: " + result.errors());
        }

        @Test
        @DisplayName("rejects an unknown modifier rather than silently ignoring it")
        void unknownModifier() {
            assertFalse(InvoiceNumberFormatter.validate("{{learner_name:huge}}-{{seq}}", 4).isValid());
        }

        @Test
        @DisplayName("rejects :initials on a non-text token")
        void initialsOnNonText() {
            assertFalse(InvoiceNumberFormatter.validate("{{YYYY:initials}}-{{seq}}", 4).isValid());
        }

        @Test
        @DisplayName("rejects literals outside the safe character set")
        void unsafeLiteral() {
            assertFalse(InvoiceNumberFormatter.validate("INV#{{seq}}", 4).isValid());
        }

        @Test
        @DisplayName("rejects a format whose worst case exceeds the 100-char column")
        void tooLong() {
            String format = "{{institute_name}}{{learner_name}}{{institute_city}}{{institute_state}}"
                    + "{{institute_country}}{{subdomain}}{{course_name}}{{level_name}}{{session_name}}"
                    + "{{plan_name}}{{seq}}";
            var result = InvoiceNumberFormatter.validate(format, 4);
            assertFalse(result.isValid());
            assertTrue(result.maxLength() > InvoiceNumberConfig.MAX_LENGTH);
        }

        @Test
        @DisplayName("warns — but does not reject — when learner tokens break sequential numbering")
        void warnsOnRiskyTokens() {
            var result = InvoiceNumberFormatter.validate("{{learner_name}}-{{seq}}", 4);
            assertTrue(result.isValid());
            assertFalse(result.warnings().isEmpty());
        }

        @Test
        @DisplayName("rejects an empty format")
        void empty() {
            assertFalse(InvoiceNumberFormatter.validate("  ", 4).isValid());
        }
    }

    @Nested
    @DisplayName("lazy lookups")
    class LazyLookups {

        @Test
        @DisplayName("a format without lazy tokens performs no enrollment or package lookup")
        void notInvokedWhenUnused() {
            AtomicInteger enrollmentCalls = new AtomicInteger();
            AtomicInteger packageCalls = new AtomicInteger();
            InvoiceNumberContext ctx = context();
            ctx.setEnrollmentNumberSupplier(() -> {
                enrollmentCalls.incrementAndGet();
                return "482910";
            });
            ctx.setPackageContextSupplier(() -> {
                packageCalls.incrementAndGet();
                return null;
            });

            render("{{institute_code}}/{{YYYY}}/{{seq}}", ctx, 1);

            assertEquals(0, enrollmentCalls.get(), "enrollment lookup must not run for this format");
            assertEquals(0, packageCalls.get(), "package lookup must not run for this format");
        }

        @Test
        @DisplayName("a lazy supplier is invoked at most once even if used twice")
        void memoised() {
            AtomicInteger packageCalls = new AtomicInteger();
            InvoiceNumberContext ctx = context();
            ctx.setPackageContextSupplier(() -> {
                packageCalls.incrementAndGet();
                return null;
            });

            render("{{course_name}}-{{level_name}}-{{seq}}", ctx, 1);

            assertEquals(1, packageCalls.get());
        }

        @Test
        @DisplayName("a failing lookup renders empty rather than blocking the invoice")
        void supplierFailureIsSwallowed() {
            InvoiceNumberContext ctx = context();
            ctx.setEnrollmentNumberSupplier(() -> {
                throw new IllegalStateException("db down");
            });
            assertEquals("ACME-0001", render("{{institute_code}}-{{enrollment_no}}-{{seq}}", ctx, 1));
        }
    }

    @Nested
    @DisplayName("scope keys")
    class ScopeKeys {

        @Test
        @DisplayName("each scope maps a date to a distinct, self-describing key")
        void scopeKeys() {
            assertEquals("ALL", InvoiceSeqScope.NEVER.scopeKey(AUG_2026));
            assertEquals("2026", InvoiceSeqScope.YEARLY.scopeKey(AUG_2026));
            assertEquals("202608", InvoiceSeqScope.MONTHLY.scopeKey(AUG_2026));
            assertEquals("20260805", InvoiceSeqScope.DAILY.scopeKey(AUG_2026));
        }

        @Test
        @DisplayName("rollover moves to a new key, so the counter restarts for that window")
        void rollover() {
            assertEquals("2027", InvoiceSeqScope.YEARLY.scopeKey(LocalDate.of(2027, 1, 1)));
            assertEquals("202609", InvoiceSeqScope.MONTHLY.scopeKey(LocalDate.of(2026, 9, 1)));
        }

        @Test
        @DisplayName("an unrecognised stored value falls back to the legacy DAILY behaviour")
        void lenientParsing() {
            assertEquals(InvoiceSeqScope.DAILY, InvoiceSeqScope.fromSetting("nonsense"));
            assertEquals(InvoiceSeqScope.DAILY, InvoiceSeqScope.fromSetting(null));
            assertEquals(InvoiceSeqScope.YEARLY, InvoiceSeqScope.fromSetting(" yearly "));
        }
    }

    @Nested
    @DisplayName("config parsing")
    class ConfigParsing {

        @Test
        @DisplayName("a missing numbering block yields the legacy default")
        void missingBlock() {
            InvoiceNumberConfig config = InvoiceNumberConfig.fromInvoiceSettings(java.util.Map.of());
            assertEquals(InvoiceNumberConfig.LEGACY_FORMAT, config.getFormat());
            assertEquals(InvoiceSeqScope.DAILY, config.getSeqScope());
        }

        @Test
        @DisplayName("null settings yield the legacy default rather than throwing")
        void nullSettings() {
            assertEquals(InvoiceNumberConfig.LEGACY_FORMAT,
                    InvoiceNumberConfig.fromInvoiceSettings(null).getFormat());
        }

        @Test
        @DisplayName("out-of-range padding and fy start month are clamped")
        void clamping() {
            InvoiceNumberConfig config = InvoiceNumberConfig.fromInvoiceSettings(java.util.Map.of(
                    "numbering", java.util.Map.of(
                            "format", "{{seq}}",
                            "seqPadding", 99,
                            "fyStartMonth", 0)));
            assertEquals(12, config.getSeqPadding());
            assertEquals(1, config.getFyStartMonth());
        }
    }
}
