package vacademy.io.assessment_service.features.assessment.service.aireport;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itextpdf.html2pdf.ConverterProperties;
import com.itextpdf.html2pdf.HtmlConverter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.StudentReportOverallDetailDto;
import vacademy.io.assessment_service.features.client.AdminCoreServiceClient;
import vacademy.io.assessment_service.features.learner_assessment.dto.ReportBrandingDto;

import java.io.ByteArrayOutputStream;

/**
 * One student, one report: the AI report once admin_core has produced it, otherwise the
 * normal report. Every per-student PDF path (learner download, admin download, the AI PDF
 * endpoints) asks this service first; a null answer means "use the normal report".
 *
 * <p>The AI report carries everything the normal one does except the named leaderboard
 * (classmates appear only as counts), so swapping it in loses nothing a student needs.
 */
@Slf4j
@Service
public class AiReportPdfService {

    private final AiReportDataService dataService;
    private final AiReportHtmlBuilderV2 builder;
    private final AiReportFonts fonts;
    private final AdminCoreServiceClient adminCoreServiceClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${assessment.ai-report.v2.enabled:true}")
    private boolean enabled;

    public AiReportPdfService(AiReportDataService dataService, AiReportHtmlBuilderV2 builder, AiReportFonts fonts,
                              AdminCoreServiceClient adminCoreServiceClient) {
        this.dataService = dataService;
        this.builder = builder;
        this.fonts = fonts;
        this.adminCoreServiceClient = adminCoreServiceClient;
    }

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * The AI report PDF when one exists for (user, assessment), else null. Never throws:
     * any failure is logged and answered with null so the caller serves the normal report.
     */
    public byte[] renderIfAvailable(String userId, String assessmentId, String attemptId, String instituteId,
                                    StudentReportOverallDetailDto detail) {
        if (!enabled || userId == null || attemptId == null) return null;
        try {
            String processedJson = adminCoreServiceClient.getProcessedAIReport(userId, assessmentId);
            if (processedJson == null || processedJson.isBlank()) return null;
            return render(processedJson, userId, assessmentId, attemptId, instituteId, detail);
        } catch (Exception e) {
            log.error("[ai-report] could not render the AI report for attempt {}, using the normal report", attemptId, e);
            return null;
        }
    }

    /** Renders a known processed AI report. Throws on failure; callers decide the fallback. */
    public byte[] render(String processedJson, String userId, String assessmentId, String attemptId, String instituteId,
                         StudentReportOverallDetailDto detail) throws Exception {
        ReportBrandingDto branding = null;
        try {
            branding = adminCoreServiceClient.getReportBranding(instituteId);
        } catch (Exception e) {
            log.warn("[ai-report] branding unavailable for institute {}: {}", instituteId, e.getMessage());
        }
        if (branding == null) branding = ReportBrandingDto.builder().build();

        AiReportModel model = dataService.load(userId, assessmentId, attemptId, instituteId,
                objectMapper.readTree(processedJson), branding, detail);
        String html = builder.build(model);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ConverterProperties props = new ConverterProperties();
        props.setFontProvider(fonts.newProvider());
        HtmlConverter.convertToPdf(html, out, props);
        return out.toByteArray();
    }
}
