package vacademy.io.admin_core_service.features.catalog_api.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;

import java.time.Duration;
import java.util.*;

/**
 * Media-service file ids → permanent public URLs, in batches. URLs are permanent (CDN keys), so a
 * resolved id is remembered for 24 h; an id that cannot be resolved is remembered as missing for
 * 10 minutes, so one broken image never turns every list request into per-id calls. Values that
 * already are http(s) URLs pass through untouched.
 */
@Slf4j
@Component
public class CatalogMediaResolver {

    private static final int BATCH = 50;
    private static final String MISSING = "";

    private final MediaService mediaService;
    private final Cache<String, String> resolved = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofHours(24)).maximumSize(100_000).build();
    private final Cache<String, String> missing = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(10)).maximumSize(20_000).build();

    public CatalogMediaResolver(MediaService mediaService) {
        this.mediaService = mediaService;
    }

    public static boolean isHttp(String v) {
        if (v == null) return false;
        String s = v.trim().toLowerCase(Locale.ROOT);
        return s.startsWith("http://") || s.startsWith("https://");
    }

    /** id (or URL) → URL for every value that resolves; others are absent from the map. */
    public Map<String, String> resolve(Collection<String> idsOrUrls) {
        Map<String, String> out = new HashMap<>();
        List<String> todo = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (String raw : idsOrUrls) {
            if (raw == null || raw.isBlank() || !seen.add(raw)) continue;
            if (isHttp(raw)) {
                out.put(raw, raw.trim());
                continue;
            }
            String hit = resolved.getIfPresent(raw);
            if (hit != null) {
                out.put(raw, hit);
            } else if (missing.getIfPresent(raw) == null) {
                todo.add(raw);
            }
        }
        for (int i = 0; i < todo.size(); i += BATCH) {
            List<String> chunk = todo.subList(i, Math.min(todo.size(), i + BATCH));
            Map<String, String> got = fetchBatch(chunk);
            for (String id : chunk) {
                String url = got.get(id);
                if (url != null && !url.isBlank()) {
                    resolved.put(id, url);
                    out.put(id, url);
                } else {
                    missing.put(id, MISSING);
                }
            }
        }
        return out;
    }

    public String resolveOne(String idOrUrl) {
        if (idOrUrl == null || idOrUrl.isBlank()) return null;
        return resolve(List.of(idOrUrl)).get(idOrUrl);
    }

    private Map<String, String> fetchBatch(List<String> ids) {
        try {
            return mediaService.getPublicUrlsWithoutExpiry(ids);
        } catch (Exception batchError) {
            // One unknown id fails the whole batch upstream: resolve one by one, skipping failures.
            log.info("catalog-api: media batch of {} failed ({}); resolving per id", ids.size(),
                    batchError.getMessage());
            Map<String, String> out = new HashMap<>();
            for (String id : ids) {
                try {
                    String url = mediaService.getFilePublicUrlByIdWithoutExpiry(id);
                    if (isHttp(url)) out.put(id, url.trim());
                } catch (Exception e) {
                    log.debug("catalog-api: media id {} not resolvable: {}", id, e.getMessage());
                }
            }
            return out;
        }
    }
}
