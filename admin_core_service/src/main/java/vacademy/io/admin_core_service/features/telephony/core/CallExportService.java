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

/**
 * Renders an already-fetched (capped, masked, scoped) call list to CSV or XLSX.
 * Pure formatting — no querying or auth; the caller owns scope + the row cap.
 * Timestamps are written as UTC ISO-8601 so they're unambiguous across tools.
 */
@Service
public class CallExportService {

    private static final String[] HEADERS = {
            "Time", "Direction", "Call Type", "Provider", "Status", "Termination Reason",
            "Counsellor", "Counsellor User Id", "Lead Name", "Lead Number",
            "From", "To", "Duration (s)", "Disposition", "AI Disposition",
            "Callback At", "Has Recording"
    };

    public void writeCsv(List<CallRowDTO> rows, Writer out) throws IOException {
        out.write(String.join(",", HEADERS));
        out.write("\r\n");
        for (CallRowDTO r : rows) {
            String[] cells = cells(r);
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

    public void writeXlsx(List<CallRowDTO> rows, OutputStream out) throws IOException {
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
                String[] cells = cells(r);
                for (int c = 0; c < cells.length; c++) {
                    Cell cell = row.createCell(c);
                    if (cells[c] != null) cell.setCellValue(cells[c]);
                }
            }
            wb.write(out);
            wb.dispose(); // clean up the temp files
        }
    }

    private String[] cells(CallRowDTO r) {
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
                r.isHasRecording() ? "Yes" : "No"
        };
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
