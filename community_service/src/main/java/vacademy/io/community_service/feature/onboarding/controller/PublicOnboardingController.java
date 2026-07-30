package vacademy.io.community_service.feature.onboarding.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.community_service.feature.onboarding.dto.PublicLinkConfigDto;
import vacademy.io.community_service.feature.onboarding.dto.SubmitRequestDto;
import vacademy.io.community_service.feature.onboarding.dto.SubmitResponseDto;
import vacademy.io.community_service.feature.onboarding.service.OnboardingLinkService;
import vacademy.io.community_service.feature.onboarding.service.OnboardingSubmissionService;
import vacademy.io.community_service.feature.onboarding.service.SubmissionRateLimiter;

/**
 * Unauthenticated onboarding endpoints powering the public form on the health-check frontend.
 * Whitelisted in {@code CommunityApplicationSecurityConfig.ALLOWED_PATHS}.
 */
@RestController
@RequestMapping("/community-service/public/v1/onboarding")
public class PublicOnboardingController {

    @Autowired
    private OnboardingLinkService linkService;
    @Autowired
    private OnboardingSubmissionService submissionService;
    @Autowired
    private SubmissionRateLimiter rateLimiter;

    /** Form config for a link: which questions to show, prefilled values, institute-type options. */
    @GetMapping("/link/{slug}")
    public ResponseEntity<PublicLinkConfigDto> getLink(@PathVariable String slug) {
        return ResponseEntity.ok(linkService.resolvePublicConfig(slug));
    }

    /** Submit a completed form → records it, emails the team, returns the demo handoff. */
    @PostMapping("/submit")
    public ResponseEntity<SubmitResponseDto> submit(@RequestBody SubmitRequestDto request,
                                                    HttpServletRequest http) {
        rateLimiter.check(http, "onboarding submit");
        return ResponseEntity.ok(submissionService.submit(request));
    }

    // GET /demo/{instituteType} was removed on 2026-07-30. It returned the shared demo accounts'
    // admin credentials to any anonymous caller. Demos are now provisioned per lead from the
    // Quotes tab, so the endpoint was pure liability.
}
