package vacademy.io.common.core.i18n;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Collections;
import java.util.Enumeration;
import java.util.Locale;

/**
 * Resolves the request locale for every service (auto-activated everywhere via
 * SharedConfigurationReference's component scan). Resolution order:
 *
 *   1. "lang" query parameter          (?lang=ar)
 *   2. Accept-Language header          (first supported tag by q-value)
 *   3. JWT "locale" claim              (payload decoded WITHOUT signature
 *                                       verification — locale is a display
 *                                       preference, not security-sensitive;
 *                                       real auth happens in JwtAuthFilter)
 *   4. LocaleRegistry.DEFAULT ("en")
 *
 * The resolved locale is exposed two ways so it survives the whole request:
 *   - LocaleContextHolder for code running outside the MVC dispatch, and
 *   - a request wrapper overriding getLocale()/getLocales(), which Spring
 *     MVC's default AcceptHeaderLocaleResolver reads at dispatch time (the
 *     DispatcherServlet re-initializes LocaleContextHolder from it, so this
 *     is what makes the resolution visible inside controllers/services with
 *     zero per-service configuration).
 *
 * This filter runs on every request of all six services, so it must never
 * fail: the entire resolution is wrapped in a catch-all and any error simply
 * continues the chain with the request untouched.
 */
@Component
public class LocaleResolutionFilter extends OncePerRequestFilter {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        HttpServletRequest requestToUse = request;
        try {
            String resolved = resolveLocaleTag(request);
            Locale locale = Locale.forLanguageTag(resolved);
            LocaleContextHolder.setLocale(locale);
            requestToUse = new FixedLocaleRequest(request, locale);
        } catch (Exception e) {
            // Locale resolution must never break a request — proceed untouched.
            requestToUse = request;
        }
        try {
            filterChain.doFilter(requestToUse, response);
        } finally {
            LocaleContextHolder.resetLocaleContext();
        }
    }

    /** Full resolution chain; always returns a supported tag. */
    static String resolveLocaleTag(HttpServletRequest request) {
        String fromQuery = LocaleRegistry.normalizeOrNull(extractQueryParam(request.getQueryString(), "lang"));
        if (fromQuery != null) {
            return fromQuery;
        }
        String fromHeader = parseAcceptLanguage(request.getHeader("Accept-Language"));
        if (fromHeader != null) {
            return fromHeader;
        }
        String fromJwt = extractJwtLocaleClaim(request.getHeader("Authorization"));
        if (fromJwt != null) {
            return fromJwt;
        }
        return LocaleRegistry.DEFAULT;
    }

    /**
     * Pulls a parameter straight out of the raw query string. Deliberately NOT
     * request.getParameter(): that can consume the body of form-encoded POSTs
     * as a side effect, which would be a behavior change for every service.
     */
    static String extractQueryParam(String queryString, String name) {
        if (queryString == null || queryString.isEmpty()) {
            return null;
        }
        try {
            for (String pair : queryString.split("&")) {
                int eq = pair.indexOf('=');
                String key = eq >= 0 ? pair.substring(0, eq) : pair;
                if (name.equals(URLDecoder.decode(key, StandardCharsets.UTF_8))) {
                    String value = eq >= 0 ? pair.substring(eq + 1) : "";
                    return URLDecoder.decode(value, StandardCharsets.UTF_8);
                }
            }
        } catch (Exception e) {
            // Malformed query string — treat as absent.
        }
        return null;
    }

    /**
     * Minimal Accept-Language parser: returns the first SUPPORTED tag when
     * entries are ordered by descending q-value (q defaults to 1). Unsupported
     * tags and wildcards are skipped; null when nothing matches.
     */
    static String parseAcceptLanguage(String headerValue) {
        if (headerValue == null || headerValue.isBlank()) {
            return null;
        }
        try {
            String bestTag = null;
            double bestQ = -1.0;
            for (String entry : headerValue.split(",")) {
                String[] parts = entry.trim().split(";");
                String tag = parts[0].trim();
                if (tag.isEmpty() || "*".equals(tag)) {
                    continue;
                }
                double q = 1.0;
                for (int i = 1; i < parts.length; i++) {
                    String param = parts[i].trim();
                    if (param.startsWith("q=")) {
                        q = Double.parseDouble(param.substring(2).trim());
                    }
                }
                String normalized = LocaleRegistry.normalizeOrNull(tag);
                if (normalized != null && q > bestQ) {
                    bestTag = normalized;
                    bestQ = q;
                }
            }
            return bestTag;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Best-effort read of the "locale" claim from a Bearer token's payload.
     * Plain Base64URL + Jackson, no signature verification — the claim only
     * carries a display preference. Any parse problem returns null.
     */
    static String extractJwtLocaleClaim(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        try {
            String[] segments = authHeader.substring(7).trim().split("\\.");
            if (segments.length < 2) {
                return null;
            }
            byte[] payloadBytes = Base64.getUrlDecoder().decode(segments[1]);
            JsonNode payload = OBJECT_MAPPER.readTree(payloadBytes);
            JsonNode localeNode = payload.get("locale");
            if (localeNode == null || !localeNode.isTextual()) {
                return null;
            }
            return LocaleRegistry.normalizeOrNull(localeNode.asText());
        } catch (Exception e) {
            return null;
        }
    }

    /** Request wrapper pinning getLocale()/getLocales() to the resolved locale. */
    private static final class FixedLocaleRequest extends HttpServletRequestWrapper {
        private final Locale locale;

        private FixedLocaleRequest(HttpServletRequest request, Locale locale) {
            super(request);
            this.locale = locale;
        }

        @Override
        public Locale getLocale() {
            return locale;
        }

        @Override
        public Enumeration<Locale> getLocales() {
            return Collections.enumeration(Collections.singletonList(locale));
        }
    }
}
