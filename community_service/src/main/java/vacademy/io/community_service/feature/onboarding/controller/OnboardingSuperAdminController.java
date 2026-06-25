package vacademy.io.community_service.feature.onboarding.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;
import vacademy.io.community_service.feature.onboarding.dto.*;
import vacademy.io.community_service.feature.onboarding.service.*;

import java.util.List;
import java.util.Map;

/** Super-admin console for the Onboarding/Demo tab. Every method requires a root user. */
@RestController
@RequestMapping("/community-service/super-admin/v1/onboarding")
public class OnboardingSuperAdminController {

    @Autowired
    private OnboardingLinkService linkService;
    @Autowired
    private OnboardingSubmissionService submissionService;
    @Autowired
    private DemoAccountService demoAccountService;
    @Autowired
    private OnboardingRecipientService recipientService;
    @Autowired
    private QuestionCatalog catalog;

    // ---- question catalogue (for the link builder) -------------------------------

    @GetMapping("/questions")
    public ResponseEntity<List<QuestionDto>> questions(@RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(catalog.all());
    }

    // ---- links -------------------------------------------------------------------

    @GetMapping("/links")
    public ResponseEntity<List<OnboardingLinkDto>> links(@RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(linkService.listAll());
    }

    @PostMapping("/links")
    public ResponseEntity<OnboardingLinkDto> createLink(@RequestAttribute("user") CustomUserDetails user,
                                                        @RequestBody UpsertLinkRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(linkService.create(request, user.getUserId()));
    }

    @PutMapping("/links/{id}")
    public ResponseEntity<OnboardingLinkDto> updateLink(@RequestAttribute("user") CustomUserDetails user,
                                                        @PathVariable String id,
                                                        @RequestBody UpsertLinkRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(linkService.update(id, request));
    }

    @DeleteMapping("/links/{id}")
    public ResponseEntity<Void> deleteLink(@RequestAttribute("user") CustomUserDetails user,
                                           @PathVariable String id) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        linkService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ---- submissions -------------------------------------------------------------

    @GetMapping("/submissions")
    public ResponseEntity<PageResponseDto<SubmissionDto>> submissions(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "instituteType", required = false) String instituteType,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(submissionService.search(status, instituteType, page, size));
    }

    @GetMapping("/submissions/counts")
    public ResponseEntity<Map<String, Long>> submissionCounts(@RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(submissionService.counts());
    }

    @GetMapping("/submissions/{id}")
    public ResponseEntity<SubmissionDto> submission(@RequestAttribute("user") CustomUserDetails user,
                                                    @PathVariable String id) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(submissionService.getById(id));
    }

    @PostMapping("/submissions/{id}/status")
    public ResponseEntity<SubmissionDto> updateSubmissionStatus(@RequestAttribute("user") CustomUserDetails user,
                                                                @PathVariable String id,
                                                                @RequestBody Map<String, String> body) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(submissionService.updateStatus(id, body.get("status")));
    }

    // ---- demo accounts -----------------------------------------------------------

    @GetMapping("/demo-accounts")
    public ResponseEntity<List<DemoAccountDto>> demoAccounts(@RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(demoAccountService.listForSuperAdmin());
    }

    @PutMapping("/demo-accounts/{id}")
    public ResponseEntity<DemoAccountDto> updateDemoAccount(@RequestAttribute("user") CustomUserDetails user,
                                                            @PathVariable String id,
                                                            @RequestBody UpdateDemoAccountRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(demoAccountService.update(id, request));
    }

    // ---- notification recipients -------------------------------------------------

    @GetMapping("/recipients")
    public ResponseEntity<List<RecipientDto>> recipients(@RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(recipientService.listAll());
    }

    @PostMapping("/recipients")
    public ResponseEntity<RecipientDto> createRecipient(@RequestAttribute("user") CustomUserDetails user,
                                                        @RequestBody UpsertRecipientRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(recipientService.create(request));
    }

    @PutMapping("/recipients/{id}")
    public ResponseEntity<RecipientDto> updateRecipient(@RequestAttribute("user") CustomUserDetails user,
                                                        @PathVariable String id,
                                                        @RequestBody UpsertRecipientRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(recipientService.update(id, request));
    }

    @DeleteMapping("/recipients/{id}")
    public ResponseEntity<Void> deleteRecipient(@RequestAttribute("user") CustomUserDetails user,
                                                @PathVariable String id) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        recipientService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
