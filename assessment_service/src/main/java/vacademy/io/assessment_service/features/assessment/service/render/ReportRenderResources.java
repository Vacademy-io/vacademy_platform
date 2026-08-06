package vacademy.io.assessment_service.features.assessment.service.render;

import com.itextpdf.html2pdf.ConverterProperties;
import com.itextpdf.layout.font.FontProvider;
import lombok.Getter;
import vacademy.io.assessment_service.features.learner_assessment.dto.ReportClassContext;

/**
 * Per-job render inputs: a shared {@link ConverterProperties} (built once,
 * carrying the shared {@link FontProvider}) plus the invariant CSS block.
 * Addresses plan C7 — previously a fresh {@code ConverterProperties} (with no
 * FontProvider, forcing the remote @import) was constructed per conversion.
 *
 * <p>Prebuilt CSS is currently unused by {@link vacademy.io.assessment_service.features.assessment.service.HtmlBuilderService}
 * (which still builds its own inline CSS per the existing overloads); it is
 * exposed here for a future HtmlBuilderService overload that accepts prebuilt
 * CSS, parameterised only by branding colour, without expanding today's
 * change surface on the byte-diff-sensitive report HTML.
 */
@Getter
public class ReportRenderResources {

    private final ConverterProperties converterProperties;
    private final String cssBlock;

    private ReportRenderResources(ConverterProperties converterProperties, String cssBlock) {
        this.converterProperties = converterProperties;
        this.cssBlock = cssBlock;
    }

    public static ReportRenderResources forJob(ReportClassContext ctx, FontProvider sharedFontProvider) {
        ConverterProperties props = new ConverterProperties();
        if (sharedFontProvider != null) {
            props.setFontProvider(sharedFontProvider);
        }
        String primaryColor = ctx.getBranding() != null && ctx.getBranding().getPrimaryColor() != null
                ? ctx.getBranding().getPrimaryColor() : "#FF6B35";
        String secondaryColor = ctx.getBranding() != null && ctx.getBranding().getSecondaryColor() != null
                ? ctx.getBranding().getSecondaryColor() : "#6C5CE7";
        String css = "body { font-family: 'Inter', -apple-system, 'Segoe UI', Arial, Helvetica, sans-serif; }"
                + " .report-header { background-color: " + primaryColor + "; }"
                + " .bar-fill-primary { background-color: " + primaryColor + "; }"
                + " .bar-fill-secondary { background-color: " + secondaryColor + "; }";
        return new ReportRenderResources(props, css);
    }
}
