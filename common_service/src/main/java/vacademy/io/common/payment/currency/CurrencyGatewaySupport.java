package vacademy.io.common.payment.currency;

import vacademy.io.common.payment.enums.PaymentGateway;

import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

/**
 * Declares which currencies each payment gateway can actually process.
 *
 * <p>This is intentionally permissive: a gateway is only restricted here when it
 * genuinely cannot settle other currencies (PhonePe is India-domestic; eWay is an
 * AU/NZ acquirer). For Stripe, Razorpay, Cashfree, PayPal and Manual the real
 * availability of a currency depends on the individual merchant account's activation,
 * so we do not block them at the platform level — a gateway with no entry is treated
 * as unrestricted.
 */
public final class CurrencyGatewaySupport {

    private CurrencyGatewaySupport() {
    }

    /** Gateway -&gt; supported ISO codes. Absence of a key means "unrestricted". */
    private static final Map<PaymentGateway, Set<String>> SUPPORTED = new EnumMap<>(PaymentGateway.class);

    static {
        // PhonePe only settles INR (India domestic gateway).
        SUPPORTED.put(PaymentGateway.PHONEPE, Set.of("INR"));
        // eWay is an Australian/New Zealand acquirer; its documented processing currencies.
        SUPPORTED.put(PaymentGateway.EWAY,
                Set.of("AUD", "NZD", "USD", "GBP", "EUR", "HKD", "SGD", "CAD", "JPY"));
        // STRIPE / RAZORPAY / CASHFREE / PAYPAL / MANUAL: unrestricted at platform level.
    }

    /**
     * Whether the gateway can process the given currency. Returns {@code true} for
     * unrestricted gateways and for {@code null} inputs (validation handled elsewhere).
     */
    public static boolean isSupported(PaymentGateway gateway, String currencyCode) {
        if (gateway == null || currencyCode == null) {
            return true;
        }
        Set<String> allowed = SUPPORTED.get(gateway);
        if (allowed == null) {
            return true;
        }
        return allowed.contains(currencyCode.trim().toUpperCase());
    }

    /**
     * The supported currency set for a gateway, or an empty set when the gateway is
     * unrestricted (an empty set means "no platform-level restriction", not "none allowed").
     */
    public static Set<String> supportedCurrencies(PaymentGateway gateway) {
        if (gateway == null) {
            return Collections.emptySet();
        }
        return SUPPORTED.getOrDefault(gateway, Collections.emptySet());
    }
}
