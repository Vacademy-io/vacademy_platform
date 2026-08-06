package vacademy.io.assessment_service.features.assessment.service.export;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.dto.export.zip.ReportZipAssembleResponse;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentReportExportItem;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentReportExportJob;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentReportExportItemRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentReportExportJobRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.assessment.service.ReportPdfUploadService;
import vacademy.io.common.core.utils.DateUtil;
import vacademy.io.common.exceptions.VacademyException;

import java.io.BufferedOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TimeZone;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Phase B (idempotent). Reads durable state (item.file_id) and produces a ZIP
 * — never renders. Called at the end of a worker run and, separately, by the
 * {@code /assemble} endpoint for a lazy partial download (plan §6.4).
 * See ARCHITECTURE.md §8.4.
 */
@Slf4j
@Service
public class ReportZipAssemblyService {

    @Autowired
    private AssessmentReportExportItemRepository itemRepository;

    @Autowired
    private AssessmentReportExportJobRepository jobRepository;

    @Autowired
    private AssessmentRepository assessmentRepository;

    @Autowired
    private StudentAttemptRepository studentAttemptRepository;

    @Autowired
    private vacademy.io.assessment_service.features.assessment.repository.SectionRepository sectionRepository;

    @Autowired
    private ReportPdfUploadService uploadService;

    public ReportZipAssembleResponse assemble(String jobId) {
        AssessmentReportExportJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            throw new VacademyException("Export job not found: " + jobId);
        }

        List<AssessmentReportExportItem> done = itemRepository
                .findByJobIdAndStatusAndFileIdIsNotNullOrderByCreatedAt(jobId, "DONE");
        if (done.isEmpty()) {
            throw new VacademyException("Nothing to assemble for job " + jobId);
        }
        Path tmp;
        try {
            tmp = Files.createTempFile("report-export-" + jobId + "-", ".zip");
        } catch (Exception e) {
            throw new VacademyException("Could not create temp file for ZIP assembly: " + e.getMessage());
        }

        String assessmentName = assessmentRepository.findById(job.getAssessmentId())
                .map(a -> a.getName()).orElse("assessment");

        // Marks / rank / percentile for the manifests: one assessment-wide
        // leaderboard query keyed by attempt id, plus the section-sum for total
        // marks — the same sources the report PDFs themselves use. Best-effort:
        // a failure here degrades the manifests to blanks, never the ZIP.
        Map<String, vacademy.io.assessment_service.features.assessment.dto.LeaderBoardDto> statsByAttempt = new HashMap<>();
        Double totalMarks = null;
        try {
            studentAttemptRepository
                    .findLeaderBoardForAssessmentAndInstituteId(job.getAssessmentId(), job.getInstituteId(),
                            List.of("ACTIVE"))
                    .forEach(lb -> {
                        if (lb.getAttemptId() != null)
                            statsByAttempt.putIfAbsent(lb.getAttemptId(), lb);
                    });
            double sum = sectionRepository
                    .findByAssessmentIdAndStatusNotIn(job.getAssessmentId(), List.of("DELETED")).stream()
                    .mapToDouble(s -> s.getTotalMarks() != null ? s.getTotalMarks() : 0.0)
                    .sum();
            if (sum > 0)
                totalMarks = sum;
        } catch (Exception e) {
            log.warn("[report-export] could not load marks/rank for manifests of job {}: {}", jobId, e.getMessage());
        }

