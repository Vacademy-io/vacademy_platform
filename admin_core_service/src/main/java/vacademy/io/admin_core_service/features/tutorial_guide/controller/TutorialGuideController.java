package vacademy.io.admin_core_service.features.tutorial_guide.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.tutorial_guide.dto.TutorialGuidePdfRequest;
import vacademy.io.admin_core_service.features.tutorial_guide.service.TutorialGuidePdfService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Renders the learner-app how-to guide (client-composed, institute-branded
 * HTML) into a downloadable PDF. Called by both the admin dashboard
 * (Settings > Student Display > App Tutorials) and the learner app
 * (Help & tutorials sheet) — any authenticated user may render.
 */
@RestController
@RequestMapping("/admin-core-service/institute/v1/tutorial-guide")
@RequiredArgsConstructor
public class TutorialGuideController {

    private final TutorialGuidePdfService tutorialGuidePdfService;

    @PostMapping("/render-pdf")
    public ResponseEntity<byte[]> renderPdf(@RequestAttribute("user") CustomUserDetails userDetails,
                                            @Valid @RequestBody TutorialGuidePdfRequest request) {
        byte[] pdf = tutorialGuidePdfService.renderGuidePdf(request.getHtml());

        String fileName = request.getFileName() != null && !request.getFileName().isBlank()
                ? request.getFileName().replaceAll("[^A-Za-z0-9._-]", "_")
                : "learner-app-guide.pdf";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .body(pdf);
    }
}
