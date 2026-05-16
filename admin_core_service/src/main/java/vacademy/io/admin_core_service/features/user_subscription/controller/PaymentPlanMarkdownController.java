package vacademy.io.admin_core_service.features.user_subscription.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.user_subscription.dto.markdown.ApplyMarkdownRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.markdown.MarkdownLookupItemDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.markdown.MarkdownLookupRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.markdown.MarkdownResponseDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.markdown.ResetMarkdownRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentPlanMarkdownService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/payment-plan/markdown")
@RequiredArgsConstructor
public class PaymentPlanMarkdownController {

    private final PaymentPlanMarkdownService paymentPlanMarkdownService;

    @PostMapping("/apply")
    public ResponseEntity<MarkdownResponseDTO> applyMarkdown(
            @RequestBody ApplyMarkdownRequestDTO request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(paymentPlanMarkdownService.applyMarkdown(request, user));
    }

    @PostMapping("/reset")
    public ResponseEntity<MarkdownResponseDTO> resetMarkdown(
            @RequestBody ResetMarkdownRequestDTO request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(paymentPlanMarkdownService.resetMarkdown(request, user));
    }

    @PostMapping("/lookup")
    public ResponseEntity<List<MarkdownLookupItemDTO>> lookup(
            @RequestBody MarkdownLookupRequestDTO request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(paymentPlanMarkdownService.lookup(request, user));
    }
}
