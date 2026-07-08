package vacademy.io.admin_core_service.features.student_analysis.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itextpdf.styledxmlparser.jsoup.Jsoup;
import com.itextpdf.styledxmlparser.jsoup.nodes.Document;
import com.itextpdf.styledxmlparser.jsoup.nodes.Entities;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.ComprehensiveStudentReport;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.LearningInsightsSection;
import vacademy.io.admin_core_service.features.student_analysis.entity.StudentAnalysisProcess;

import java.util.List;
import java.util.Locale;
import vacademy.io.admin_core_service.features.student_analysis.repository.StudentAnalysisProcessRepository;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.common.media.dto.InMemoryMultipartFile;

import java.io.ByteArrayOutputStream;

/**
 * Phase-4 delivery — PDF generation for the student analysis report.
 *
 * <p>Reuses the <b>invoice pattern</b> already established in
 * {@code InvoiceService}: HTML template → openhtmltopdf → bytes →
 * {@link MediaService#uploadFileV2} → persist {@code pdf_file_id}.
 *
 * <p>Skip-on-hit: if {@code process.pdfFileId} is already set and the
 * media_service can still resolve it, we return the cached bytes so the
 * caller can stream them without re-rendering.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StudentReportPdfService {

    private final StudentAnalysisProcessRepository processRepository;
    private final MediaService mediaService;
    private final ObjectMapper objectMapper;

    @Value("${media.server.baseurl:}")
    private String mediaServerBaseUrl;

    // -----------------------------------------------------------------------
    // Public entry point
    // -----------------------------------------------------------------------

    /**
     * Returns the PDF bytes for the given process.
     *
     * <ol>
     *   <li>If {@code pdf_file_id} is already set on the process row, try to
     *       download the bytes from media_service and return them (fast path).
     *   <li>Otherwise render the report to HTML, convert to PDF via openhtmltopdf,
     *       upload to media_service, persist the new {@code pdf_file_id}, and
     *       return the bytes.
     * </ol>
     *
     * @param process the loaded {@link StudentAnalysisProcess} row
     * @return raw PDF bytes
     * @throws IllegalStateException if the process is not yet COMPLETED
     */
    public byte[] getOrRenderPdf(StudentAnalysisProcess process) {
        if (!"COMPLETED".equals(process.getStatus())) {
            throw new IllegalStateException("Report not yet completed for process: " + process.getId());
        }

        // Fast path: already rendered
        if (StringUtils.hasText(process.getPdfFileId())) {
            byte[] cached = downloadPdfBytesFromMedia(process.getPdfFileId());
            if (cached != null && cached.length > 0) {
                log.debug("[PDF] Cache hit for processId={}", process.getId());
                return cached;
            }
            // Fall through: file expired / missing in S3 → re-render
            log.warn("[PDF] Cached pdf_file_id={} for processId={} could not be resolved; re-rendering",
                    process.getPdfFileId(), process.getId());
        }

        // Render
        byte[] pdfBytes = renderReportToPdf(process);

        // Persist to media_service
        try {
            String fileName = "student_report_" + process.getId() + ".pdf";
            InMemoryMultipartFile file = new InMemoryMultipartFile(fileName, fileName, "application/pdf", pdfBytes);
            FileDetailsDTO details = mediaService.uploadFileV2(file);
            if (details != null && StringUtils.hasText(details.getId())) {
                process.setPdfFileId(details.getId());
                processRepository.save(process);
                log.info("[PDF] Uploaded and persisted pdf_file_id={} for processId={}", details.getId(), process.getId());
            }
        } catch (Exception e) {
            // Upload failure is non-fatal: we still return the bytes to the caller
            log.warn("[PDF] Failed to upload PDF to media_service for processId={}: {}", process.getId(), e.getMessage());
        }

        return pdfBytes;
    }

    // -----------------------------------------------------------------------
    // HTML → bytes
    // -----------------------------------------------------------------------

    private byte[] renderReportToPdf(StudentAnalysisProcess process) {
        String html = buildReportHtml(process);
        return generatePdfFromHtml(html);
    }

    /**
     * Builds a clean HTML representation of the report.  For v2 rows we pull
     * the {@link ComprehensiveStudentReport} from {@code report_json}; for v1
     * rows we render a minimal summary from the raw JSON.
     */
    private String buildReportHtml(StudentAnalysisProcess process) {
        boolean isV2 = "v2".equalsIgnoreCase(process.getReportVersion());
        if (isV2 && StringUtils.hasText(process.getReportJson())) {
            try {
                ComprehensiveStudentReport report = objectMapper.readValue(
                        process.getReportJson(), ComprehensiveStudentReport.class);
                return buildV2Html(report, process);
            } catch (Exception e) {
                log.warn("[PDF] Failed to deserialize v2 report for processId={}: {}", process.getId(), e.getMessage());
            }
        }
        // v1 or fallback
        return buildV1Html(process);
    }

    // -----------------------------------------------------------------------
    // HTML builders
    // -----------------------------------------------------------------------

    String buildV2Html(ComprehensiveStudentReport r, StudentAnalysisProcess process) {
        // Resolve institute accent colour (falls back to Vacademy blue)
        String accent = (r.getInstitute() != null && r.getInstitute().getThemeColor() != null)
                ? r.getInstitute().getThemeColor() : "#2563eb";

        StringBuilder sb = new StringBuilder();

        // ── CSS ──────────────────────────────────────────────────────────────────
        // Palette mirrors the web report ("paper document"): warm ground, ink-navy, serif headings.
        String serif = "Georgia,'Times New Roman',serif";
        sb.append("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><style>\n")
          .append("@page{size:A4;margin:12mm}\n")
          .append("body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1C2433;margin:0;padding:0;background:#FBFAF7}\n")
          /* masthead (matches the prototype's white header, not a colored band) */
          .append(".masthead{width:100%;border-collapse:collapse;border-bottom:1px solid #E7E3D9;margin-bottom:16px}\n")
          .append(".masthead td{vertical-align:middle;padding-bottom:12px}\n")
          .append(".brand-mark{width:38px;height:38px;border-radius:9px;background:").append(accent)
          .append(";color:#fff;font-family:").append(serif).append(";font-weight:700;font-size:18px;text-align:center;line-height:38px}\n")
          .append(".brand-name{font-weight:600;font-size:13px;color:#1C2433}\n")
          .append(".brand-sub{font-size:10.5px;color:#7C879B}\n")
          .append(".period-pill{font-size:10.5px;color:#4A5568;background:#F4F2EC;border:1px solid #E7E3D9;padding:5px 12px;border-radius:999px;white-space:nowrap}\n")
          /* verdict card (white, with a status-colored left stripe set inline) */
          .append(".verdict{background:#fff;border:1px solid #E7E3D9;border-radius:12px;padding:20px 22px;margin-bottom:16px;page-break-inside:avoid}\n")
          .append(".student-name{font-family:").append(serif).append(";font-size:26px;line-height:1.12;margin:0 0 4px;color:#1C2433}\n")
          .append(".student-meta{color:#7C879B;font-size:11.5px}\n")
          .append(".status-badge{display:inline-block;padding:6px 13px;border-radius:999px;font-weight:600;font-size:12px}\n")
          .append(".grade-chip{font-family:").append(serif).append(";font-size:14px;font-weight:700;width:30px;height:30px;border-radius:8px;text-align:center;line-height:30px;display:inline-block;margin-left:7px}\n")
          .append(".oneliner{font-size:14px;color:#1C2433;margin:14px 0 0}\n")
          .append(".parent-summary{margin:12px 0 0;padding:12px 14px;background:#F4F2EC;border-radius:9px;font-size:12px;color:#4A5568}\n")
          .append(".card{background:#FFFFFF;border:1px solid #E7E3D9;border-radius:12px;padding:16px 18px;margin-bottom:12px;page-break-inside:avoid}\n")
          .append("h2.sec{font-family:").append(serif).append(";font-size:15px;margin:0 0 10px;color:#1C2433;border-left:4px solid ").append(accent).append(";padding-left:9px}\n")
          .append(".muted{color:#7C879B;font-size:10px}\n")
          /* KPIs as 3-col table */
          .append(".kpis{width:100%;border-spacing:6px;border-collapse:separate;margin-bottom:12px}\n")
          .append(".kpi{background:#fff;border:1px solid #E7E3D9;border-radius:10px;padding:9px 10px;text-align:left}\n")
          .append(".kpi .lbl{font-size:9px;color:#7C879B;text-transform:uppercase;letter-spacing:.04em}\n")
          .append(".kpi .val{font-size:18px;font-weight:700;margin:3px 0 1px;color:#1C2433}\n")
          .append(".kpi .chg{font-size:10px;font-weight:600}\n")
          .append(".up{color:#3F8F5B} .dn{color:#B4483D} .st{color:#7C879B}\n")
          /* summary callout */
          .append(".summ{background:#F4F2EC;border:1px solid #E7E3D9;border-left:4px solid ").append(accent)
          .append(";border-radius:10px;padding:13px 15px;margin-bottom:12px;page-break-inside:avoid}\n")
          .append(".summ .sh{font-family:").append(serif).append(";font-weight:700;margin-bottom:4px}\n")
          /* progress bar */
          .append(".bar{height:9px;background:#F4F2EC;border-radius:999px;overflow:hidden}\n")
          .append(".bar i{display:block;height:100%;border-radius:999px;background:").append(accent).append("}\n")
          .append(".bar.g i{background:#3F8F5B} .bar.w i{background:#C6803A} .bar.b i{background:#B4483D}\n")
          /* bar-row as table */
          .append(".brow{width:100%;border-spacing:0;border-collapse:collapse;margin:5px 0}\n")
          .append(".brow .bl{width:120px;font-size:11px;vertical-align:middle;padding-right:8px}\n")
          .append(".brow .bb{vertical-align:middle}\n")
          .append(".brow .bv{width:96px;font-size:10px;color:#7C879B;text-align:right;vertical-align:middle}\n")
          /* table */
          .append("table.dt{width:100%;border-collapse:collapse;font-size:11px}\n")
          .append("table.dt th,table.dt td{text-align:left;padding:6px 5px;border-bottom:1px solid #E7E3D9}\n")
          .append("table.dt th{color:#7C879B;font-weight:600;font-size:10px;text-transform:uppercase}\n")
          .append("table.dt td.num{text-align:right}\n")
          .append(".pill{display:inline-block;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600}\n")
          .append(".pg{background:#E6F2EA;color:#3F8F5B} .pw{background:#F7ECDD;color:#C6803A} .pb{background:#F6E4E1;color:#B4483D} .pn{background:#F4F2EC;color:#4A5568}\n")
          /* chip row */
          .append(".chip{width:100%;border-spacing:0;border-collapse:collapse;margin:5px 0}\n")
          .append(".chip .ct{width:150px;font-size:11px;vertical-align:middle;padding-right:6px}\n")
          .append(".chip .cb{vertical-align:middle}\n")
          .append(".chip .cp{width:28px;text-align:right;font-weight:700;font-size:11px;vertical-align:middle}\n")
          /* two-up */
          .append(".twoup{width:100%;border-spacing:12px;border-collapse:separate;margin-bottom:12px;page-break-inside:avoid}\n")
          .append(".tuc{background:#fff;border:1px solid #E7E3D9;border-radius:12px;padding:14px 16px;vertical-align:top;width:50%}\n")
          .append(".tuc h2.sec{border-left:none;padding-left:0}\n")
          /* stat row */
          .append(".sr{width:100%;border-collapse:collapse;margin:3px 0}\n")
          .append(".sr td{padding:4px 0;border-bottom:1px dashed #E7E3D9;font-size:11px}\n")
          .append(".sr td.sv{text-align:right;font-weight:700}\n")
          /* recommendation */
          .append(".rec{width:100%;border-collapse:collapse;padding:7px 0;border-bottom:1px solid #E7E3D9}\n")
          .append(".rec td{vertical-align:top;padding:4px 0}\n")
          .append(".pr{font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;white-space:nowrap}\n")
          .append(".rH{background:#F6E4E1;color:#B4483D} .rM{background:#F7ECDD;color:#C6803A} .rL{background:#F4F2EC;color:").append(accent).append("}\n")
          /* learning insights: thinking-skills two-up, topic mastery, misconceptions */
          .append(".ti-card{background:#fff;border:1px solid #E7E3D9;border-radius:12px;padding:14px 16px;vertical-align:top;width:50%;text-align:center}\n")
          .append(".ti-t{font-weight:600;font-size:12px;text-align:left}\n")
          .append(".conf td{font-size:11px;padding:3px 0;text-align:left}\n")
          .append(".conf .cn{text-align:right;font-weight:700;font-family:monospace}\n")
          .append(".sw{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px}\n")
          .append(".fix{border-bottom:1px solid #E7E3D9;padding:10px 0}\n")
          .append(".fix .n{font-family:").append(serif).append(";font-weight:700;color:#C6803A;background:#F7ECDD;border-radius:7px;width:24px;height:24px;text-align:center;line-height:24px;font-size:12px}\n")
          .append(".fix .ft{font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#7C879B}\n")
          .append(".fix .fm{font-weight:600;margin:2px 0 3px}\n")
          .append(".fix .fr{color:#4A5568;font-size:11px}\n")
          /* narrative */
          .append(".nar h3{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:").append(accent).append(";margin:14px 0 5px}\n")
          .append(".nar p{font-size:11px;color:#4A5568;margin:0 0 7px}\n")
          .append(".nar ul{margin:0 0 8px;padding-left:16px}\n")
          .append(".nar li{font-size:11px;color:#4A5568;margin-bottom:3px}\n")
          .append(".nar table{width:100%;border-collapse:collapse;margin:4px 0 10px;font-size:10.5px}\n")
          .append(".nar th,.nar td{text-align:left;padding:5px 7px;border-bottom:1px solid #E7E3D9}\n")
          .append(".foot{text-align:center;color:#7C879B;font-size:10px;padding:6px 0 14px}\n")
          .append("</style></head><body>\n");

        // ── Header ───────────────────────────────────────────────────────────────
        String studentName    = r.getStudent()   != null ? nvl(r.getStudent().getName(), "—") : "—";
        String instituteName  = r.getInstitute() != null ? nvl(r.getInstitute().getName(), "")  : "";
        String batch          = r.getStudent()   != null ? nvl(r.getStudent().getBatch(), "")    : "";
        String classs         = r.getStudent()   != null ? nvl(r.getStudent().getClasss(), "")   : "";
        String enrollmentNo   = r.getStudent()   != null ? nvl(r.getStudent().getEnrollmentNo(), "") : "";
        String rollNo         = r.getStudent()   != null ? nvl(r.getStudent().getRollNo(), "")   : "";
        String periodLabel    = "";
        if (r.getPeriod() != null) {
            periodLabel = StringUtils.hasText(r.getPeriod().getLabel())
                    ? r.getPeriod().getLabel()
                    : nvl(r.getPeriod().getStartDate(), "") + " to " + nvl(r.getPeriod().getEndDate(), "");
        }
        String overallStatus  = r.getOverview() != null ? nvl(r.getOverview().getOverallStatus(), "") : "";
        String overallGrade   = r.getOverview() != null ? nvl(r.getOverview().getOverallGrade(), "")  : "";
        String oneLine        = r.getOverview() != null ? nvl(r.getOverview().getOneLine(), "")       : "";

        String logoUrl = r.getInstitute() != null ? nvl(r.getInstitute().getLogoUrl(), "") : "";
        String initials = computeInitials(instituteName);

        // Status → colour pair (mirrors the FE verdict card: On Track=green, Needs Attention=amber, At Risk=red)
        String sColor = "#4A5568", sSoft = "#F4F2EC"; // neutral (Unknown)
        String stLower = overallStatus.toLowerCase();
        if (stLower.contains("risk")) { sColor = "#B4483D"; sSoft = "#F6E4E1"; }
        else if (stLower.contains("attention") || stLower.contains("watch") || stLower.contains("improve")) { sColor = "#C6803A"; sSoft = "#F7ECDD"; }
        else if (stLower.contains("track") || stLower.contains("good") || stLower.contains("excellent") || stLower.contains("strong")) { sColor = "#3F8F5B"; sSoft = "#E6F2EA"; }

        // ── Masthead (white header: brand mark + institute + period pill) ──────────
        sb.append("<table class='masthead'><tr>");
        sb.append("<td style='width:46px'>");
        if (!logoUrl.isEmpty()) {
            sb.append("<div class='brand-mark' style='padding:0;overflow:hidden'>")
              .append("<img src='").append(escHtml(logoUrl)).append("' style='width:38px;height:38px;border-radius:9px'/></div>");
        } else {
            sb.append("<div class='brand-mark'>").append(escHtml(initials.isEmpty() ? "V" : initials.substring(0, 1))).append("</div>");
        }
        sb.append("</td>");
        sb.append("<td>");
        if (!instituteName.isEmpty()) sb.append("<div class='brand-name'>").append(escHtml(instituteName)).append("</div>");
        String clsBatchSub = classs.isEmpty() ? batch : (batch.isEmpty() ? classs : classs + " · " + batch);
        String brandSub = (clsBatchSub.isEmpty() ? "" : clsBatchSub + " · ") + "Progress Report";
        sb.append("<div class='brand-sub'>").append(escHtml(brandSub)).append("</div>");
        sb.append("</td>");
        sb.append("<td style='text-align:right'>");
        if (!periodLabel.isEmpty()) sb.append("<span class='period-pill'>").append(escHtml(periodLabel)).append("</span>");
        sb.append("</td>");
        sb.append("</tr></table>\n");

        // ── Verdict card (student name + status/grade + one-liner + parent summary) ─
        sb.append("<div class='verdict' style='border-left:5px solid ").append(sColor).append("'>");
        sb.append("<table style='width:100%;border-collapse:collapse'><tr>");
        sb.append("<td style='vertical-align:top'>");
        sb.append("<div class='student-name'>").append(escHtml(studentName)).append("</div>");
        StringBuilder meta = new StringBuilder();
        if (!rollNo.isEmpty()) meta.append("Roll ").append(escHtml(rollNo));
        if (!enrollmentNo.isEmpty()) { if (meta.length() > 0) meta.append(" · "); meta.append("Enrollment ").append(escHtml(enrollmentNo)); }
        if (meta.length() > 0) sb.append("<div class='student-meta'>").append(meta).append("</div>");
        sb.append("</td>");
        if (!overallStatus.isEmpty() || !overallGrade.isEmpty()) {
            sb.append("<td style='text-align:right;vertical-align:top;white-space:nowrap'>");
            if (!overallStatus.isEmpty()) {
                sb.append("<span class='status-badge' style='background:").append(sSoft).append(";color:").append(sColor).append("'>")
                  .append(escHtml(overallStatus)).append("</span>");
            }
            if (!overallGrade.isEmpty()) {
                sb.append("<span class='grade-chip' style='background:").append(sSoft).append(";color:").append(sColor).append("'>")
                  .append(escHtml(overallGrade)).append("</span>");
            }
            sb.append("</td>");
        }
        sb.append("</tr></table>");
        if (!oneLine.isEmpty()) sb.append("<div class='oneliner'>").append(escHtml(oneLine)).append("</div>");
        if (StringUtils.hasText(r.getParentSummary())) {
            sb.append("<div class='parent-summary'>").append(escHtml(r.getParentSummary())).append("</div>");
        }
        sb.append("</div>\n");

        // ── KPI tiles ─────────────────────────────────────────────────────────────
        if (r.getOverview() != null && r.getOverview().getHeadlineMetrics() != null
                && !r.getOverview().getHeadlineMetrics().isEmpty()) {
            var metrics = r.getOverview().getHeadlineMetrics();
            int cols = 3; // chunk into rows of 3 so 6 tiles wrap (2 rows) instead of cramming one row
            sb.append("<table class='kpis'>");
            for (int i = 0; i < metrics.size(); i++) {
                if (i % cols == 0) sb.append("<tr>");
                var m = metrics.get(i);
                String trend = nvl(m.getTrend(), "steady");
                String trendCls = "up".equals(trend) ? "up" : ("down".equals(trend) || "dn".equals(trend)) ? "dn" : "st";
                String arrow = "up".equals(trend) ? "&#9650; " : ("down".equals(trend) ? "&#9660; " : "");
                String valStr = m.getValue() != null ? m.getValue().toString() : "—";
                String unit = nvl(m.getUnit(), "");
                if (!unit.isEmpty() && !valStr.endsWith(unit)) valStr = valStr + unit;
                sb.append("<td class='kpi' style='width:33%'>");
                sb.append("<div class='lbl'>").append(escHtml(nvl(m.getLabel(), ""))).append("</div>");
                sb.append("<div class='val'>").append(escHtml(valStr)).append("</div>");
                if (m.getChange() != null) {
                    sb.append("<div class='chg ").append(trendCls).append("'>").append(arrow)
                      .append(escHtml(m.getChange())).append("</div>");
                }
                sb.append("</td>");
                boolean rowEnd = (i % cols == cols - 1) || (i == metrics.size() - 1);
                if (rowEnd) {
                    // pad the final short row so tile widths stay uniform
                    int filled = (i % cols) + 1;
                    for (int p = filled; p < cols; p++) sb.append("<td style='width:33%'></td>");
                    sb.append("</tr>");
                }
            }
            sb.append("</table>\n");
        }

        // (Parent summary now lives inside the verdict card, matching the FE prototype.)

        // ── Attendance ────────────────────────────────────────────────────────────
        if (r.getAttendance() != null && r.getAttendance().isAvailable()) {
            var att = r.getAttendance();
            sb.append("<div class='card'><h2 class='sec'>Attendance</h2>");
            double pct = att.getOverallPercentage() != null ? att.getOverallPercentage() : 0;
            String attBar = pct >= 80 ? "g" : pct >= 60 ? "w" : "b";
            sb.append("<table class='brow'><tr>");
            sb.append("<td class='bl'>Overall</td>");
            sb.append("<td class='bb'><div class='bar ").append(attBar).append("'><i style='width:")
              .append((int)Math.min(pct, 100)).append("%'></i></div></td>");
            sb.append("<td class='bv'>").append(String.format("%.0f%%", pct));
            if (att.getPresent() != null && att.getTotalSessions() != null)
                sb.append(" (").append(att.getPresent()).append("/").append(att.getTotalSessions()).append(")");
            sb.append("</td></tr></table>");
            // Present / Absent / Late mini stats
            sb.append("<table style='width:100%;border-collapse:collapse;margin-top:8px;text-align:center'><tr>");
            if (att.getPresent() != null)
                sb.append("<td><b style='color:#16a34a'>").append(att.getPresent()).append("</b><br/><span class='muted'>Present</span></td>");
            if (att.getAbsent() != null)
                sb.append("<td><b style='color:#dc2626'>").append(att.getAbsent()).append("</b><br/><span class='muted'>Absent</span></td>");
            if (att.getLate() != null && att.getLate() > 0)
                sb.append("<td><b style='color:#d97706'>").append(att.getLate()).append("</b><br/><span class='muted'>Late</span></td>");
            if (att.getTrend() != null || att.getChangeVsPrevious() != null) {
                sb.append("<td style='font-size:10px'>");
                if (att.getTrend() != null) sb.append(escHtml(att.getTrend().toUpperCase())).append(" ");
                if (att.getChangeVsPrevious() != null) sb.append(escHtml(att.getChangeVsPrevious()));
                sb.append("</td>");
            }
            sb.append("</tr></table>");
            // Weekly trend bars
            if (att.getWeekly() != null && !att.getWeekly().isEmpty()) {
                sb.append("<p class='muted' style='margin:10px 0 4px'>Weekly trend</p>");
                att.getWeekly().forEach(w -> {
                    double wp = w.getPercentage() != null ? w.getPercentage() : 0;
                    String wBar = wp >= 80 ? "g" : wp >= 60 ? "w" : "b";
                    sb.append("<table class='brow'><tr>");
                    sb.append("<td class='bl' style='font-size:10px'>").append(escHtml(nvl(w.getWeek(), ""))).append("</td>");
                    sb.append("<td class='bb'><div class='bar ").append(wBar).append("'><i style='width:").append((int)Math.min(wp,100)).append("%'></i></div></td>");
                    sb.append("<td class='bv'>").append(String.format("%.0f%%", wp)).append("</td></tr></table>");
                });
            }
            if (att.getNote() != null)
                sb.append("<p class='muted' style='margin-top:6px'>").append(escHtml(att.getNote())).append("</p>");
            sb.append("</div>\n");
        }

        // ── Academic Performance ──────────────────────────────────────────────────
        if (r.getAcademics() != null && r.getAcademics().isAvailable()) {
            var ac = r.getAcademics();
            sb.append("<div class='card'><h2 class='sec'>Academic Performance</h2>");
            if (ac.getAveragePercentage() != null) {
                sb.append("<p class='muted' style='margin-top:-4px'>Average <b style='color:#1f2937'>")
                  .append(String.format("%.0f%%", ac.getAveragePercentage())).append("</b>");
                if (ac.getClassAveragePercentage() != null)
                    sb.append(" vs class avg ").append(String.format("%.0f%%", ac.getClassAveragePercentage()));
                if (ac.getBestSubject() != null) sb.append(" &middot; Best: ").append(escHtml(ac.getBestSubject()));
                if (ac.getWeakestSubject() != null) sb.append(" &middot; Needs work: ").append(escHtml(ac.getWeakestSubject()));
                sb.append("</p>");
            }
            if (ac.getAssessments() != null && !ac.getAssessments().isEmpty()) {
                sb.append("<table class='dt'><thead><tr><th>Assessment</th><th>Subject</th><th class='num'>Score</th><th class='num'>Rank</th><th>Grade</th></tr></thead><tbody>");
                ac.getAssessments().forEach(a -> {
                    String grade = nvl(a.getGrade(), nvl(a.getStatus(), "—"));
                    String gradePillCls = "A+".equals(a.getGrade()) || "A".equals(a.getGrade()) || "B+".equals(a.getGrade()) || "B".equals(a.getGrade()) ? "pg"
                            : "D".equals(a.getGrade()) || "FAIL".equals(a.getStatus()) ? "pb"
                            : "NEEDS_WORK".equals(a.getStatus()) ? "pw" : "pn";
                    if ("NEEDS_WORK".equals(grade)) grade = "Needs work";
                    sb.append("<tr><td>").append(escHtml(nvl(a.getName(), "—")));
                    if (a.getDate() != null) sb.append("<br/><span class='muted'>").append(escHtml(a.getDate())).append("</span>");
                    sb.append("</td><td>").append(escHtml(nvl(a.getSubject(), ""))).append("</td>");
                    sb.append("<td class='num'>");
                    if (a.getMarks() != null && a.getTotalMarks() != null) {
                        sb.append(String.format("%.0f/%.0f", a.getMarks(), a.getTotalMarks()));
                        if (a.getPercentage() != null) sb.append(" &middot; ").append(String.format("%.0f%%", a.getPercentage()));
                    } else sb.append("—");
                    sb.append("</td>");
                    sb.append("<td class='num'>").append(a.getRank() != null ? a.getRank() : "—").append("</td>");
                    sb.append("<td><span class='pill ").append(gradePillCls).append("'>").append(escHtml(grade)).append("</span></td></tr>");
                });
                sb.append("</tbody></table>");
            }
            if (ac.getSubjectPerformance() != null && !ac.getSubjectPerformance().isEmpty()) {
                sb.append("<p class='muted' style='margin:12px 0 4px'>Subject performance vs class</p>");
                ac.getSubjectPerformance().forEach(sp -> {
                    double spPct = sp.getScorePercentage() != null ? sp.getScorePercentage() : 0;
                    String spBar = "good".equals(sp.getSentiment()) ? "g" : "attention".equals(sp.getSentiment()) ? "b" : "";
                    sb.append("<table class='brow'><tr>");
                    sb.append("<td class='bl'>").append(escHtml(nvl(sp.getSubject(), ""))).append("</td>");
                    sb.append("<td class='bb'><div class='bar ").append(spBar).append("'><i style='width:").append((int)Math.min(spPct,100)).append("%'></i></div></td>");
                    sb.append("<td class='bv'>").append(String.format("%.0f%%", spPct));
                    if (sp.getClassAverage() != null) sb.append(" &middot; cls ").append(String.format("%.0f%%", sp.getClassAverage()));
                    sb.append("</td></tr></table>");
                });
            }
            sb.append("</div>\n");
        }

        // ── Learning Insights (thinking skills / topic mastery / misconceptions) ───
        if (r.getLearningInsights() != null && r.getLearningInsights().isAvailable()) {
            var li = r.getLearningInsights();
            boolean hasBlooms = li.getBlooms() != null && !li.getBlooms().isEmpty();
            var conf = li.getConfidence();
            if (hasBlooms || conf != null) {
                sb.append("<table class='twoup'><tr>");
                if (hasBlooms) {
                    sb.append("<td class='ti-card'><div class='ti-t'>Thinking-skill profile</div>")
                      .append("<div class='muted' style='text-align:left'>Accuracy across cognitive levels</div>")
                      .append(svgBloomRadar(li.getBlooms(), accent))
                      .append("</td>");
                }
                if (conf != null) {
                    int knows = conf.getKnows() != null ? conf.getKnows() : 0;
                    int guesses = conf.getGuesses() != null ? conf.getGuesses() : 0;
                    int wrong = conf.getHighConfidenceWrong() != null ? conf.getHighConfidenceWrong() : 0;
                    String centre = conf.getOverall() != null ? String.format("%.0f%%", conf.getOverall()) : "—";
                    sb.append("<td class='ti-card'><div class='ti-t'>Knows vs. guesses</div>")
                      .append("<div class='muted' style='text-align:left'>Confidence calibration</div>")
                      .append("<table style='width:100%;border-collapse:collapse'><tr>")
                      .append("<td style='width:120px'>").append(svgDonut(knows, guesses, wrong, centre, "#3F8F5B", "#C6803A", "#B4483D")).append("</td>")
                      .append("<td class='conf'><table style='width:100%'>")
                      .append("<tr><td><span class='sw' style='background:#3F8F5B'></span>Confidently right</td><td class='cn'>").append(knows).append("</td></tr>")
                      .append("<tr><td><span class='sw' style='background:#C6803A'></span>Right but unsure</td><td class='cn'>").append(guesses).append("</td></tr>")
                      .append("<tr><td><span class='sw' style='background:#B4483D'></span>Confidently wrong</td><td class='cn'>").append(wrong).append("</td></tr>")
                      .append("</table></td></tr></table></td>");
                }
                sb.append("</tr></table>\n");
            }
            // Topic mastery bars
            if (li.getTopicMastery() != null && !li.getTopicMastery().isEmpty()) {
                sb.append("<div class='card'><h2 class='sec'>Topic Mastery</h2>");
                li.getTopicMastery().forEach(t -> {
                    double acc = t.getAccuracy() != null ? t.getAccuracy() : 0;
                    String bc = acc >= 75 ? "g" : acc >= 50 ? "" : acc >= 35 ? "w" : "b";
                    sb.append("<table class='brow'><tr>");
                    sb.append("<td class='bl'>").append(escHtml(nvl(t.getTopic(), "")));
                    if (t.getMasteryLevel() != null) sb.append("<br/><span class='muted'>").append(escHtml(t.getMasteryLevel())).append("</span>");
                    sb.append("</td>");
                    sb.append("<td class='bb'><div class='bar ").append(bc).append("'><i style='width:").append((int)Math.min(acc,100)).append("%'></i></div></td>");
                    sb.append("<td class='bv'>").append(String.format("%.0f%%", acc)).append("</td></tr></table>");
                });
                sb.append("</div>\n");
            }
            // Misconceptions ("what to work on next")
            if (li.getMisconceptions() != null && !li.getMisconceptions().isEmpty()) {
                sb.append("<div class='card'><h2 class='sec'>What to Work On Next</h2>");
                int[] idx = {0};
                li.getMisconceptions().forEach(m -> {
                    if (m.getMisconception() == null || m.getMisconception().isBlank()) return;
                    idx[0]++;
                    sb.append("<table class='fix'><tr>");
                    sb.append("<td style='width:34px;vertical-align:top'><div class='n'>").append(idx[0]).append("</div></td>");
                    sb.append("<td style='vertical-align:top'>");
                    if (m.getTopic() != null) sb.append("<div class='ft'>").append(escHtml(m.getTopic())).append("</div>");
                    sb.append("<div class='fm'>").append(escHtml(m.getMisconception())).append("</div>");
                    if (m.getRemediation() != null) sb.append("<div class='fr'>&#8594; ").append(escHtml(m.getRemediation())).append("</div>");
                    sb.append("</td></tr></table>");
                });
                sb.append("</div>\n");
            }
        }

        // ── Strengths & Areas to Improve ──────────────────────────────────────────
        boolean hasStrengths = r.getStrengths() != null && !r.getStrengths().isEmpty();
        boolean hasAreas     = r.getAreasToImprove() != null && !r.getAreasToImprove().isEmpty();
        if (hasStrengths || hasAreas) {
            sb.append("<table class='twoup'><tr>");
            if (hasStrengths) {
                sb.append("<td class='tuc'><h2 class='sec'>Strengths</h2>");
                r.getStrengths().forEach(tc -> {
                    int conf = tc.getConfidence() != null ? tc.getConfidence() : 0;
                    sb.append("<table class='chip'><tr>");
                    sb.append("<td class='ct'>").append(escHtml(nvl(tc.getTopic(), ""))).append("</td>");
                    sb.append("<td class='cb'><div class='bar g'><i style='width:").append(Math.min(conf,100)).append("%'></i></div></td>");
                    sb.append("<td class='cp'>").append(conf).append("</td></tr></table>");
                });
                sb.append("</td>");
            }
            if (hasAreas) {
                sb.append("<td class='tuc'><h2 class='sec'>Areas to Improve</h2>");
                r.getAreasToImprove().forEach(tc -> {
                    int conf = tc.getConfidence() != null ? tc.getConfidence() : 0;
                    String barCls = conf < 50 ? "b" : "w";
                    sb.append("<table class='chip'><tr>");
                    sb.append("<td class='ct'>").append(escHtml(nvl(tc.getTopic(), ""))).append("</td>");
                    sb.append("<td class='cb'><div class='bar ").append(barCls).append("'><i style='width:").append(Math.min(conf,100)).append("%'></i></div></td>");
                    sb.append("<td class='cp'>").append(conf).append("</td></tr></table>");
                });
                sb.append("</td>");
            }
            sb.append("</tr></table>\n");
        }

        // ── Study Habits ──────────────────────────────────────────────────────────
        if (r.getStudyHabits() != null && r.getStudyHabits().isAvailable()) {
            var sh = r.getStudyHabits();
            sb.append("<div class='card'><h2 class='sec'>Study Habits &amp; Daily Engagement</h2>");
            // Mini KPI grid (4 columns)
            sb.append("<table class='kpis'><tr>");
            if (sh.getActiveDays() != null) {
                sb.append("<td class='kpi'><div class='lbl'>Active days</div><div class='val'>").append(sh.getActiveDays());
                if (sh.getTotalDays() != null) sb.append("<span style='font-size:10px;color:#6b7280'>/").append(sh.getTotalDays()).append("</span>");
                sb.append("</div></td>");
            }
            if (sh.getLongestStreakDays() != null)
                sb.append("<td class='kpi'><div class='lbl'>Longest streak</div><div class='val'>").append(sh.getLongestStreakDays()).append("<span style='font-size:10px;color:#6b7280'> days</span></div></td>");
            if (sh.getFocusScore() != null)
                sb.append("<td class='kpi'><div class='lbl'>Focus score</div><div class='val'>").append(String.format("%.0f", sh.getFocusScore())).append("</div></td>");
            if (sh.getMostActiveTime() != null)
                sb.append("<td class='kpi'><div class='lbl'>Most active</div><div class='val' style='font-size:13px'>").append(escHtml(sh.getMostActiveTime())).append("</div></td>");
            sb.append("</tr></table>");
            // Daily bar chart — render as inline bar segments scaled to max
            if (sh.getDailyStudyMinutes() != null && !sh.getDailyStudyMinutes().isEmpty()) {
                double maxM = sh.getDailyStudyMinutes().stream()
                        .mapToDouble(d -> d.getMinutes() != null ? d.getMinutes() : 0).max().orElse(1);
                if (maxM < 1) maxM = 1;
                sb.append("<p class='muted' style='margin:10px 0 3px'>Daily study time (minutes)</p>");
                // Fixed px heights (openhtmltopdf renders % heights inside table cells unreliably)
                sb.append("<table style='width:100%;border-collapse:collapse;height:64px;border-bottom:1px solid #e8eaed'><tr style='vertical-align:bottom'>");
                double finalMax = maxM;
                sh.getDailyStudyMinutes().forEach(d -> {
                    double mins = d.getMinutes() != null ? d.getMinutes() : 0;
                    int hpx = (int) Math.max(mins / finalMax * 60, mins > 0 ? 2 : 0);
                    sb.append("<td style='vertical-align:bottom;padding:0 1px'>");
                    if (hpx > 0)
                        sb.append("<div style='width:100%;height:").append(hpx).append("px;background:").append(accent).append(";border-radius:2px 2px 0 0'></div>");
                    sb.append("</td>");
                });
                sb.append("</tr></table>");
                // x-axis labels
                String first = sh.getDailyStudyMinutes().get(0).getDate();
                String last  = sh.getDailyStudyMinutes().get(sh.getDailyStudyMinutes().size()-1).getDate();
                sb.append("<table style='width:100%;border-collapse:collapse'><tr>");
                sb.append("<td style='font-size:9px;color:#6b7280'>").append(escHtml(nvl(first,""))).append("</td>");
                sb.append("<td style='font-size:9px;color:#6b7280;text-align:right'>").append(escHtml(nvl(last,""))).append("</td>");
                sb.append("</tr></table>");
            }
            // Content engagement line
            if (sh.getContentEngagement() != null) {
                var ce = sh.getContentEngagement();
                sb.append("<p class='muted' style='margin-top:10px'>Content: ");
                if (ce.getVideosWatched() != null) sb.append("<b style='color:#1f2937'>").append(ce.getVideosWatched()).append("</b> videos &middot; ");
                if (ce.getDocumentsRead() != null) sb.append("<b style='color:#1f2937'>").append(ce.getDocumentsRead()).append("</b> docs &middot; ");
                if (ce.getQuizzesAttempted() != null) sb.append("<b style='color:#1f2937'>").append(ce.getQuizzesAttempted()).append("</b> quizzes");
                sb.append("</p>");
            }
            // Summary stat rows
            if (sh.getTotalStudyHours() != null)
                sb.append("<table class='sr'><tr><td>Total study</td><td class='sv'>").append(String.format("%.1f hrs", sh.getTotalStudyHours())).append("</td></tr></table>");
            if (sh.getAvgMinutesPerDay() != null)
                sb.append("<table class='sr'><tr><td>Avg per day</td><td class='sv'>").append(sh.getAvgMinutesPerDay()).append(" min</td></tr></table>");
            if (sh.getConsistencyRating() != null)
                sb.append("<table class='sr'><tr><td>Consistency</td><td class='sv'>").append(escHtml(sh.getConsistencyRating())).append("</td></tr></table>");
            sb.append("</div>\n");
        }

        // ── Course Progress ───────────────────────────────────────────────────────
        if (r.getCourseProgress() != null && r.getCourseProgress().isAvailable()) {
            var cp = r.getCourseProgress();
            String cpPct = cp.getOverallCompletionPercentage() != null
                    ? String.format("%.0f%%", cp.getOverallCompletionPercentage()) : "";
            sb.append("<div class='card'><h2 class='sec'>Course Progress")
              .append(cpPct.isEmpty() ? "" : " — " + cpPct + " complete").append("</h2>");
            if (cp.getSubjects() != null) {
                cp.getSubjects().forEach(s -> {
                    double p = s.getCompletionPercentage() != null ? s.getCompletionPercentage() : 0;
                    String barCls = p >= 70 ? "g" : p >= 50 ? "" : "w";
                    sb.append("<table class='brow'><tr>");
                    sb.append("<td class='bl'>").append(escHtml(nvl(s.getSubject(), ""))).append("</td>");
                    sb.append("<td class='bb'><div class='bar ").append(barCls).append("'><i style='width:").append((int)Math.min(p,100)).append("%'></i></div></td>");
                    sb.append("<td class='bv'>").append(String.format("%.0f%%", p));
                    if (s.getTimeHours() != null) sb.append(" &middot; ").append(String.format("%.1fh", s.getTimeHours()));
                    sb.append("</td></tr></table>");
                });
            }
            sb.append("</div>\n");
        }

        // ── Live Classes + Assignments (two-up) ───────────────────────────────────
        boolean hasLive   = r.getLiveClasses()  != null && r.getLiveClasses().isAvailable();
        boolean hasAssign = r.getAssignments()  != null && r.getAssignments().isAvailable();
        if (hasLive || hasAssign) {
            sb.append("<table class='twoup'><tr>");
            if (hasLive) {
                var lc = r.getLiveClasses();
                sb.append("<td class='tuc'><h2 class='sec'>Live Classes</h2>");
                if (lc.getTotal() != null) sb.append("<table class='sr'><tr><td>Total classes</td><td class='sv'>").append(lc.getTotal()).append("</td></tr></table>");
                if (lc.getAttended() != null) sb.append("<table class='sr'><tr><td>Attended</td><td class='sv' style='color:#16a34a'>").append(lc.getAttended()).append("</td></tr></table>");
                if (lc.getMissed() != null) sb.append("<table class='sr'><tr><td>Missed</td><td class='sv' style='color:#dc2626'>").append(lc.getMissed()).append("</td></tr></table>");
                if (lc.getUnmarked() != null && lc.getUnmarked() > 0) sb.append("<table class='sr'><tr><td>Not marked</td><td class='sv' style='color:#6b7280'>").append(lc.getUnmarked()).append("</td></tr></table>");
                if (lc.getAttendancePercentage() != null) sb.append("<table class='sr'><tr><td>Attendance</td><td class='sv'>").append(String.format("%.0f%%", lc.getAttendancePercentage())).append("</td></tr></table>");
                sb.append("</td>");
            }
            if (hasAssign) {
                var as = r.getAssignments();
                sb.append("<td class='tuc'><h2 class='sec'>Assignments</h2>");
                if (as.getAssigned() != null) sb.append("<table class='sr'><tr><td>Assigned</td><td class='sv'>").append(as.getAssigned()).append("</td></tr></table>");
                if (as.getSubmitted() != null) sb.append("<table class='sr'><tr><td>Submitted</td><td class='sv' style='color:#16a34a'>").append(as.getSubmitted()).append("</td></tr></table>");
                if (as.getOnTime() != null) sb.append("<table class='sr'><tr><td>On time</td><td class='sv'>").append(as.getOnTime()).append("</td></tr></table>");
                if (as.getLate() != null) sb.append("<table class='sr'><tr><td>Late</td><td class='sv' style='color:#d97706'>").append(as.getLate()).append("</td></tr></table>");
                if (as.getPending() != null) sb.append("<table class='sr'><tr><td>Pending</td><td class='sv' style='color:#dc2626'>").append(as.getPending()).append("</td></tr></table>");
                if (as.getAvgScorePercentage() != null) sb.append("<table class='sr'><tr><td>Avg. score</td><td class='sv'>").append(String.format("%.0f%%", as.getAvgScorePercentage())).append("</td></tr></table>");
                sb.append("</td>");
            }
            sb.append("</tr></table>\n");
        }

        // ── Achievements ──────────────────────────────────────────────────────────
        if (r.getAchievements() != null && !r.getAchievements().isEmpty()) {
            sb.append("<div class='card'><h2 class='sec'>Achievements</h2><div>");
            r.getAchievements().forEach(a -> {
                String label = nvl(a.getTitle(), "");
                if (a.getIssuedAt() != null && !a.getIssuedAt().isEmpty()) label += " (" + a.getIssuedAt() + ")";
                sb.append("<span class='pill pg' style='padding:5px 10px;font-size:10px;display:inline-block;margin:0 6px 6px 0'>").append(escHtml(label)).append("</span>");
            });
            sb.append("</div></div>\n");
        }

        // ── Doubts & Engagement ───────────────────────────────────────────────────
        if (r.getDoubtsAndEngagement() != null && r.getDoubtsAndEngagement().isAvailable()) {
            var de = r.getDoubtsAndEngagement();
            sb.append("<div class='card'><h2 class='sec'>Doubts &amp; Engagement</h2>");
            if (de.getQuestionsAsked() != null) sb.append("<table class='sr'><tr><td>Questions asked</td><td class='sv'>").append(de.getQuestionsAsked()).append("</td></tr></table>");
            if (de.getResolved() != null) sb.append("<table class='sr'><tr><td>Resolved</td><td class='sv'>").append(de.getResolved()).append("</td></tr></table>");
            if (de.getAvgResolutionHours() != null) sb.append("<table class='sr'><tr><td>Avg. resolution</td><td class='sv'>").append(String.format("%.0f hrs", de.getAvgResolutionHours())).append("</td></tr></table>");
            if (de.getNote() != null) sb.append("<p class='muted' style='margin-top:6px'>").append(escHtml(de.getNote())).append("</p>");
            sb.append("</div>\n");
        }

        // ── AI Insights: cross-domain observations ─────────────────────────────────
        if (r.getAiInsights() != null) {
            var ins = r.getAiInsights();
            if (ins.getCrossDomainInsights() != null && !ins.getCrossDomainInsights().isEmpty()) {
                sb.append("<div class='card'><h2 class='sec'>What we noticed</h2><ul style='margin:0;padding-left:14px'>");
                ins.getCrossDomainInsights().forEach(o -> sb.append("<li style='margin:5px 0;font-size:11px'>").append(escHtml(o)).append("</li>"));
                sb.append("</ul></div>\n");
            }
            // Recommendations
            if (ins.getRecommendations() != null && !ins.getRecommendations().isEmpty()) {
                sb.append("<div class='card'><h2 class='sec'>Recommended next steps</h2>");
                ins.getRecommendations().forEach(rec -> {
                    String pr = nvl(rec.getPriority(), "MEDIUM");
                    String prCls = "HIGH".equals(pr) ? "rH" : "LOW".equals(pr) ? "rL" : "rM";
                    sb.append("<table class='rec'><tr>");
                    sb.append("<td style='padding-right:10px;white-space:nowrap;vertical-align:top'><span class='pr ").append(prCls).append("'>").append(escHtml(pr)).append("</span></td>");
                    sb.append("<td style='vertical-align:top'>");
                    if (rec.getArea() != null) sb.append("<div style='font-weight:600;font-size:11px'>").append(escHtml(rec.getArea())).append("</div>");
                    if (rec.getSuggestion() != null) sb.append("<div class='muted'>").append(escHtml(rec.getSuggestion())).append("</div>");
                    sb.append("</td></tr></table>");
                });
                sb.append("</div>\n");
            }
            // AI summary (inside its own card, after recommendations)
            if (StringUtils.hasText(ins.getSummary())) {
                sb.append("<div class='card'><h2 class='sec'>AI Insights</h2>");
                sb.append("<div style='background:#f3e5f5;border-left:4px solid #7b1fa2;padding:10px 12px;font-size:11px'>")
                  .append(escHtml(ins.getSummary())).append("</div></div>\n");
            }
        }

        // ── Detailed analysis (v1-style narrative) ─────────────────────────────────
        if (r.getNarrative() != null) {
            var nar = r.getNarrative();
            StringBuilder body = new StringBuilder();
            appendNarrative(body, "Learning frequency", nar.getLearningFrequency());
            appendNarrative(body, "Progress", nar.getProgress());
            appendNarrative(body, "Effort vs. output", nar.getStudentEfforts());
            appendNarrative(body, "Topics improving", nar.getTopicsOfImprovement());
            appendNarrative(body, "Topics needing attention", nar.getTopicsOfDegradation());
            appendNarrative(body, "Action checklist", nar.getRemedialPoints());
            if (body.length() > 0) {
                sb.append("<div class='card nar'><h2 class='sec'>Detailed analysis</h2>").append(body).append("</div>\n");
            }
        }

        // ── Footer ────────────────────────────────────────────────────────────────
        sb.append("<div class='foot'>");
        sb.append("Generated by ").append(escHtml(!instituteName.isEmpty() ? instituteName : "Vacademy"));
        if (!periodLabel.isEmpty()) sb.append(" &middot; ").append(escHtml(periodLabel));
        sb.append("</div></body></html>");
        return sb.toString();
    }

    private String buildV1Html(StudentAnalysisProcess process) {
        return "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/>"
                + "<style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px;}</style></head><body>"
                + "<h1>Student Analysis Report</h1>"
                + "<p><strong>Process ID:</strong> " + escHtml(process.getId()) + "</p>"
                + "<p><strong>User:</strong> " + escHtml(process.getUserId()) + "</p>"
                + "<p><strong>Status:</strong> " + escHtml(process.getStatus()) + "</p>"
                + "<p><strong>Period:</strong> " + process.getStartDateIso() + " to " + process.getEndDateIso() + "</p>"
                + "<p style='color:#666;font-size:10px;'>Legacy v1 report — detailed breakdown available in the admin dashboard.</p>"
                + "</body></html>";
    }

    // -----------------------------------------------------------------------
    // Chart + narrative helpers (static SVG — openhtmltopdf runs no JS)
    // -----------------------------------------------------------------------

    private static final String[] BLOOM_ORDER = {"remember", "understand", "apply", "analyze", "evaluate", "create"};

    /** Bloom's radar as static inline SVG (no viewBox — survives the jsoup XHTML sanitiser). */
    private String svgBloomRadar(List<LearningInsightsSection.BloomLevel> blooms, String accent) {
        java.util.Map<String, Double> acc = new java.util.HashMap<>();
        for (var b : blooms) {
            if (b.getLevel() != null) acc.put(b.getLevel().toLowerCase(), b.getAccuracy() != null ? b.getAccuracy() : 0.0);
        }
        double cx = 115, cy = 92, R = 52;
        int n = BLOOM_ORDER.length;
        StringBuilder s = new StringBuilder("<svg xmlns='http://www.w3.org/2000/svg' width='230' height='184'>");
        for (double f : new double[]{0.25, 0.5, 0.75, 1.0}) {
            s.append("<polygon points='").append(ringPoints(cx, cy, R * f, n)).append("' fill='none' stroke='#E7E3D9' stroke-width='1'/>");
        }
        for (int i = 0; i < n; i++) {
            double[] p = radialPt(cx, cy, R, i, n);
            s.append("<line x1='").append(fmt(cx)).append("' y1='").append(fmt(cy))
             .append("' x2='").append(fmt(p[0])).append("' y2='").append(fmt(p[1])).append("' stroke='#E7E3D9' stroke-width='1'/>");
            double[] lp = radialPt(cx, cy, R + 15, i, n);
            String anchor = Math.abs(lp[0] - cx) < 6 ? "middle" : (lp[0] > cx ? "start" : "end");
            s.append("<text x='").append(fmt(lp[0])).append("' y='").append(fmt(lp[1] + 3))
             .append("' text-anchor='").append(anchor).append("' font-size='9' fill='#7C879B'>").append(capitalize(BLOOM_ORDER[i])).append("</text>");
        }
        StringBuilder pts = new StringBuilder();
        for (int i = 0; i < n; i++) {
            double v = acc.getOrDefault(BLOOM_ORDER[i], 0.0);
            double[] p = radialPt(cx, cy, R * v / 100.0, i, n);
            pts.append(fmt(p[0])).append(",").append(fmt(p[1])).append(" ");
        }
        s.append("<polygon points='").append(pts.toString().trim()).append("' fill='").append(accent)
         .append("' fill-opacity='0.18' stroke='").append(accent).append("' stroke-width='2'/></svg>");
        return s.toString();
    }

    /** Three-segment confidence donut as static inline SVG. */
    private String svgDonut(int a, int b, int c, String centre, String ca, String cb, String cc) {
        double r = 40, circ = 2 * Math.PI * r;
        int total = a + b + c;
        if (total <= 0) total = 1;
        int[] vals = {a, b, c};
        String[] cols = {ca, cb, cc};
        StringBuilder s = new StringBuilder("<svg xmlns='http://www.w3.org/2000/svg' width='110' height='110'>");
        s.append("<circle cx='55' cy='55' r='40' fill='none' stroke='#F4F2EC' stroke-width='13'/>");
        double off = 0;
        for (int i = 0; i < 3; i++) {
            double len = circ * vals[i] / total;
            s.append("<circle cx='55' cy='55' r='40' fill='none' stroke='").append(cols[i])
             .append("' stroke-width='13' stroke-dasharray='").append(fmt(len)).append(" ").append(fmt(circ - len))
             .append("' stroke-dashoffset='").append(fmt(-off)).append("' transform='rotate(-90 55 55)'/>");
            off += len;
        }
        s.append("<text x='55' y='53' text-anchor='middle' font-size='17' font-weight='700' fill='#1C2433'>").append(escHtml(centre)).append("</text>");
        s.append("<text x='55' y='68' text-anchor='middle' font-size='8' fill='#7C879B'>confidence</text></svg>");
        return s.toString();
    }

    private double[] radialPt(double cx, double cy, double r, int i, int n) {
        double ang = (2 * Math.PI * i / n) - (Math.PI / 2);
        return new double[]{cx + r * Math.cos(ang), cy + r * Math.sin(ang)};
    }

    private String ringPoints(double cx, double cy, double r, int n) {
        StringBuilder p = new StringBuilder();
        for (int i = 0; i < n; i++) {
            double[] q = radialPt(cx, cy, r, i, n);
            p.append(fmt(q[0])).append(",").append(fmt(q[1])).append(" ");
        }
        return p.toString().trim();
    }

    private String fmt(double d) {
        return String.format(Locale.US, "%.1f", d);
    }

    private String capitalize(String s) {
        return (s == null || s.isEmpty()) ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    /** Appends a titled narrative block, rendering the field's Markdown to lightweight HTML. */
    private void appendNarrative(StringBuilder sb, String title, String md) {
        if (md == null || md.isBlank()) return;
        sb.append("<h3>").append(escHtml(title)).append("</h3>").append(mdToHtml(md));
    }

    /**
     * Minimal Markdown → HTML for the narrative (openhtmltopdf runs no JS, so no client renderer).
     * Handles headings, bullet/checkbox lists, tables, and **bold**. Input is HTML-escaped first,
     * so the only tags in the output are the ones this method emits.
     */
    private String mdToHtml(String md) {
        String[] lines = escHtml(md).replace("\r", "").split("\n");
        StringBuilder out = new StringBuilder();
        boolean inUl = false, inTable = false;
        for (String raw : lines) {
            String line = raw.trim();
            if (line.isEmpty()) {
                if (inUl) { out.append("</ul>"); inUl = false; }
                continue;
            }
            if (line.startsWith("|")) {
                String stripped = line.replace("|", " ").replace("-", " ").replace(":", " ").trim();
                if (stripped.isEmpty()) continue; // separator row
                if (inUl) { out.append("</ul>"); inUl = false; }
                if (!inTable) { out.append("<table>"); inTable = true; }
                String inner = line.substring(1, line.endsWith("|") ? line.length() - 1 : line.length());
                out.append("<tr>");
                for (String cell : inner.split("\\|")) out.append("<td>").append(applyBold(cell.trim())).append("</td>");
                out.append("</tr>");
                continue;
            } else if (inTable) { out.append("</table>"); inTable = false; }
            if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("- [")) {
                if (!inUl) { out.append("<ul>"); inUl = true; }
                String item = line.replaceFirst("^[-*]\\s+", "").replaceFirst("^\\[[ xX]\\]\\s*", "");
                out.append("<li>").append(applyBold(item)).append("</li>");
                continue;
            } else if (inUl) { out.append("</ul>"); inUl = false; }
            if (line.startsWith("#")) {
                out.append("<p><strong>").append(applyBold(line.replaceFirst("^#+\\s*", ""))).append("</strong></p>");
                continue;
            }
            out.append("<p>").append(applyBold(line)).append("</p>");
        }
        if (inUl) out.append("</ul>");
        if (inTable) out.append("</table>");
        return out.toString();
    }

    private String applyBold(String s) {
        return s.replaceAll("\\*\\*(.+?)\\*\\*", "<strong>$1</strong>");
    }

    // -----------------------------------------------------------------------
    // Core HTML→PDF (mirrors InvoiceService.generatePdfFromHtml exactly)
    // -----------------------------------------------------------------------

    /**
     * Converts an HTML string to PDF bytes using openhtmltopdf (PdfRendererBuilder).
     * This reuses the same dependency and approach as {@code InvoiceService}
     * (the invoice PDF generation) — no new libraries added.
     */
    byte[] generatePdfFromHtml(String htmlContent) {
        try {
            boolean isCompleteHtml = htmlContent.trim().toLowerCase().startsWith("<!doctype")
                    || htmlContent.trim().toLowerCase().startsWith("<html");
            String htmlWithCss = isCompleteHtml ? htmlContent
                    : "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/></head><body>" + htmlContent + "</body></html>";

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            // Enable inline-SVG rendering (Bloom's radar + donut charts in the v2 report).
            builder.useSVGDrawer(new com.openhtmltopdf.svgsupport.BatikSVGDrawer());

            String processedHtml = processImagesForPdf(htmlWithCss);
            String sanitized = sanitizeToXhtml(processedHtml);
            String xhtml = escapeBareAmpersands(sanitized);

            builder.withHtmlContent(xhtml, "file:///");
            builder.useDefaultPageSize(210f, 297f, PdfRendererBuilder.PageSizeUnits.MM);
            builder.toStream(outputStream);
            builder.run();

            return outputStream.toByteArray();
        } catch (Exception e) {
            log.error("[PDF] Error generating PDF from HTML", e);
            throw new RuntimeException("Failed to generate student report PDF: " + e.getMessage(), e);
        }
    }

    // -----------------------------------------------------------------------
    // HTML sanitization helpers (same pattern as InvoiceService)
    // -----------------------------------------------------------------------

    private String sanitizeToXhtml(String html) {
        Document doc = Jsoup.parse(html);
        doc.outputSettings().syntax(Document.OutputSettings.Syntax.xml);
        doc.outputSettings().escapeMode(Entities.EscapeMode.xhtml);
        return doc.html();
    }

    private String processImagesForPdf(String html) {
        try {
            Document doc = Jsoup.parse(html);
            doc.select("img[src]").forEach(img -> {
                String src = img.attr("src");
                if (src != null && src.startsWith("http")) {
                    String base64 = convertUrlToBase64(src);
                    if (base64 != null) {
                        img.attr("src", base64);
                    }
                }
            });
            return doc.html();
        } catch (Exception e) {
            log.warn("[PDF] Error processing images, using original HTML: {}", e.getMessage());
            return html;
        }
    }

    private String convertUrlToBase64(String imageUrl) {
        try {
            java.net.URL url = new java.net.URL(imageUrl);
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(10000);
            if (conn.getResponseCode() == 200) {
                try (java.io.InputStream is = conn.getInputStream();
                     ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[4096];
                    int n;
                    while ((n = is.read(buf)) != -1) baos.write(buf, 0, n);
                    String ct = conn.getContentType() != null ? conn.getContentType() : "image/png";
                    return "data:" + ct + ";base64," + java.util.Base64.getEncoder().encodeToString(baos.toByteArray());
                }
            }
        } catch (Exception e) {
            log.warn("[PDF] Could not embed image {}: {}", imageUrl, e.getMessage());
        }
        return null;
    }

    private static String escapeBareAmpersands(String xhtml) {
        if (xhtml == null) return null;
        return xhtml.replaceAll("&(?![A-Za-z][A-Za-z0-9]*;|#[0-9]+;|#x[0-9A-Fa-f]+;)", "&amp;");
    }

    // -----------------------------------------------------------------------
    // Media download helper
    // -----------------------------------------------------------------------

    private byte[] downloadPdfBytesFromMedia(String fileId) {
        try {
            String url = mediaService.getFilePublicUrlById(fileId);
            if (!StringUtils.hasText(url)) return null;
            java.net.URL u = new java.net.URL(url);
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) u.openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(30000);
            if (conn.getResponseCode() == 200) {
                try (java.io.InputStream is = conn.getInputStream();
                     ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = is.read(buf)) != -1) baos.write(buf, 0, n);
                    return baos.toByteArray();
                }
            }
        } catch (Exception e) {
            log.warn("[PDF] Could not download cached PDF for fileId={}: {}", fileId, e.getMessage());
        }
        return null;
    }

    // -----------------------------------------------------------------------
    // Utility
    // -----------------------------------------------------------------------

    private static String computeInitials(String name) {
        if (name == null || name.isBlank()) return "";
        StringBuilder ini = new StringBuilder();
        for (String p : name.trim().split("\\s+")) {
            if (!p.isEmpty()) ini.append(Character.toUpperCase(p.charAt(0)));
            if (ini.length() >= 3) break;
        }
        return ini.toString();
    }

    private static String nvl(Object v, String def) {
        return v == null ? def : v.toString();
    }

    private static String nvl(Object v) {
        return nvl(v, "");
    }

    private static String escHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
