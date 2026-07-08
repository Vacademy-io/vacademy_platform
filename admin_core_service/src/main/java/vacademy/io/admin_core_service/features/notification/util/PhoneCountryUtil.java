package vacademy.io.admin_core_service.features.notification.util;

/**
 * Phone-number country-code helpers for outbound WhatsApp.
 *
 * <p>WhatsApp needs full international format (country code + national number,
 * no '+', no leading zero). Numbers captured through the app already carry a
 * dial code, but imported / legacy / Meta leads can arrive as bare 10-digit
 * national numbers. For those we prepend India's country code (91) — but ONLY
 * when the institute's country is blank/unknown or India, so we never mis-prefix
 * a genuine foreign number (US, UK, Australia, …) as Indian.
 */
public final class PhoneCountryUtil {

    private PhoneCountryUtil() {
    }

    /**
     * Whether an institute's country should default to India (+91) for phone
     * normalization. True when the country is blank/unknown or explicitly India;
     * any recognized non-India value returns false.
     */
    public static boolean defaultsToIndia(String country) {
        if (country == null) {
            return true;
        }
        String c = country.trim().toLowerCase();
        if (c.isEmpty()) {
            return true;
        }
        return c.equals("india") || c.equals("ind") || c.equals("in");
    }

    /**
     * Sanitize a raw phone to digits only and, when the institute defaults to
     * India, prepend "91" to a bare 10-digit number. Returns null for null input.
     */
    public static String normalizePhone(String raw, boolean instituteDefaultsToIndia) {
        if (raw == null) {
            return null;
        }
        // Strip '+' and every non-numeric character.
        String digits = raw.replaceAll("[^0-9]", "");
        // A bare 10-digit number has no country code — assume India when the
        // institute is India or has no country set.
        if (instituteDefaultsToIndia && digits.length() == 10) {
            digits = "91" + digits;
        }
        return digits;
    }
}
