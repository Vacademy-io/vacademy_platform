package vacademy.io.admin_core_service.features.regional_pricing.service;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Currency;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * The viewer's country, from the geo header our edge adds to every request.
 *
 * <p>The API is proxied by Cloudflare, which stamps {@code CF-IPCountry} (and overwrites any
 * value a client sends). {@code CloudFront-Viewer-Country} is honoured too so the same code
 * works behind CloudFront. No per-request geo-IP lookup is made. A request that reaches the
 * origin without passing the edge could spoof the header — the worst case is that the
 * caller sees and pays another region's price, never a price the admin did not set.
 */
@Component
public class ViewerCountryResolver {

    @Value("${regional.pricing.country-headers:CF-IPCountry,CloudFront-Viewer-Country}")
    private List<String> countryHeaders;

    /** ISO-3166 alpha-2 country of the current HTTP request, if the edge supplied one. */
    public Optional<String> currentCountry() {
        RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
        if (!(attrs instanceof ServletRequestAttributes servletAttrs)) {
            return Optional.empty();
        }
        HttpServletRequest request = servletAttrs.getRequest();
        for (String header : countryHeaders) {
            String value = request.getHeader(header.trim());
            String normalized = normalize(value);
            if (normalized != null) {
                return Optional.of(normalized);
            }
        }
        return Optional.empty();
    }

    /** Local currency of a country (IN → INR, US → USD), or empty when the JDK has none. */
    public static Optional<String> currencyOf(String countryCode) {
        if (countryCode == null) {
            return Optional.empty();
        }
        try {
            Currency c = Currency.getInstance(new Locale("", countryCode));
            return c == null ? Optional.empty() : Optional.of(c.getCurrencyCode());
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /** Cloudflare uses XX for unknown and T1 for Tor — neither is a country. */
    static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String v = value.trim().toUpperCase();
        if (v.length() != 2 || "XX".equals(v) || "T1".equals(v) || !Character.isLetter(v.charAt(0))
                || !Character.isLetter(v.charAt(1))) {
            return null;
        }
        return v;
    }
}
