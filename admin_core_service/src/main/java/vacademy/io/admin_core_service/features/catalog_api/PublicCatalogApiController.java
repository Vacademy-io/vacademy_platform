package vacademy.io.admin_core_service.features.catalog_api;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.catalog_api.auth.CatalogApiAuth;
import vacademy.io.admin_core_service.features.catalog_api.service.CatalogApiService;
import vacademy.io.admin_core_service.features.catalog_api.service.CatalogLeadService;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Catalogue API v1: an institute's courses, streams and learning paths for its own website, read
 * from the same data the hosted catalogue site renders, plus enquiries into the CRM. Public base
 * URL https://api.vacademy.ai/catalog/v1 (ingress rewrite to this path); authenticated with a
 * publishable catalogue key ({@code vak_pub_…}, X-API-Key or Bearer). JSON is snake_case; errors
 * are {"error":{"code","message","request_id","details"?}} (CatalogApiErrorAdvice).
 *
 * <p>Every read needs scope {@code catalog:read} and is cacheable for 60 s
 * ({@code Cache-Control: public, max-age=60}); POST /leads needs {@code leads:write}.
 */
@RestController
@RequestMapping(PublicCatalogApiController.PREFIX)
@RequiredArgsConstructor
public class PublicCatalogApiController {

    static final String PREFIX = "/admin-core-service/open/catalog/v1";

    /** Every route of this API, for telling a wrong method (405) from an unknown path (404). */
    private static final Pattern KNOWN_PATHS = Pattern.compile(
            "^/(site|courses(/[^/]+(/outline)?)?|streams|learning-paths(/[^/]+)?|sitemap|leads)$");

    private final CatalogApiAuth auth;
    private final CatalogApiService service;
    private final CatalogLeadService leads;

    @GetMapping("/site")
    public ResponseEntity<Map<String, Object>> site(HttpServletRequest http) {
        var p = auth.authenticate(http, CatalogApiAuth.SCOPE_READ);
        return cacheable(service.site(p.instituteId()));
    }

    @GetMapping("/courses")
    public ResponseEntity<Map<String, Object>> courses(HttpServletRequest http,
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "stream", required = false) String stream,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "format", required = false) String format,
            @RequestParam(value = "language", required = false) String language,
            @RequestParam(value = "tag", required = false) String tag,
            @RequestParam(value = "availability", required = false) String availability,
            @RequestParam(value = "page", required = false) String page,
            @RequestParam(value = "page_size", required = false) String pageSize,
            @RequestParam(value = "sort", required = false) String sort) {
        var p = auth.authenticate(http, CatalogApiAuth.SCOPE_READ);
        int pageNo = intParam("page", page, 1);
        int size = intParam("page_size", pageSize, 24);
        return cacheable(service.courses(p.instituteId(), new CatalogApiService.CourseQuery(q, stream, category,
                format, language, tag, availability, pageNo, size, sort)));
    }

    @GetMapping("/courses/{id}")
    public ResponseEntity<Map<String, Object>> course(HttpServletRequest http, @PathVariable("id") String id,
            @RequestParam(value = "language", required = false) String language) {
        var p = auth.authenticate(http, CatalogApiAuth.SCOPE_READ);
        return cacheable(service.course(p.instituteId(), id, language));
    }

    @GetMapping("/courses/{id}/outline")
    public ResponseEntity<Map<String, Object>> outline(HttpServletRequest http, @PathVariable("id") String id,
            @RequestParam(value = "language", required = false) String language) {
        var p = auth.authenticate(http, CatalogApiAuth.SCOPE_READ);
        return cacheable(service.outline(p.instituteId(), id, language));
    }

    @GetMapping("/streams")
    public ResponseEntity<Map<String, Object>> streams(HttpServletRequest http) {
        var p = auth.authenticate(http, CatalogApiAuth.SCOPE_READ);
        return cacheable(service.streams(p.instituteId()));
    }

    @GetMapping("/learning-paths")
    public ResponseEntity<Map<String, Object>> learningPaths(HttpServletRequest http,
            @RequestParam(value = "stream", required = false) String stream) {
        var p = auth.authenticate(http, CatalogApiAuth.SCOPE_READ);
        return cacheable(service.learningPaths(p.instituteId(), stream));
    }

    @GetMapping("/learning-paths/{code}")
    public ResponseEntity<Map<String, Object>> learningPath(HttpServletRequest http, @PathVariable("code") String code) {
        var p = auth.authenticate(http, CatalogApiAuth.SCOPE_READ);
        return cacheable(service.learningPath(p.instituteId(), code));
    }

    @GetMapping("/sitemap")
    public ResponseEntity<Map<String, Object>> sitemap(HttpServletRequest http) {
        var p = auth.authenticate(http, CatalogApiAuth.SCOPE_READ);
        return cacheable(service.sitemap(p.instituteId()));
    }

    @PostMapping("/leads")
    public ResponseEntity<Map<String, Object>> lead(HttpServletRequest http,
            @RequestBody(required = false) JsonNode body) {
        var p = auth.authenticate(http, CatalogApiAuth.SCOPE_LEADS_WRITE);
        auth.rateLimitLead(p, http);
        CatalogLeadService.Lead lead = CatalogLeadService.validate(body);
        CatalogLeadService.Outcome outcome = leads.submit(p.instituteId(), lead);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", outcome.status());
        return ResponseEntity.status(outcome.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .header("Cache-Control", "no-store")
                .body(out);
    }

    /**
     * Anything no route above matched: an unknown path is 404 and a known path with the wrong
     * method is 405, both in the API's error shape (without this, Spring's own /error dispatch
     * answers with a bare 403 because /error is not a public route).
     */
    @RequestMapping("/**")
    public ResponseEntity<Map<String, Object>> fallback(HttpServletRequest http) {
        String uri = http.getRequestURI();
        String path = uri.startsWith(PREFIX) ? uri.substring(PREFIX.length()) : uri;
        if (KNOWN_PATHS.matcher(path).matches()) {
            throw new CatalogApiException(HttpStatus.METHOD_NOT_ALLOWED, "method_not_allowed",
                    http.getMethod() + " is not supported on /catalog/v1" + path + ".");
        }
        throw new CatalogApiException(HttpStatus.NOT_FOUND, "not_found",
                "No such endpoint: " + http.getMethod() + " /catalog/v1" + path + ".");
    }

    static int intParam(String name, String raw, int fallback) {
        if (raw == null || raw.isBlank()) return fallback;
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("param", name);
            throw new CatalogApiException(HttpStatus.BAD_REQUEST, "invalid_request", name + " must be a whole number.",
                    details, null);
        }
    }

    private static ResponseEntity<Map<String, Object>> cacheable(Map<String, Object> body) {
        return ResponseEntity.ok()
                .header("Cache-Control", "public, max-age=60")
                .header("Vary", "Origin, X-API-Key, Authorization")
                .body(body);
    }
}
