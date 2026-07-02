package vacademy.io.community_service.feature.onboarding.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.community_service.feature.onboarding.dto.DemoHandoffDto;
import vacademy.io.community_service.feature.onboarding.dto.PublicLinkConfigDto;
import vacademy.io.community_service.feature.onboarding.dto.SubmitRequestDto;
import vacademy.io.community_service.feature.onboarding.dto.SubmitResponseDto;
import vacademy.io.community_service.feature.onboarding.service.DemoAccountService;
import vacademy.io.community_service.feature.onboarding.service.OnboardingLinkService;
import vacademy.io.community_service.feature.onboarding.service.OnboardingSubmissionService;

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
    private DemoAccountService demoAccountService;

    /** Form config for a link: which questions to show, prefilled values, institute-type options. */
    @GetMapping("/link/{slug}")
    public ResponseEntity<PublicLinkConfigDto> getLink(@PathVariable String slug) {
        return ResponseEntity.ok(linkService.resolvePublicConfig(slug));
    }

    /** Submit a completed form → records it, emails the team, returns the demo handoff. */
    @PostMapping("/submit")
    public ResponseEntity<SubmitResponseDto> submit(@RequestBody SubmitRequestDto request) {
        return ResponseEntity.ok(submissionService.submit(request));
    }

    /** Direct-demo: hand straight to the chosen institute type's demo (no form). */
    @GetMapping("/demo/{instituteType}")
    public ResponseEntity<DemoHandoffDto> demo(@PathVariable String instituteType) {
        return ResponseEntity.ok(demoAccountService.buildHandoff(instituteType));
    }
}
