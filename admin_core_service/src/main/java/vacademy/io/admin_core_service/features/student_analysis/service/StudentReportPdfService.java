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
import vacademy.io.admin_core_service.features.student_analysis.entity.StudentAnalysisProcess;
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
        sb.append("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><style>\n")
          .append("@page{size:A4;margin:12mm}\n")
          .append("body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1f2937;margin:0;padding:0;background:#f4f6f9}\n")
          .append(".hdr{background:").append(accent).append(";color:#fff;border-radius:10px;padding:16px;margin-bottom:12px}\n")
          .append(".hdr h1{font-size:16px;margin:2px 0 0;color:#fff}\n")
          .append(".hdr .sub{font-size:10px;opacity:.85}\n")
          .append(".sbar{width:100%;border-top:1px solid rgba(255,255,255,.2);margin-top:10px;padding-top:8px}\n")
          .append(".sbar td{font-size:10px;padding-right:12px;vertical-align:top}\n")
          .append(".sbar td b{font-size:12px;display:block}\n")
          .append(".card{background:#fff;border:1px solid #e8eaed;border-radius:10px;padding:16px;margin-bottom:12px;page-break-inside:avoid}\n")
          .append("h2.sec{font-size:13px;margin:0 0 10px;color:").append(accent).append(";border-left:4px solid ").append(accent).append(";padding-left:8px}\n")
          .append(".muted{color:#6b7280;font-size:10px}\n")
          /* KPIs as 3-col table */
          .append(".kpis{width:100%;border-spacing:5px;border-collapse:separate;margin-bottom:12px}\n")
          .append(".kpi{background:#fff;border:1px solid #e8eaed;border-radius:8px;padding:8px;text-align:left}\n")
          .append(".kpi .lbl{font-size:10px;color:#6b7280}\n")
          .append(".kpi .val{font-size:16px;font-weight:700;margin:2px 0 1px}\n")
          .append(".kpi .chg{font-size:10px;font-weight:600}\n")
          .append(".up{color:#16a34a} .dn{color:#dc2626} .st{color:#6b7280}\n")
          /* summary callout */
          .append(".summ{background:#eff4ff;border:1px solid #dbe6ff;border-left:4px solid ").append(accent)
          .append(";border-radius:8px;padding:12px 14px;margin-bottom:12px;page-break-inside:avoid}\n")
          .append(".summ .sh{font-weight:700;margin-bottom:4px}\n")
          /* progress bar */
          .append(".bar{height:8px;background:#eef0f3;border-radius:999px;overflow:hidden}\n")
          .append(".bar i{display:block;height:100%;border-radius:999px;background:").append(accent).append("}\n")
          .append(".bar.g i{background:#16a34a} .bar.w i{background:#d97706} .bar.b i{background:#dc2626}\n")
          /* bar-row as table */
          .append(".brow{width:100%;border-spacing:0;border-collapse:collapse;margin:5px 0}\n")
          .append(".brow .bl{width:110px;font-size:11px;vertical-align:middle;padding-right:8px}\n")
          .append(".brow .bb{vertical-align:middle}\n")
          .append(".brow .bv{width:80px;font-size:10px;color:#6b7280;text-align:right;vertical-align:middle}\n")
          /* table */
          .append("table.dt{width:100%;border-collapse:collapse;font-size:11px}\n")
          .append("table.dt th,table.dt td{text-align:left;padding:6px 5px;border-bottom:1px solid #e8eaed}\n")
          .append("table.dt th{color:#6b7280;font-weight:600;font-size:10px;text-transform:uppercase}\n")
          .append("table.dt td.num{text-align:right}\n")
          .append(".pill{display:inline-block;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:600}\n")
          .append(".pg{background:#e9f7ef;color:#16a34a} .pw{background:#fdf3e6;color:#d97706} .pb{background:#fdeaea;color:#dc2626} .pn{background:#e8eaed;color:#4b5563}\n")
          /* chip row */
          .append(".chip{width:100%;border-spacing:0;border-collapse:collapse;margin:5px 0}\n")
          .append(".chip .ct{width:140px;font-size:11px;vertical-align:middle;padding-right:6px}\n")
          .append(".chip .cb{vertical-align:middle}\n")
          .append(".chip .cp{width:28px;text-align:right;font-weight:700;font-size:11px;vertical-align:middle}\n")
          /* two-up */
          .append(".twoup{width:100%;border-spacing:10px;border-collapse:separate;margin-bottom:12px;page-break-inside:avoid}\n")
          .append(".tuc{background:#fff;border:1px solid #e8eaed;border-radius:10px;padding:14px;vertical-align:top;width:50%}\n")
          /* stat row */
          .append(".sr{width:100%;border-collapse:collapse;margin:3px 0}\n")
          .append(".sr td{padding:4px 0;border-bottom:1px dashed #e8eaed;font-size:11px}\n")
          .append(".sr td.sv{text-align:right;font-weight:700}\n")
          /* recommendation */
          .append(".rec{width:100%;border-collapse:collapse;padding:7px 0;border-bottom:1px solid #e8eaed}\n")
          .append(".rec td{vertical-align:top;padding:4px 0}\n")
          .append(".pr{font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;white-space:nowrap}\n")
          .append(".rH{background:#fdeaea;color:#dc2626} .rM{background:#fdf3e6;color:#d97706} .rL{background:#eff4ff;color:").append(accent).append("}\n")
          .append(".foot{text-align:center;color:#6b7280;font-size:10px;padding:6px 0 14px}\n")
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
        sb.append("<div class='hdr'>");
        sb.append("<table style='width:100%;border-collapse:collapse'><tr>");
        // Logo (remote img is base64-embedded by processImagesForPdf) or an initials box fallback
        if (!logoUrl.isEmpty() || !initials.isEmpty()) {
            sb.append("<td style='vertical-align:top;width:56px'>");
            if (!logoUrl.isEmpty()) {
                sb.append("<img src='").append(escHtml(logoUrl)).append("' style='width:46px;height:46px;border-radius:8px'/>");
            } else {
                sb.append("<div style='width:46px;height:46px;border-radius:8px;background:rgba(255,255,255,.18);color:#fff;text-align:center;font-weight:700;font-size:15px;line-height:46px'>")
                  .append(escHtml(initials)).append("</div>");
            }
            sb.append("</td>");
        }
        sb.append("<td style='vertical-align:top'>");
        if (!instituteName.isEmpty()) sb.append("<div class='sub'>").append(escHtml(instituteName)).append("</div>");
        sb.append("<h1>Student Progress Report</h1>");
        if (!periodLabel.isEmpty()) sb.append("<div class='sub'>").append(escHtml(periodLabel)).append("</div>");
        if (!oneLine.isEmpty()) sb.append("<div class='sub' style='font-style:italic;margin-top:3px'>").append(escHtml(oneLine)).append("</div>");
        sb.append("</td>");
        if (!overallStatus.isEmpty() || !overallGrade.isEmpty()) {
            sb.append("<td style='text-align:right;vertical-align:top;white-space:nowrap'>");
            sb.append("<span style='background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.35);padding:4px 10px;border-radius:999px;font-weight:600;font-size:10px'>");
            if (!overallStatus.isEmpty()) sb.append(escHtml(overallStatus));
            if (!overallGrade.isEmpty()) sb.append(" &middot; ").append(escHtml(overallGrade));
            sb.append("</span></td>");
        }
        sb.append("</tr></table>");
        // Student identity bar
        sb.append("<table class='sbar'><tr>");
        sb.append("<td><span class='sub'>Student</span><b>").append(escHtml(studentName)).append("</b></td>");
        if (!classs.isEmpty() || !batch.isEmpty()) {
            String clsBatch = classs.isEmpty() ? batch : (batch.isEmpty() ? classs : classs + " / " + batch);
            sb.append("<td><span class='sub'>Class / Batch</span><b>").append(escHtml(clsBatch)).append("</b></td>");
        }
        if (!enrollmentNo.isEmpty()) sb.append("<td><span class='sub'>Enrollment No.</span><b>").append(escHtml(enrollmentNo)).append("</b></td>");
        if (!rollNo.isEmpty()) sb.append("<td><span class='sub'>Roll No.</span><b>").append(escHtml(rollNo)).append("</b></td>");
        sb.append("</tr></table></div>\n");

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

        // ── Parent summary ────────────────────────────────────────────────────────
        if (StringUtils.hasText(r.getParentSummary())) {
            sb.append("<div class='summ'><div class='sh'>Summary for Parents</div><div>")
              .append(escHtml(r.getParentSummary())).append("</div></div>\n");
        }

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
                if (lc.getAttended() != null) sb.append("<table class='sr'><tr><td>Attended</td><td class='sv' style='color:#16a34a'>").append(lc.getAttended()).append("</td></tr></table>");
                if (lc.getMissed() != null) sb.append("<table class='sr'><tr><td>Missed</td><td class='sv' style='color:#dc2626'>").append(lc.getMissed()).append("</td></tr></table>");
                if (lc.getAttendancePercentage() != null) sb.append("<table class='sr'><tr><td>Attendance</td><td class='sv'>").append(String.format("%.0f%%", lc.getAttendancePercentage())).append("</td></tr></table>");
                if (lc.getParticipation() != null) {
                    var pd = lc.getParticipation();
                    if (pd.getQuestionsAsked() != null) sb.append("<table class='sr'><tr><td>Questions asked</td><td class='sv'>").append(pd.getQuestionsAsked()).append("</td></tr></table>");
                    if (pd.getPollsAnswered() != null) sb.append("<table class='sr'><tr><td>Polls answered</td><td class='sv'>").append(pd.getPollsAnswered()).append("</td></tr></table>");
                    if (pd.getAvgEngagement() != null) sb.append("<table class='sr'><tr><td>Engagement</td><td class='sv' style='color:#16a34a'>").append(escHtml(pd.getAvgEngagement())).append("</td></tr></table>");
                }
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
