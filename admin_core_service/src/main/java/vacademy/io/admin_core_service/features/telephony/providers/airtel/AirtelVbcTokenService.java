package vacademy.io.admin_core_service.features.telephony.providers.airtel;

import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderCredentials;
import vacademy.io.common.exceptions.VacademyException;

import java.nio.charset.StandardCharsets;
import java.net.URLEncoder;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Mints + caches VBC OAuth bearer tokens (password grant). One token per OAuth
 * application (keyed by consumerKey), cached until ~2 min before expiry.
 *
 * Defaults match the live Airtel/Vonage tenant: a WSO2 token host that is
 * SEPARATE from the API gateway. Both are overridable per-institute via the
 * provider config (tokenUrl).
 */
@Component
public class AirtelVbcTokenService {

    static final String DEFAULT_TOKEN_URL =
            "https://apimanager.auth.prod.vonagenetworks.net:443/t/vbc.prod/oauth2/token";
    /** VBC appends this realm suffix to the username for the password grant. */
    private static final String VBC_REALM_SUFFIX = "@vbc.prod";

    private final RestTemplate rest = new RestTemplate();
    private final Map<String, CachedToken> cache = new ConcurrentHashMap<>();

    private record CachedToken(String bearer, Instant expiresAt) {}

    /** A valid bearer for these credentials, minting + caching as needed. */
    public String bearer(ProviderCredentials creds) {
        String key = cacheKey(creds);
        CachedToken c = cache.get(key);
        if (c != null && c.expiresAt().isAfter(Instant.now())) {
            return c.bearer();
        }
        return mint(creds, key);
    }

    /** Drop the cached token (e.g. after a 401), forcing a fresh mint next call. */
    public void invalidate(ProviderCredentials creds) {
        cache.remove(cacheKey(creds));
    }

    /**
     * The minted bearer is scoped to the VBC USER (password grant), not just the
     * OAuth application — so the cache key must include the username (and token
     * host). Otherwise two institutes sharing one consumerKey but different VBC
     * users could be served each other's user-scoped token.
     */
    private static String cacheKey(ProviderCredentials creds) {
        String consumerKey = creds.secret("consumerKey");
        if (consumerKey == null) throw new VacademyException("Airtel consumerKey is not configured");
        String username = creds.secret("vbcUsername");
        String tokenUrl = firstNonBlank(creds.conf("tokenUrl"), DEFAULT_TOKEN_URL);
        return consumerKey + "|" + (username == null ? "" : username) + "|" + tokenUrl;
    }

    @SuppressWarnings("unchecked")
    private String mint(ProviderCredentials creds, String key) {
        String tokenUrl = firstNonBlank(creds.conf("tokenUrl"), DEFAULT_TOKEN_URL);
        String username = creds.secret("vbcUsername");
        if (username != null && !username.contains("@")) username += VBC_REALM_SUFFIX;

        String form = "grant_type=password&scope=openid"
                + "&username=" + enc(username)
                + "&password=" + enc(creds.secret("vbcPassword"));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(nz(creds.secret("consumerKey")), nz(creds.secret("consumerSecret")));

        Map<String, Object> body;
        try {
            ResponseEntity<Map> resp = rest.postForEntity(tokenUrl, new HttpEntity<>(form, headers), Map.class);
            body = resp.getBody();
        } catch (Exception e) {
            throw new VacademyException("Airtel token request failed: " + e.getMessage());
        }
        if (body == null || body.get("access_token") == null) {
            throw new VacademyException("Airtel token response missing access_token");
        }
        String token = String.valueOf(body.get("access_token"));
        long expiresIn = body.get("expires_in") instanceof Number n ? n.longValue() : 86400L;
        cache.put(key, new CachedToken(token, Instant.now().plusSeconds(Math.max(60, expiresIn - 120))));
        return token;
    }

    private static String enc(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String firstNonBlank(String a, String b) {
        return (a != null && !a.isBlank()) ? a : b;
    }
}
