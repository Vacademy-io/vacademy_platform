package vacademy.io.admin_core_service.features.invoice.util;

import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.invoice.dto.InvoiceNumberConfig;
import vacademy.io.admin_core_service.features.invoice.dto.InvoiceNumberContext;
import vacademy.io.admin_core_service.features.invoice.dto.InvoicePackageContextProjection;
import vacademy.io.admin_core_service.features.invoice.enums.InvoiceNumberToken;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses, validates and renders the admin-configured invoice number format.
 *
 * <p>Pure — no Spring, no DB, no clock of its own. Both the settings preview endpoint and
 * real invoice generation call the same {@link #render} method, so what the admin sees in
 * the preview is exactly what gets issued.
 *
 * <p>Grammar is {@code {{token}}} or {@code {{token:modifier}}}. Note this needs its OWN
 * pattern rather than {@code InvoiceService.PLACEHOLDER_PATTERN}, which is {@code [a-z_]+}
 * and so matches neither the uppercase date tokens nor modifiers. The {@code \s*} tolerates
 * {@code {{ seq }}} pasted out of a document — the same robustness the certificate renderer
 * applies.
 */
public final class InvoiceNumberFormatter {

    private static final Pattern TOKEN_PATTERN =
            Pattern.compile("\\{\\{\\s*([A-Za-z_]+)(?::([A-Za-z0-9]+))?\\s*}}");

    /** Characters permitted outside a token. Kept tight so numbers stay URL- and filename-safe. */
    private static final Pattern LITERAL_ALLOWED = Pattern.compile("[A-Za-z0-9\\-/_. ]*");

    /** Runs of separators left behind by a token that resolved to empty. */
    private static final Pattern SEPARATOR_RUN = Pattern.compile("([\\-/_.])[\\-/_.]+");

    private static final int DEFAULT_TEXT_WIDTH = 12;
    private static final int MAX_MODIFIER_WIDTH = 20;

    private InvoiceNumberFormatter() {
    }

    // ────────────────────────────────────────────────────────────────────────
    // Validation
    // ────────────────────────────────────────────────────────────────────────

    /** Outcome of validating a format string. */
    public record ValidationResult(List<String> errors, List<String> warnings, int maxLength) {
        public boolean isValid() {
            return errors.isEmpty();
        }
    }

    /**
     * Validate a format without rendering it. Returns every problem at once rather than
     * failing on the first, so the settings UI can show a complete list.
     */
    public static ValidationResult validate(String format, int seqPadding) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (!StringUtils.hasText(format)) {
            return new ValidationResult(List.of("Format cannot be empty."), warnings, 0);
        }

        int seqCount = 0;
        int worstCase = 0;
        int cursor = 0;
        boolean anyRisky = false;
        Set<String> unknown = new LinkedHashSet<>();

        Matcher m = TOKEN_PATTERN.matcher(format);
        while (m.find()) {
            String literal = format.substring(cursor, m.start());
            validateLiteral(literal, errors);
            worstCase += literal.length();
            cursor = m.end();

            String key = m.group(1);
            String modifier = m.group(2);
            Optional<InvoiceNumberToken> maybeToken = InvoiceNumberToken.fromKey(key);

            if (maybeToken.isEmpty()) {
                unknown.add(key);
                continue;
            }
            InvoiceNumberToken token = maybeToken.get();
            if (token == InvoiceNumberToken.SEQ) {
                seqCount++;
            }
            if (token.isRiskyForTax()) {
                anyRisky = true;
            }
            worstCase += validateModifier(token, modifier, seqPadding, errors);
        }

        String tail = format.substring(cursor);
        validateLiteral(tail, errors);
        worstCase += tail.length();

        for (String key : unknown) {
            errors.add(unknownTokenMessage(key));
        }
        if (seqCount == 0) {
            errors.add("Format must include {{seq}} — without it invoice numbers would not be unique.");
        } else if (seqCount > 1) {
            errors.add("Format must include {{seq}} exactly once (found " + seqCount + ").");
        }
        if (worstCase > InvoiceNumberConfig.MAX_LENGTH) {
            errors.add("Format can produce numbers up to " + worstCase + " characters, but the limit is "
                    + InvoiceNumberConfig.MAX_LENGTH + ". Shorten it or truncate a token, e.g. {{learner_name:4}}.");
        }
        if (anyRisky) {
            warnings.add("This format uses learner- or course-specific values, so invoice numbers "
                    + "will not be strictly sequential. Many tax regimes require sequential numbering.");
        }

        return new ValidationResult(errors, warnings, worstCase);
    }

    private static void validateLiteral(String literal, List<String> errors) {
        if (!literal.isEmpty() && !LITERAL_ALLOWED.matcher(literal).matches()) {
            errors.add("\"" + literal + "\" contains characters that are not allowed in an invoice number. "
                    + "Use letters, digits, and - / _ . only.");
        }
    }

    /** Returns the worst-case rendered width contributed by this token. */
    private static int validateModifier(InvoiceNumberToken token, String modifier,
                                        int seqPadding, List<String> errors) {
        if (modifier == null) {
            return token == InvoiceNumberToken.SEQ ? Math.max(seqPadding, 4) : token.getMaxWidth();
        }
        if ("initials".equals(modifier)) {
            if (!token.isFreeText()) {
                errors.add("{{" + token.getKey() + ":initials}} is not valid — :initials only applies to text values.");
            }
            return 4;
        }
        Integer width = parsePositiveInt(modifier);
        if (width == null || width < 1 || width > MAX_MODIFIER_WIDTH) {
            errors.add("{{" + token.getKey() + ":" + modifier + "}} is not a valid modifier. "
                    + "Use a width from 1 to " + MAX_MODIFIER_WIDTH + " (e.g. {{" + token.getKey() + ":4}})"
                    + (token.isFreeText() ? " or :initials." : "."));
            return token.getMaxWidth();
        }
        return width;
    }

    /** Unknown tokens are common typos — point at the right casing when we can. */
    private static String unknownTokenMessage(String key) {
        Optional<InvoiceNumberToken> caseInsensitive = java.util.Arrays.stream(InvoiceNumberToken.values())
                .filter(t -> t.getKey().equalsIgnoreCase(key))
                .findFirst();
        return caseInsensitive
                .map(t -> "{{" + key + "}} is not a token — did you mean {{" + t.getKey() + "}}? Tokens are case-sensitive.")
                .orElse("{{" + key + "}} is not a recognised token.");
    }

    // ────────────────────────────────────────────────────────────────────────
    // Rendering
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Render a concrete invoice number. Substitution is single-pass
     * ({@link Matcher#appendReplacement}) so a learner name that happens to contain
     * {@code {{...}}} is never re-substituted.
     *
     * <p>Tokens that cannot resolve (no learner on an admin invoice, no package context)
     * render empty and the separators either side collapse, so
     * {@code ACME-{{enrollment_no}}-{{seq}}} degrades to {@code ACME-0001}, never
     * {@code ACME--0001}.
     */
    public static String render(String format, InvoiceNumberConfig config,
                                InvoiceNumberContext context, long sequence) {
        LocalDate date = context.getDate() != null ? context.getDate() : LocalDate.now();
        // Memoised so a format using two package tokens still issues a single query.
        LazyValue<String> enrollment = new LazyValue<>(context.getEnrollmentNumberSupplier());
        LazyValue<InvoicePackageContextProjection> pkg = new LazyValue<>(context.getPackageContextSupplier());

        Matcher m = TOKEN_PATTERN.matcher(format);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            InvoiceNumberToken token = InvoiceNumberToken.fromKey(m.group(1)).orElse(null);
            String replacement = token == null
                    ? ""   // validation blocks this on save; be forgiving at render time
                    : applyModifier(token, m.group(2), config,
                                    resolve(token, config, context, date, sequence, enrollment, pkg));
            m.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        m.appendTail(out);

        return tidy(out.toString());
    }

    private static String resolve(InvoiceNumberToken token, InvoiceNumberConfig config,
                                  InvoiceNumberContext ctx, LocalDate date, long sequence,
                                  LazyValue<String> enrollment,
                                  LazyValue<InvoicePackageContextProjection> pkg) {
        return switch (token) {
            case SEQ -> String.valueOf(sequence);

            case INSTITUTE_CODE -> StringUtils.hasText(ctx.getInstituteCode())
                    ? ctx.getInstituteCode()
                    : deriveCode(ctx.getInstituteName());
            case INSTITUTE_NAME -> nullSafe(ctx.getInstituteName());
            case STATE_CODE -> nullSafe(ctx.getInstituteStateCode());
            case INSTITUTE_CITY -> nullSafe(ctx.getInstituteCity());
            case INSTITUTE_STATE -> nullSafe(ctx.getInstituteState());
            case INSTITUTE_COUNTRY -> nullSafe(ctx.getInstituteCountry());
            case SUBDOMAIN -> nullSafe(ctx.getSubdomain());

            case LEARNER_NAME -> nullSafe(ctx.getLearnerName());
            case LEARNER_INITIALS -> initials(ctx.getLearnerName());
            case LEARNER_STATE -> nullSafe(ctx.getLearnerState());
            case ENROLLMENT_NO -> nullSafe(enrollment.get());

            case YYYY -> format(date, "yyyy");
            case YY -> format(date, "yy");
            case MM -> format(date, "MM");
            case MMM -> date.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
            case DD -> format(date, "dd");
            case YYYYMM -> format(date, "yyyyMM");
            case YYYYMMDD -> format(date, "yyyyMMdd");
            case FY -> financialYear(date, config.getFyStartMonth(), true);
            case FYY -> financialYear(date, config.getFyStartMonth(), false);
            case Q -> String.valueOf(((date.getMonthValue() - 1) / 3) + 1);
            case FQ -> String.valueOf(fiscalQuarter(date, config.getFyStartMonth()));

            case CURRENCY -> nullSafe(ctx.getCurrency());
            case PAYMENT_VENDOR -> nullSafe(ctx.getPaymentVendor());
            case PLAN_NAME -> nullSafe(ctx.getPlanName());
            case DOC_TYPE -> nullSafe(ctx.getDocType());
            case COURSE_NAME -> pkg.get() == null ? "" : nullSafe(pkg.get().getPackageName());
            case LEVEL_NAME -> pkg.get() == null ? "" : nullSafe(pkg.get().getLevelName());
            case SESSION_NAME -> pkg.get() == null ? "" : nullSafe(pkg.get().getSessionName());
        };
    }

    private static String applyModifier(InvoiceNumberToken token, String modifier,
                                        InvoiceNumberConfig config, String raw) {
        if (token == InvoiceNumberToken.SEQ) {
            Integer explicit = modifier == null ? null : parsePositiveInt(modifier);
            int padding = explicit != null ? explicit : config.getSeqPadding();
            try {
                return String.format("%0" + Math.max(1, padding) + "d", Long.parseLong(raw));
            } catch (NumberFormatException e) {
                return raw;
            }
        }

        String value = raw;
        if ("initials".equals(modifier)) {
            value = initials(value);
        }
        if (token.isFreeText() && config.isSanitizeTokens()) {
            value = sanitize(value);
        }
        Integer width = modifier == null || "initials".equals(modifier) ? null : parsePositiveInt(modifier);
        if (width == null && token.isFreeText() && config.isSanitizeTokens()) {
            width = DEFAULT_TEXT_WIDTH;
        }
        if (width != null && value.length() > width) {
            value = value.substring(0, width);
        }
        return value;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Financial year containing {@code date}. Generalises the April-only logic in
     * {@code PayrollCalculationService.getFinancialYear}: {@code fyStartMonth} is 4 for
     * India/UK, 7 for Australia, 1 for calendar-year regimes. With a start month of 1 the
     * financial year is just the calendar year ("2026", not "2026-27").
     */
    static String financialYear(LocalDate date, int fyStartMonth, boolean fullStartYear) {
        if (fyStartMonth <= 1) {
            int y = date.getYear();
            return fullStartYear ? String.valueOf(y) : String.format("%02d", y % 100);
        }
        int startYear = date.getMonthValue() >= fyStartMonth ? date.getYear() : date.getYear() - 1;
        String start = fullStartYear ? String.valueOf(startYear) : String.format("%02d", startYear % 100);
        return start + "-" + String.format("%02d", (startYear + 1) % 100);
    }

    /** 1-4, counting from {@code fyStartMonth}. */
    static int fiscalQuarter(LocalDate date, int fyStartMonth) {
        int start = Math.max(1, Math.min(12, fyStartMonth));
        int offset = ((date.getMonthValue() - start) + 12) % 12;
        return (offset / 3) + 1;
    }

    /**
     * Short code from an institute name when the admin hasn't set one — same shape as
     * the certificate-id prefix: strip to alphanumerics, uppercase, take the first two.
     */
    static String deriveCode(String instituteName) {
        String cleaned = sanitize(instituteName);
        if (cleaned.isEmpty()) {
            return "INV";
        }
        return cleaned.length() <= 2 ? cleaned : cleaned.substring(0, 2);
    }

    /** "Rahul Sharma" -> "RS". Falls back to the first two letters for a single word. */
    static String initials(String name) {
        if (!StringUtils.hasText(name)) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (String part : name.trim().split("\\s+")) {
            String cleaned = sanitize(part);
            if (!cleaned.isEmpty()) {
                sb.append(cleaned.charAt(0));
            }
        }
        String result = sb.toString();
        if (result.length() == 1) {
            String whole = sanitize(name);
            return whole.length() >= 2 ? whole.substring(0, 2) : whole;
        }
        return result;
    }

    /** Uppercase, strip accents, drop everything that isn't A-Z or 0-9. */
    static String sanitize(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return normalized.toUpperCase(Locale.ENGLISH).replaceAll("[^A-Z0-9]", "");
    }

    /**
     * Collapse separator runs left by empty tokens and trim stray leading/trailing
     * separators, then enforce the column width as a final backstop.
     */
    private static String tidy(String value) {
        String collapsed = SEPARATOR_RUN.matcher(value).replaceAll("$1");
        collapsed = collapsed.replaceAll("^[\\-/_.]+", "").replaceAll("[\\-/_.]+$", "");
        collapsed = collapsed.trim();
        return collapsed.length() > InvoiceNumberConfig.MAX_LENGTH
                ? collapsed.substring(0, InvoiceNumberConfig.MAX_LENGTH)
                : collapsed;
    }

    private static String format(LocalDate date, String pattern) {
        return DateTimeFormatter.ofPattern(pattern).format(date);
    }

    private static String nullSafe(String value) {
        return value == null ? "" : value.trim();
    }

    private static Integer parsePositiveInt(String value) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Calls its supplier at most once; tolerates a null supplier and a throwing one. */
    private static final class LazyValue<T> {
        private final java.util.function.Supplier<T> supplier;
        private boolean resolved;
        private T value;

        LazyValue(java.util.function.Supplier<T> supplier) {
            this.supplier = supplier;
        }

        T get() {
            if (!resolved) {
                resolved = true;
                try {
                    value = supplier == null ? null : supplier.get();
                } catch (Exception e) {
                    value = null;   // a lookup failure must never block issuing an invoice
                }
            }
            return value;
        }
    }
}
