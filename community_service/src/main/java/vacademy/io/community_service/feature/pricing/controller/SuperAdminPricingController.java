package vacademy.io.community_service.feature.pricing.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.community_service.feature.pricing.dto.QuoteRequestDto;
import vacademy.io.community_service.feature.pricing.dto.QuoteResponseDto;
import vacademy.io.community_service.feature.pricing.entity.PricingQuote;
import vacademy.io.community_service.feature.pricing.service.PricingQuoteService;

import java.util.List;

/**
 * Internal plan-builder endpoints. Authenticated (these paths are deliberately NOT in the
 * security allow-list), so only a logged-in rep can override rates or move a quote's status.
 */
@RestController
@RequestMapping("/community-service/super-admin/v1/pricing")
public class SuperAdminPricingController {

    @Autowired
    private PricingQuoteService quoteService;

    /** Save with internal privileges: rate overrides and custom development lines are honoured. */
    @PostMapping("/quote/save")
    public ResponseEntity<QuoteResponseDto> save(@RequestBody QuoteRequestDto request,
                                                 @RequestHeader(value = "X-User-Id", required = false) String userId) {
        return ResponseEntity.ok(quoteService.save(request, userId, true));
    }

    @GetMapping("/quotes")
    public ResponseEntity<Page<PricingQuote>> list(@RequestParam(required = false) String status,
                                                   @RequestParam(required = false) String source,
                                                   @RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(quoteService.search(status, source, page, size));
    }

    /** Every quote built for a given onboarding lead, newest first. */
    @GetMapping("/quotes/by-submission/{submissionId}")
    public ResponseEntity<List<PricingQuote>> bySubmission(@PathVariable String submissionId) {
        return ResponseEntity.ok(quoteService.forSubmission(submissionId));
    }

    @PutMapping("/quotes/{id}/status")
    public ResponseEntity<PricingQuote> updateStatus(@PathVariable String id,
                                                     @RequestParam String status) {
        return ResponseEntity.ok(quoteService.updateStatus(id, status));
    }
}
