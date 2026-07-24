package vacademy.io.admin_core_service.features.live_session.util;

import java.util.List;
import java.util.Locale;

/**
 * Identifies the "who is this person" fields (name / email / phone) inside a live
 * session's public registration form.
 *
 * <p>A session's form is built entirely from admin-defined custom fields, so there is
 * no fixed column to read a phone number from. Field keys are additionally suffixed
 * per institute by {@code CustomFieldKeyGenerator} (e.g. {@code phone_number_inst_<uuid>},
 * and {@code _1}/{@code _2} on collision), which rules out an exact-key match.
 *
 * <p>The substring rule here mirrors {@code getFieldRenderType} in the learner app's
 * {@code custom-field-helpers.ts} — the same rule that decides a field renders as a
 * phone input on the form. Keeping both ends on one rule is what stops a field that
 * renders as a phone box from being invisible to notifications.
 *
 * <p>Matching runs email → name → phone so that a field like {@code contact_name}
 * resolves to NAME rather than being claimed by the phone keyword {@code contact}.
 * Institute-id suffixes are hex UUIDs and cannot contain these keywords.
 */
public final class GuestFormFieldResolver {

    /** Field roles a registration form field can map to. */
    public enum Role {
        EMAIL, NAME, PHONE, OTHER
    }

    private static final List<String> EMAIL_KEYWORDS = List.of("email", "e-mail", "mail");
    private static final List<String> NAME_KEYWORDS = List.of("name");
    private static final List<String> PHONE_KEYWORDS = List.of("phone", "mobile", "contact", "telephone", "cell");

    private GuestFormFieldResolver() {
    }

    /**
     * Classifies a form field by its key and label. Either argument may be null —
     * whichever is present is checked, key first.
     */
    public static Role classify(String fieldKey, String fieldName) {
        String key = normalize(fieldKey);
        String name = normalize(fieldName);

        if (matches(key, EMAIL_KEYWORDS) || matches(name, EMAIL_KEYWORDS)) return Role.EMAIL;
        if (matches(key, NAME_KEYWORDS) || matches(name, NAME_KEYWORDS)) return Role.NAME;
        if (matches(key, PHONE_KEYWORDS) || matches(name, PHONE_KEYWORDS)) return Role.PHONE;
        return Role.OTHER;
    }

    private static boolean matches(String value, List<String> keywords) {
        if (value.isEmpty()) return false;
        return keywords.stream().anyMatch(value::contains);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).trim();
    }
}
