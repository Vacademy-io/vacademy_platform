package vacademy.io.community_service.feature.pricing.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.community_service.feature.pricing.dto.QuoteRequestDto;
import vacademy.io.community_service.feature.pricing.dto.QuoteResponseDto;
import vacademy.io.community_service.feature.pricing.service.PricingCatalogService;
import vacademy.io.community_service.feature.onboarding.service.SubmissionRateLimiter;
import vacademy.io.community_service.feature.pricing.service.PricingQuoteService;

import java.util.HashMap;
import java.util.Map;

/**
 * Unauthenticated plan-builder endpoints. Whitelisted in
 * {@code CommunityApplicationSecurityConfig.ALLOWED_PATHS}.
 */
@RestController
@RequestMapping("/community-service/public/v1/pricing")
public class PublicPricingController {

    @Autowired
    private PricingCatalogService catalog;
    @Autowired
    private PricingQuoteService quoteService;
    @Autowired
    private SubmissionRateLimiter rateLimiter;

    /** Products, their plans and the global commercial terms the builder renders. */
    @GetMapping("/catalog")
    public ResponseEntity<Map<String, Object>> catalog() {
        Map<String, Object> body = new HashMap<>();
        body.put("version", catalog.settingText("rate_card_version", "unversioned"));
        body.put("products", catalog.catalog());
        body.put("settings", catalog.settings());
        return ResponseEntity.ok(body);
    }

    /** Live pricing as the user configures. Writes nothing. */
    @PostMapping("/quote")
    public ResponseEntity<QuoteResponseDto> quote(@RequestBody QuoteRequestDto request) {
        return ResponseEntity.ok(quoteService.preview(request));
    }

    /** Persists the configured plan, attaching it to the onboarding lead when one is supplied. */
    @PostMapping("/quote/save")
    public ResponseEntity<QuoteResponseDto> save(@RequestBody QuoteRequestDto request,
                                                 HttpServletRequest http) {
        rateLimiter.check(http, "quote save");
        return ResponseEntity.ok(quoteService.save(request, null, false));
    }
}
