package vacademy.io.admin_core_service.features.invoice.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.invoice.dto.InvoiceNumberingDTOs;
import vacademy.io.admin_core_service.features.invoice.enums.InvoiceNumberToken;
import vacademy.io.admin_core_service.features.invoice.service.InvoiceNumberingSettingsService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Arrays;
import java.util.List;

/**
 * Backs Settings &gt; Invoice Settings &gt; Numbering.
 *
 * <p>The token catalogue is served from here rather than duplicated in the frontend so the
 * click-to-insert palette, the validator and the renderer cannot drift apart as tokens are
 * added.
 */
@RestController
@RequestMapping("/admin-core-service/v1/invoices/numbering")
public class InvoiceNumberingController {

    @Autowired
    private InvoiceNumberingSettingsService numberingSettingsService;

    @Autowired
    private InstituteAccessValidator instituteAccessValidator;

    /**
     * Validate a candidate format and render sample numbers. Does NOT consume a sequence
     * number, so an admin can experiment freely without creating gaps in a tax series.
     */
    @PostMapping("/preview")
    public ResponseEntity<InvoiceNumberingDTOs.PreviewResponse> preview(
            @RequestBody InvoiceNumberingDTOs.PreviewRequest request,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        instituteAccessValidator.validateUserAccess(userDetails, request.getInstituteId());
        return ResponseEntity.ok(numberingSettingsService.preview(request));
    }

    /** Everything the format builder can insert, grouped for the palette. */
    @GetMapping("/tokens")
    public ResponseEntity<List<InvoiceNumberingDTOs.TokenInfo>> tokens() {
        List<InvoiceNumberingDTOs.TokenInfo> tokens = Arrays.stream(InvoiceNumberToken.values())
                .map(t -> InvoiceNumberingDTOs.TokenInfo.builder()
                        .key(t.getKey())
                        .label(t.getLabel())
                        .group(t.getGroup().name())
                        .example(t.getExample())
                        .lazy(t.isLazy())
                        .riskyForTax(t.isRiskyForTax())
                        .build())
                .toList();
        return ResponseEntity.ok(tokens);
    }

    /** Current strategy + how much invoice history exists — populates the change warning. */
    @GetMapping("/state")
    public ResponseEntity<InvoiceNumberingDTOs.NumberingState> state(
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        instituteAccessValidator.validateUserAccess(userDetails, instituteId);
        return ResponseEntity.ok(numberingSettingsService.currentState(instituteId));
    }
}
