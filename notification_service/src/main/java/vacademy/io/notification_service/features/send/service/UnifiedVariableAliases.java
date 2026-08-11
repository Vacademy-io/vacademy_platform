package vacademy.io.notification_service.features.send.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The canonical ("unified") variable set for outbound messages.
 *
 * <p>Announcements have always resolved this set centrally — see
 * {@code AnnouncementDeliveryService.processHtmlVariables}, which maps
 * {@code {{name}} / {{student_name}} / {{user_name}}} onto one display name,
 * {@code {{email}} / {{user_email}} / {{student_email}}} onto one address, and so on.
 * Everything else on the platform goes through the unified send API, whose substitution
 * is a plain loop over the caller-supplied {@code recipient.variables}: only the exact
 * keys the caller passed are replaced, and an unmatched {@code {{x}}} ships literally
 * to the inbox.
 *
 * <p>The practical consequence was that a template written against the canonical set —
 * e.g. the default easy-email scaffold, which uses {@code {{name}}} — rendered as literal
 * {@code {{name}}} for every workflow SEND_EMAIL node, transactional trigger and event
 * send, because those callers supply {@code fullName} / {@code parentName} instead.
 *
 * <p>This class closes the gap without requiring any caller to change: for each family
 * below it takes the first non-blank value the caller DID supply and fills in the family's
 * other spellings that the caller did NOT supply. Explicitly supplied keys always win —
 * this only ever adds keys, never overwrites one.
 */
public final class UnifiedVariableAliases {

    private UnifiedVariableAliases() {
    }

    /**
     * Alias families, in priority order within each family. The first entry that the
     * caller supplied with a non-blank value becomes the family's value; every other
     * entry the caller did not supply is filled with it.
     *
     * <p>Keep {@code username} out of the name family: it is the login handle, and the
     * announcement resolver treats it as a distinct variable.
     */
    private static final List<List<String>> FAMILIES = List.of(
            // Display name. Order mirrors how specific each key is about WHOSE name it is.
            List.of("fullName", "full_name", "fullname", "name", "user_name", "userName",
                    "student_name", "studentName", "parentName", "parent_name",
                    "leadName", "lead_name", "recipient_name", "recipientName"),
            // Email address
            List.of("email", "user_email", "userEmail", "student_email", "studentEmail",
                    "emailAddress", "email_address", "parentEmail", "parent_email"),
            // Phone / mobile
            List.of("mobileNumber", "mobile_number", "phone", "user_phone", "userPhone",
                    "student_phone", "studentPhone", "parentMobile", "parent_mobile",
                    "phoneNumber", "phone_number"),
            // Institute name
            List.of("instituteName", "institute_name"),
            // Login handle
            List.of("username", "userName_login"),
            // Name parts
            List.of("firstName", "first_name", "user_first_name"),
            List.of("lastName", "last_name", "user_last_name"));

    /** Family index 0 — the display-name family, used to derive first/last name. */
    private static final int NAME_FAMILY = 0;
    private static final int FIRST_NAME_FAMILY = 5;
    private static final int LAST_NAME_FAMILY = 6;

    /**
     * Returns a copy of {@code variables} with the canonical aliases filled in.
     *
     * @param variables caller-supplied variables; may be null or empty
     * @return a new mutable map — never null, never the same instance as the input
     */
    public static Map<String, String> expand(Map<String, String> variables) {
        Map<String, String> expanded = new LinkedHashMap<>();
        if (variables != null) {
            expanded.putAll(variables);
        }
        if (expanded.isEmpty()) {
            return expanded;
        }

        List<String> familyValues = new ArrayList<>();
        for (List<String> family : FAMILIES) {
            String value = firstNonBlank(expanded, family);
            familyValues.add(value);
            if (value == null) {
                continue;
            }
            for (String key : family) {
                expanded.putIfAbsent(key, value);
            }
        }

        // {{first_name}} / {{last_name}} are almost never supplied by a caller but are
        // common in templates. Derive them from the display name when we have one and
        // the caller gave us nothing better. Matches how the announcement resolver
        // splits fullName.
        String displayName = familyValues.get(NAME_FAMILY);
        if (displayName != null
                && familyValues.get(FIRST_NAME_FAMILY) == null
                && familyValues.get(LAST_NAME_FAMILY) == null) {
            String[] parts = displayName.trim().split("\\s+", 2);
            String first = parts.length > 0 ? parts[0] : "";
            String last = parts.length > 1 ? parts[1] : "";
            for (String key : FAMILIES.get(FIRST_NAME_FAMILY)) {
                expanded.putIfAbsent(key, first);
            }
            for (String key : FAMILIES.get(LAST_NAME_FAMILY)) {
                expanded.putIfAbsent(key, last);
            }
        }

        return expanded;
    }

    /**
     * Same expansion, but keeps only the keys the caller supplied plus alias keys that
     * the WhatsApp template actually declares a position for. WhatsApp params are handed
     * to the provider verbatim, so we must not pad the payload with a dozen unused names.
     */
    public static Map<String, String> expandForTemplate(Map<String, String> variables,
                                                        Map<String, Integer> nameToPosition) {
        Map<String, String> expanded = expand(variables);
        if (nameToPosition == null || nameToPosition.isEmpty()) {
            // No template mapping to satisfy — nothing would consume the extra keys.
            return variables != null ? new LinkedHashMap<>(variables) : new LinkedHashMap<>();
        }
        Map<String, String> result = new LinkedHashMap<>();
        for (Map.Entry<String, String> e : expanded.entrySet()) {
            boolean suppliedByCaller = variables != null && variables.containsKey(e.getKey());
            if (suppliedByCaller || nameToPosition.containsKey(e.getKey())) {
                result.put(e.getKey(), e.getValue());
            }
        }
        return result;
    }

    private static String firstNonBlank(Map<String, String> source, List<String> keys) {
        for (String key : keys) {
            String value = source.get(key);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    /** Every canonical key this resolver knows about — useful for docs/diagnostics. */
    public static List<String> knownVariables() {
        return FAMILIES.stream().flatMap(List::stream).distinct().toList();
    }

    static {
        // Guard the hardcoded family indices above against a careless reorder.
        if (!FAMILIES.get(NAME_FAMILY).contains("name")
                || !FAMILIES.get(FIRST_NAME_FAMILY).contains("first_name")
                || !FAMILIES.get(LAST_NAME_FAMILY).contains("last_name")) {
            throw new IllegalStateException("UnifiedVariableAliases family indices are out of sync"
                    + Arrays.toString(new int[]{NAME_FAMILY, FIRST_NAME_FAMILY, LAST_NAME_FAMILY}));
        }
    }
}