        int staleCount = 0;
        try {
            try (ZipOutputStream zos = new ZipOutputStream(new BufferedOutputStream(Files.newOutputStream(tmp)))) {
                Set<String> used = new HashSet<>();
                for (AssessmentReportExportItem item : done) {
                    String entry = uniquify(
                            sanitize(nameOrFallback(item)) + "_" + shortId(item.getAttemptId()) + ".pdf", used);
                    item.setZipEntryName(entry);
                    zos.putNextEntry(new ZipEntry(entry));
                    try (InputStream in = uploadService.openReadStream(item.getFileId())) {
                        in.transferTo(zos);
                    }
                    zos.closeEntry();

                    if (isStale(item)) {
                        staleCount++;
                    }
                }
                itemRepository.saveAll(done);
                if (staleCount > 0) {
                    log.warn(
                            "[report-export] {} of {} items in job {} are stale (attempt updated after report was generated)",
                            staleCount, done.size(), jobId);
                }

                // Loaded AFTER the entry names above are saved. This list is a
                // separate set of entity instances from `done` (different
                // query, no shared persistence context here) — loading it
                // earlier meant the manifests saw every zip_entry_name as
                // null and rendered dashes instead of links.
                List<AssessmentReportExportItem> allItems = new ArrayList<>(
                        itemRepository.findByJobIdOrderByCreatedAt(jobId));
                // Rank order, 1st first — students without a rank (skipped /
                // unevaluated) sink to the bottom, tie-broken by name.
                allItems.sort(java.util.Comparator
                        .comparing((AssessmentReportExportItem i) -> {
                            var stats = statsByAttempt.get(i.getAttemptId());
                            return stats != null && stats.getRank() != null ? stats.getRank() : Integer.MAX_VALUE;
                        })
                        .thenComparing(i -> i.getStudentName() != null ? i.getStudentName() : "",
                                String.CASE_INSENSITIVE_ORDER));

                zos.putNextEntry(new ZipEntry("index.csv"));
                zos.write(buildIndexCsv(allItems, statsByAttempt, totalMarks).getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();

                // Clickable manifest that works everywhere. A CSV =HYPERLINK
                // formula was tried first and dropped: macOS opens CSVs in
                // Numbers, whose HYPERLINK cannot open local relative files.
                // A plain HTML page with relative <a href> links opens the
                // sibling PDFs in any browser on any OS after extraction.
                zos.putNextEntry(new ZipEntry("index.html"));
                zos.write(buildIndexHtml(assessmentName, allItems, statsByAttempt, totalMarks)
                        .getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();
            }

            boolean partial = done.size() < job.getTotalCount();
            String outputFileName = partial
                    ? sanitize(assessmentName) + "_reports_partial_" + done.size() + "of" + job.getTotalCount() + ".zip"
                    : sanitize(assessmentName) + "_reports.zip";

            long size = Files.size(tmp);
            String fileId = uploadService.uploadStream(tmp, outputFileName, "application/zip",
                    "ASSESSMENT_REPORT_EXPORT", job.getAssessmentId());

            recordAssembledOutput(jobId, fileId, outputFileName, size, partial);

            String downloadUrl = null; // resolved by the caller on the next status read (C10)
            return ReportZipAssembleResponse.builder()
                    .jobId(jobId)
                    .includedCount(done.size())
                    .totalCount(job.getTotalCount())
                    .outputFileName(outputFileName)
                    .downloadUrl(downloadUrl)
                    .outputSizeBytes(size)
                    .partial(partial)
                    .build();
        } catch (VacademyException e) {
            throw e;
        } catch (Exception e) {
            throw new VacademyException("ZIP assembly failed for job " + jobId + ": " + e.getMessage());
        } finally {
            try {
                Files.deleteIfExists(tmp);
            } catch (Exception e) {
                log.warn("[report-export] Failed to delete temp ZIP {} for job {}: {}", tmp, jobId, e.getMessage());
            }
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordAssembledOutput(String jobId, String fileId, String fileName, long size, boolean partial) {
        AssessmentReportExportJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null)
            return;
        String previous = job.getOutputFileId();
        if (previous != null && !previous.equals(fileId)) {
            // No S3 delete primitive exists (X6) — orphan and record rather than
            // silently losing track of it.
            String superseded = job.getSupersededFileIds();
            job.setSupersededFileIds(
                    superseded == null || superseded.isBlank() ? previous : superseded + "," + previous);
            log.warn(
                    "[report-export] Superseding previous ZIP {} for job {} — object is orphaned, not deleted (no delete primitive)",
                    previous, jobId);
        }
        job.setOutputFileId(fileId);
        job.setOutputFileName(fileName);
        job.setOutputSizeBytes(size);
        job.setUpdatedAt(DateUtil.getCurrentUtcTime());
        // Deliberately does NOT touch job.status — assemble() never marks a job
        // COMPLETED; that only happens at the end of a full worker run so a
        // PARTIAL job assembled on demand stays PARTIAL (and resumable).
        jobRepository.save(job);
    }

    private boolean isStale(AssessmentReportExportItem item) {
        if (item.getProcessedAt() == null)
            return false;
        Optional<StudentAttempt> attempt = studentAttemptRepository.findById(item.getAttemptId());
        return attempt.map(StudentAttempt::getUpdatedAt)
                .map(updated -> updated.after(item.getProcessedAt()))
                .orElse(false);
    }

    private String nameOrFallback(AssessmentReportExportItem item) {
        return item.getStudentName() != null && !item.getStudentName().isBlank()
                ? item.getStudentName()
                : "student";
    }

    private String shortId(String id) {
        if (id == null)
            return "";
        return id.length() > 8 ? id.substring(0, 8) : id;
    }

    // Strips path separators and anything outside [A-Za-z0-9 ._-] — zip-slip
    // and Windows-illegal-character guard.
    private String sanitize(String raw) {
        if (raw == null)
            return "unknown";
        String cleaned = raw.replaceAll("[^A-Za-z0-9 ._-]", "_").trim();
        return cleaned.isEmpty() ? "unknown" : cleaned;
    }

    private String uniquify(String candidate, Set<String> used) {
        if (used.add(candidate))
            return candidate;
        int dot = candidate.lastIndexOf('.');
        String base = dot >= 0 ? candidate.substring(0, dot) : candidate;
        String ext = dot >= 0 ? candidate.substring(dot) : "";
        int n = 2;
        String next;
        do {
            next = base + " (" + n + ")" + ext;
            n++;
        } while (!used.add(next));
        return next;
    }

    // All items, not just DONE — this is how the school sees which N of total are
    // missing.
    private String buildIndexCsv(List<AssessmentReportExportItem> items,
            Map<String, vacademy.io.assessment_service.features.assessment.dto.LeaderBoardDto> statsByAttempt,
            Double totalMarks) {
        SimpleDateFormat sdf = new SimpleDateFormat("dd MMM yyyy hh:mm a");
        sdf.setTimeZone(TimeZone.getTimeZone("Asia/Kolkata"));
        StringBuilder csv = new StringBuilder();
        csv.append(
                "student_name,user_id,attempt_id,status,source,marks_obtained,total_marks,rank,percentile,file_name,error_message\n");
        for (AssessmentReportExportItem item : items) {
            var stats = statsByAttempt.get(item.getAttemptId());
            csv.append(csvEscape(item.getStudentName())).append(",")
                    .append(csvEscape(item.getUserId())).append(",")
                    .append(csvEscape(item.getAttemptId())).append(",")
                    .append(csvEscape(item.getStatus())).append(",")
                    .append(csvEscape(item.getSource())).append(",")
                    .append(formatNumber(stats != null ? stats.getAchievedMarks() : null)).append(",")
                    .append(formatNumber(totalMarks)).append(",")
                    .append(stats != null && stats.getRank() != null ? stats.getRank() : "").append(",")
                    .append(formatNumber(stats != null ? stats.getPercentile() : null)).append(",")
                    .append(csvEscape(item.getZipEntryName())).append(",")
                    .append(csvEscape(item.getErrorMessage())).append("\n");
        }
        return csv.toString();
    }

    /** 2-decimal number or blank — never "null" in a spreadsheet cell. */
    private String formatNumber(Double value) {
        if (value == null)
            return "";
        return String.format(java.util.Locale.US, "%.2f", value);
    }

    /**
     * Browser-openable manifest: one row per student with a relative link to
     * the PDF sitting next to this file in the extracted folder. Names are
     * HTML-escaped; entry names come from {@code sanitize()} so they cannot
     * carry markup.
     */
    private String buildIndexHtml(String assessmentName, List<AssessmentReportExportItem> items,
            Map<String, vacademy.io.assessment_service.features.assessment.dto.LeaderBoardDto> statsByAttempt,
            Double totalMarks) {
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html><head><meta charset=\"UTF-8\">")
                .append("<title>").append(htmlEscape(assessmentName)).append(" — Reports</title>")
                .append("<style>")
                .append("body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;margin:24px;color:#333;}")
                .append("h1{font-size:18px;}")
                .append("table{border-collapse:collapse;width:100%;max-width:900px;}")
                .append("th,td{border:1px solid #ddd;padding:8px 12px;text-align:left;font-size:14px;}")
                .append("th{background:#f5f5f5;}")
                .append("a{color:#1a63c9;}")
                .append(".muted{color:#999;}")
                .append("</style></head><body>")
                .append("<h1>").append(htmlEscape(assessmentName)).append(" — Reports</h1>")
                .append("<p class=\"muted\">Click on report column to open PDF. ")
                .append("Keep this file in the same folder as the PDFs.</p>")
                .append("<table><tr><th>#</th><th>Name</th><th>Marks</th><th>Rank</th>")
                .append("<th>Percentile</th><th>Status</th><th>Report</th><th>Note</th></tr>");

        int row = 1;
        for (AssessmentReportExportItem item : items) {
            String entry = item.getZipEntryName();
            boolean hasFile = entry != null && !entry.isBlank();
            var stats = statsByAttempt.get(item.getAttemptId());
            String marks = stats != null && stats.getAchievedMarks() != null
                    ? formatNumber(stats.getAchievedMarks())
                            + (totalMarks != null ? " / " + formatNumber(totalMarks) : "")
                    : "—";
            String rank = stats != null && stats.getRank() != null ? String.valueOf(stats.getRank()) : "—";
            String percentile = stats != null && stats.getPercentile() != null
                    ? formatNumber(stats.getPercentile())
                    : "—";
            html.append("<tr><td>").append(row++).append("</td>")
                    .append("<td>").append(htmlEscape(item.getStudentName())).append("</td>")
                    .append("<td>").append(marks).append("</td>")
                    .append("<td>").append(rank).append("</td>")
                    .append("<td>").append(percentile).append("</td>")
                    .append("<td>").append(htmlEscape(item.getStatus())).append("</td>")
                    .append("<td>");
            if (hasFile) {
                html.append("<a href=\"").append(htmlEscape(entry)).append("\" target=\"_blank\">Open report</a>");
            } else {
                html.append("<span class=\"muted\">—</span>");
            }
            html.append("</td><td>")
                    .append(item.getErrorMessage() != null ? htmlEscape(item.getErrorMessage()) : "")
                    .append("</td></tr>");
        }
        html.append("</table></body></html>");
        return html.toString();
    }

    private String htmlEscape(String value) {
        if (value == null)
            return "";
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    private String csvEscape(String value) {
        if (value == null)
            return "";
        // Formula-injection guard: this CSV deliberately carries a HYPERLINK
        // formula column, so Excel evaluates formulas when opening it. A value
        // starting with = + - @ (e.g. a student named "=cmd|...") would be
        // executed as a formula too — even when quoted. Neutralize with a
        // leading apostrophe (Excel renders it as plain text).
        if (!value.isEmpty() && (value.charAt(0) == '=' || value.charAt(0) == '+'
                || value.charAt(0) == '-' || value.charAt(0) == '@')) {
            value = "'" + value;
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
