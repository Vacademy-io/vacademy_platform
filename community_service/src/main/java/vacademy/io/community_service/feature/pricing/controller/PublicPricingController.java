package vacademy.io.community_service.feature.pricing.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.community_service.feature.pricing.dto.BracketDto;
import vacademy.io.community_service.feature.pricing.dto.QuoteRequestDto;
import vacademy.io.community_service.feature.pricing.dto.QuoteResponseDto;
import vacademy.io.community_service.feature.pricing.service.PricingQuoteService;
import vacademy.io.community_service.feature.pricing.service.RateCard;

import java.util.List;
import java.util.Map;

/**
 * Unauthenticated plan-builder endpoints. Whitelisted in
 * {@code CommunityApplicationSecurityConfig.ALLOWED_PATHS}.
 */
@RestController
@RequestMapping("/community-service/public/v1/pricing")
public class PublicPricingController {

    @Autowired
    private RateCard rateCard;
    @Autowired
    private PricingQuoteService quoteService;

    /** The rate card the builder renders: brackets, inclusions and the flat add-on prices. */
    @GetMapping("/catalog")
    public ResponseEntity<Map<String, Object>> catalog() {
        List<BracketDto> brackets = rateCard.brackets();
        return ResponseEntity.ok(Map.ofEntries(
                Map.entry("version", RateCard.VERSION),
                Map.entry("brackets", brackets),
                Map.entry("androidOneTime", RateCard.ANDROID_ONE_TIME),
                Map.entry("iosOneTime", RateCard.IOS_ONE_TIME),
                Map.entry("whatsappAndPayments", RateCard.WHATSAPP_AND_PAYMENTS),
                Map.entry("websiteAnnual", RateCard.WEBSITE_ANNUAL),
                Map.entry("crmBase", RateCard.CRM_BASE),
                Map.entry("crmIncludedSeats", RateCard.CRM_INCLUDED_SEATS),
                Map.entry("crmExtraSeat", RateCard.CRM_EXTRA_SEAT),
                Map.entry("extraSubOrg", RateCard.EXTRA_SUB_ORG),
                Map.entry("meetPerSessionHour", RateCard.MEET_PER_SESSION_HOUR),
                Map.entry("premiumSupportUpgrade", RateCard.PREMIUM_SUPPORT_UPGRADE),
                Map.entry("dedicatedSupportMonthly", RateCard.DEDICATED_SUPPORT_MONTHLY),
                Map.entry("gstRate", RateCard.GST_RATE),
                Map.entry("usdPerInr", RateCard.USD_PER_INR)));
    }

    /** Live pricing as the user configures. Writes nothing. */
    @PostMapping("/quote")
    public ResponseEntity<QuoteResponseDto> quote(@RequestBody QuoteRequestDto request) {
        return ResponseEntity.ok(quoteService.preview(request));
    }

    /** Persists the configured plan, attaching it to the onboarding lead when one is supplied. */
    @PostMapping("/quote/save")
    public ResponseEntity<QuoteResponseDto> save(@RequestBody QuoteRequestDto request) {
        return ResponseEntity.ok(quoteService.save(request, null, false));
    }
}
