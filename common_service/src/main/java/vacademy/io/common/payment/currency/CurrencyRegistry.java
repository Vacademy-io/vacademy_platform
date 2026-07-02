package vacademy.io.common.payment.currency;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Single source of truth for currency metadata used by the payment layer.
 *
 * <p>The platform forwards arbitrary ISO-4217 codes to the configured gateway, so this
 * registry deliberately does <b>not</b> whitelist currencies. Its only job is to know how
 * many minor-unit decimal places each currency has, so that a major-unit amount (e.g. 10.50)
 * is converted to the gateway's smallest unit correctly instead of a blanket {@code ×100}.
 *
 * <p>A blanket {@code ×100} is wrong for:
 * <ul>
 *   <li>zero-decimal currencies (JPY, KRW, VND, …) — they have no minor unit, so 1000 JPY
 *       must be sent as {@code 1000}, not {@code 100000};</li>
 *   <li>three-decimal currencies (KWD, BHD, OMR, …) — 1.000 KWD must be sent as {@code 1000}.</li>
 * </ul>
 *
 * <p>Unknown codes fall back to the ISO-4217 default of 2 decimal places.
 */
public final class CurrencyRegistry {

    private CurrencyRegistry() {
    }

    private static final int DEFAULT_EXPONENT = 2;

    /** ISO code -&gt; number of minor-unit decimal places (only non-default values listed). */
    private static final Map<String, Integer> MINOR_UNIT_EXPONENT;

    static {
        Map<String, Integer> m = new HashMap<>();
        // Zero-decimal currencies (no minor unit at all).
        for (String c : new String[]{
                "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG",
                "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"}) {
            m.put(c, 0);
        }
        // Three-decimal currencies.
        for (String c : new String[]{
                "BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"}) {
            m.put(c, 3);
        }
        MINOR_UNIT_EXPONENT = Collections.unmodifiableMap(m);
    }

    /**
     * Number of minor-unit decimal places for a currency (0, 2 or 3).
     * Returns {@link #DEFAULT_EXPONENT} for {@code null} or unknown codes.
     */
    public static int minorUnitExponent(String currencyCode) {
        if (currencyCode == null) {
            return DEFAULT_EXPONENT;
        }
        return MINOR_UNIT_EXPONENT.getOrDefault(currencyCode.trim().toUpperCase(), DEFAULT_EXPONENT);
    }

    /**
     * Convert a major-unit amount (e.g. {@code 10.50}) into the gateway minor unit:
     * {@code 1050} cents for a 2-decimal currency, {@code 10} for zero-decimal yen, or
     * {@code 10500} for a 3-decimal dinar. Rounds half-up.
     */
    public static long toMinorUnits(double amount, String currencyCode) {
        int exponent = minorUnitExponent(currencyCode);
        return BigDecimal.valueOf(amount)
                .movePointRight(exponent)
                .setScale(0, RoundingMode.HALF_UP)
                .longValue();
    }

    /**
     * Inverse of {@link #toMinorUnits}: convert a gateway minor-unit amount back to a
     * major-unit amount (e.g. {@code 1050} cents → {@code 10.50}, {@code 1000} yen →
     * {@code 1000.0}). Use this everywhere a gateway response/webhook amount is decoded,
     * so zero- and three-decimal currencies are not divided by the wrong factor.
     */
    public static double fromMinorUnits(long minorAmount, String currencyCode) {
        int exponent = minorUnitExponent(currencyCode);
        return BigDecimal.valueOf(minorAmount)
                .movePointLeft(exponent)
                .doubleValue();
    }
}
