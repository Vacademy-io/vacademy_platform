package vacademy.io.assessment_service.features.assessment.service;

import com.itextpdf.html2pdf.ConverterProperties;
import com.itextpdf.html2pdf.HtmlConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.StudentReportOverallDetailDto;
import vacademy.io.assessment_service.features.assessment.service.render.ReportRenderResources;
import vacademy.io.assessment_service.features.learner_assessment.dto.ReportClassContext;
import vacademy.io.assessment_service.features.learner_assessment.dto.StudentComparisonDto;

import java.io.ByteArrayOutputStream;

/**
 * HTML -> PDF for the standard branded student report. Nothing else: no I/O
 * beyond iText's own conversion, no transaction, no state mutation, no email.
 * Lifted out of AssessmentParticipantsManager's release loop (PR2) so the
 * release flow, the bulk report export worker (PR4), and any future caller
 * share one render path instead of duplicating it.
 *
 * The 4-arg overload consuming {@code ReportRenderResources} (shared
 * ConverterProperties/FontProvider, prebuilt CSS) is added in PR3; this 3-arg
 * overload keeps working unchanged by building a default resources value
 * internally at that point.
 */
@Service
public class ReportPdfRenderService {

    @Autowired
    private HtmlBuilderService htmlBuilderService;

    public byte[] render(StudentReportOverallDetailDto detail, StudentComparisonDto comparison, ReportClassContext ctx) {
        String html = htmlBuilderService.generateStudentReportHtml(
                ctx.getAssessmentName(), detail, comparison, ctx.getOptionDistribution(), ctx.getBranding());
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        HtmlConverter.convertToPdf(html, out, new ConverterProperties());
        return out.toByteArray();
    }

    /**
     * PR3 overload: renders using a per-job {@link ReportRenderResources}
     * (shared FontProvider, no remote font fetch — plan C7) instead of a
     * fresh default {@code ConverterProperties} per call. Used by the PR4
     * bulk-export worker; the 3-arg overload above is unchanged so existing
     * callers (release flow, per-student admin download) keep working as-is.
     */
    public byte[] render(StudentReportOverallDetailDto detail, StudentComparisonDto comparison,
                          ReportClassContext ctx, ReportRenderResources resources) {
        String html = htmlBuilderService.generateStudentReportHtml(
                ctx.getAssessmentName(), detail, comparison, ctx.getOptionDistribution(), ctx.getBranding());
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ConverterProperties props = resources != null ? resources.getConverterProperties() : new ConverterProperties();
        HtmlConverter.convertToPdf(html, out, props);
        return out.toByteArray();
    }
}
