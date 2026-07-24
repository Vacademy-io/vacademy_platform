package vacademy.io.admin_core_service.features.telephony.core;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.telephony.core.dto.CallRowDTO;

import java.io.IOException;
import java.io.OutputStream;
import java.io.Writer;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;

/**
 * Renders an already-fetched (capped, masked, scoped) call list to CSV or XLSX.
 * Pure formatting — no querying or auth; the caller owns scope, the row cap and
 * the (optional) AI enrichment map from {@link CallExportAiEnricher}.
 * Timestamps are written as UTC ISO-8601 so they're unambiguous across tools.
 */
@Service
public class CallExportService {

    private static final String[] HEADERS = {
            "Time", "Direction", "Call Type", "Provider", "Status", "Termination Reason",
            "Counsellor", "Counsellor User Id", "Lead Name", "Lead Number",
            "From", "To", "Duration (s)", "Disposition", "AI Disposition",
            "Callback At", "Has Recording",
            // Call Intelligence — blank when the call has no COMPLETED analysis.
            "AI Summary", "AI Goal", "AI Outcome", "AI Caller Rating (0-10)",
            "AI Outcome Rating (0-10)", "AI Lead Sentiment", "AI Conversion Likelihood",
            "Transcript", "Transcript (English)"
    };

    /** XLSX hard-caps a cell at 32,767 chars; keep headroom for the truncation note. */
    private static final int XLSX_CELL_LIMIT = 32_000;

    public void writeCsv(List<CallRowDTO> rows, Map<String, CallExportAiEnricher.AiRow> ai,
                         Writer out) throws IOException {
        out.write(String.join(",", HEADERS));
        out.write("\r\n");
        for (CallRowDTO r : rows) {
            String[] cells = cells(r, ai.get(r.getId()));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < cells.length; i++) {
                if (i > 0) sb.append(',');
                sb.append(csvEscape(cells[i]));
            }
            sb.append("\r\n");
            out.write(sb.toString());
        }
        out.flush();
    }

    public void writeXlsx(List<CallRowDTO> rows, Map<String, CallExportAiEnricher.AiRow> ai,
                          OutputStream out) throws IOException {
        // SXSSF streams to disk-backed temp files — keeps memory flat for large exports.
        try (SXSSFWorkbook wb = new SXSSFWorkbook(100)) {
            Sheet sheet = wb.createSheet("Calls");
            Row header = sheet.createRow(0);
            for (int c = 0; c < HEADERS.length; c++) {
                header.createCell(c).setCellValue(HEADERS[c]);
            }
            int rowIdx = 1;
            for (CallRowDTO r : rows) {
                Row row = sheet.createRow(rowIdx++);
                String[] cells = cells(r, ai.get(r.getId()));
                for (int c = 0; c < cells.length; c++) {
                    Cell cell = row.createCell(c);
                    if (cells[c] != null) cell.setCellValue(xlsxSafe(cells[c]));
                }
            }
            wb.write(out);
            wb.dispose(); // clean up the temp files
        }
    }

    private String[] cells(CallRowDTO r, CallExportAiEnricher.AiRow ai) {
        return new String[]{
                iso(r.getStartTime() != null ? r.getStartTime() : r.getCreatedAt()),
                r.getDirection(),
                r.getCallType(),
                r.getProviderType(),
                r.getStatus(),
                r.getTerminationReason(),
                r.getCounsellorName(),
                r.getCounsellorUserId(),
                r.getLeadName(),
                r.getLeadNumber(),
                r.getFromNumber(),
                r.getToNumber(),
                r.getDurationSeconds() == null ? null : String.valueOf(r.getDurationSeconds()),
                r.getDispositionKey(),
                r.getAiDisposition(),
                iso(r.getCallbackAt()),
                r.isHasRecording() ? "Yes" : "No",
                ai == null ? null : ai.summary(),
                ai == null ? null : ai.goal(),
                ai == null ? null : ai.outcome(),
                ai == null ? null : ai.callerRating(),
                ai == null ? null : ai.outcomeRating(),
                ai == null ? null : ai.leadSentiment(),
                ai == null ? null : ai.conversionLikelihood(),
                ai == null ? null : ai.transcript(),
                ai == null ? null : ai.transcriptEnglish()
        };
    }

    private static String xlsxSafe(String v) {
        if (v == null || v.length() <= XLSX_CELL_LIMIT) return v;
        return v.substring(0, XLSX_CELL_LIMIT) + "… (truncated)";
    }

    private static String iso(Timestamp t) {
        return t == null ? null : t.toInstant().toString();
    }

    private static String csvEscape(String v) {
        if (v == null) return "";
        boolean needsQuote = v.contains(",") || v.contains("\"") || v.contains("\n") || v.contains("\r");
        String escaped = v.replace("\"", "\"\"");
        return needsQuote ? "\"" + escaped + "\"" : escaped;
    }
}
