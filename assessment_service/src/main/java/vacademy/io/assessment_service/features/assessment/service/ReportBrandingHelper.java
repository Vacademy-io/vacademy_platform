package vacademy.io.assessment_service.features.assessment.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.learner_assessment.dto.ReportBrandingDto;
import vacademy.io.common.media.service.FileService;

/**
 * Shared branding logic for both system report and AI report PDF generation.
 * Resolves logo URL, builds header/footer HTML with placeholders.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ReportBrandingHelper {

    private final FileService fileService;

    /**
     * Resolve logo file ID to a public URL.
     * Returns null if logo is unavailable or not configured.
     */
    public String resolveLogoUrl(ReportBrandingDto branding) {
        if (branding.getLogoFileId() == null || branding.getLogoFileId().isEmpty()) return null;
        try {
            return fileService.getPublicUrlForFileId(branding.getLogoFileId());
        } catch (Exception e) {
            log.warn("Failed to resolve logo URL for fileId {}: {}", branding.getLogoFileId(), e.getMessage());
            return null;
        }
    }

    /**
     * Build the report header HTML with logo, title, and branding.
     * Used by both system report and AI report.
     *
     * @param branding    Report branding settings
     * @param title       Assessment name
     * @param subtitle    e.g. "Student Performance Analysis"
     * @param bgColor     Header background color
     * @param logoUrl     Resolved logo URL (from resolveLogoUrl)
     */
    public String buildHeaderHtml(ReportBrandingDto branding, String title, String subtitle, String bgColor, String logoUrl) {
        StringBuilder html = new StringBuilder();
        html.append("<div style=\"background:").append(bgColor).append("; padding:24px 32px; color:white;\">");

        html.append("<table style=\"width:100%;\"><tr>");

        // Logo column
        if (logoUrl != null && Boolean.TRUE.equals(branding.getShowLogoInHeader())) {
            html.append("<td style=\"width:50px; vertical-align:middle; padding-right:12px;\">")
                    .append("<img src=\"").append(logoUrl).append("\" style=\"max-height:40px; max-width:40px;\" />")
                    .append("</td>");
        }

        // Content column
        html.append("<td style=\"vertical-align:middle;\">");
        String headerHtml = branding.getHeaderHtml();
        if (headerHtml != null && !headerHtml.isEmpty()) {
            String resolved = headerHtml.replace("{{assessment_name}}", escapeHtml(title));
            if (logoUrl != null) resolved = resolved.replace("{{logo_url}}", logoUrl);
            // Force text to light color for visibility on colored header
            resolved = resolved.replaceAll("color\\s*:\\s*#[0-9a-fA-F]{3,6}", "color:#E0E0E0");
            resolved = resolved.replaceAll("color\\s*:\\s*rgb[^)]*\\)", "color:#E0E0E0");
            html.append(resolved);
        } else {
            html.append("<div style=\"font-size:20px; font-weight:700; color:white;\">").append(escapeHtml(title)).append("</div>");
            html.append("<div style=\"font-size:13px; color:#E0E0E0; margin-top:4px;\">").append(escapeHtml(subtitle)).append("</div>");
        }
        html.append("</td></tr></table>");
        html.append("</div>");
        return html.toString();
    }

    /**
     * Build the report footer HTML with branding.
     */
    public String buildFooterHtml(ReportBrandingDto branding, String assessmentName) {
        String footerHtml = branding.getFooterHtml();
        if (footerHtml != null && !footerHtml.isEmpty()) {
            String resolved = footerHtml.replace("{{assessment_name}}", escapeHtml(assessmentName));
            return "<div style=\"background:#f8f9fc; padding:14px 28px; text-align:center; font-size:11px; color:#999;\">"
                    + resolved + "</div>";
        } else if (branding.getFooterText() != null && !branding.getFooterText().isEmpty()) {
            return "<div style=\"background:#f8f9fc; padding:14px 28px; text-align:center; font-size:11px; color:#999;\">"
                    + escapeHtml(branding.getFooterText()) + "</div>";
        }
        return "";
    }

    private static String escapeHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
