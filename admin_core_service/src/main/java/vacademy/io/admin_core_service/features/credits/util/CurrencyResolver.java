package vacademy.io.admin_core_service.features.credits.util;

import org.springframework.stereotype.Component;
import vacademy.io.common.institute.entity.Institute;

import java.util.Locale;
import java.util.Set;

/**
 * Resolve which currency a given institute should be billed in for AI credit
 * pack purchases.
 *
 * Decision tree (first match wins):
 *   1. Institute has a manual `currency` override → use it.
 *   2. Institute country looks Indian → INR.
 *   3. Otherwise → USD (MVP fallback).
 *
 * Country values are free-text in `institutes.country`, so we do best-effort
 * normalization. Add more synonyms here as we discover them in production.
 */
@Component
public class CurrencyResolver {

    public static final String INR = "INR";
    public static final String USD = "USD";

    private static final Set<String> INDIA_COUNTRY_TOKENS = Set.of(
            "IN", "IND", "INDIA", "BHARAT");

    public String resolveCurrency(Institute institute) {
        if (institute == null) {
            return USD;
        }

        String override = trimToNull(institute.getCurrency());
        if (override != null) {
            return override.toUpperCase(Locale.ROOT);
        }

        String country = trimToNull(institute.getCountry());
        if (country != null && INDIA_COUNTRY_TOKENS.contains(country.toUpperCase(Locale.ROOT))) {
            return INR;
        }

        return USD;
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
