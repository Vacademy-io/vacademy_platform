package vacademy.io.admin_core_service.features.reporting.service;

import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.reporting.spi.SectionFacts;

import java.util.List;

/**
 * Renders computed facts to an email body.
 *
 * Table layout with inline styles, because that is what survives Gmail, Outlook
 * and the average Indian mail client. No external CSS, no web fonts, no images.
 *
 * Everything rendered here came out of SQL. When the AI layer lands in Phase 2 it
 * adds prose ABOVE the numbers; it never replaces them, and it never gets to
 * recompute one.
 */
@Service
public class ReportRenderer {

    private static final String INK = "#14181f";
    private static final String MUTED = "#5e6b7a";
    private static final String RULE = "#dfe3e9";
    private static final String ACCENT = "#1f5f8b";

    public String render(String instituteName, String scopeLabel, String windowLabel,
                         List<SectionFacts> sections) {
        StringBuilder b = new StringBuilder(4096);

        b.append("<div style=\"font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;")
                .append("max-width:640px;margin:0 auto;padding:24px;color:").append(INK).append(";\">");

        b.append("<div style=\"font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:")
                .append(MUTED).append(";\">").append(esc(instituteName)).append("</div>");
        b.append("<h1 style=\"font-size:22px;margin:6px 0 4px;\">").append(esc(scopeLabel)).append("</h1>");
        b.append("<div style=\"font-size:13px;color:").append(MUTED).append(";margin-bottom:22px;\">")
                .append("Covering ").append(esc(windowLabel)).append("</div>");

        for (SectionFacts s : sections) {
            b.append("<div style=\"border-top:2px solid ").append(INK).append(";padding-top:14px;margin-top:26px;\">");
            b.append("<h2 style=\"font-size:16px;margin:0 0 12px;\">").append(esc(s.getTitle())).append("</h2>");

            if (s.isEmpty()) {
                // Say so explicitly. Rendering an empty section as nothing at all
                // reads as "we didn't check", which is worse than "nothing to report".
                b.append("<p style=\"font-size:14px;color:").append(MUTED)
                        .append(";margin:0;\">Nothing to report for this period.</p></div>");
                continue;
            }

            if (s.getHeadlines() != null && !s.getHeadlines().isEmpty()) {
                b.append("<table role=\"presentation\" style=\"border-collapse:collapse;width:100%;margin-bottom:14px;\"><tr>");
                for (var e : s.getHeadlines().entrySet()) {
                    b.append("<td style=\"padding:8px 10px 8px 0;vertical-align:top;\">")
                            .append("<div style=\"font-size:22px;font-weight:600;color:").append(ACCENT).append(";\">")
                            .append(esc(e.getValue())).append("</div>")
                            .append("<div style=\"font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:")
                            .append(MUTED).append(";\">").append(esc(e.getKey())).append("</div></td>");
                }
                b.append("</tr></table>");
            }

            if (s.getRows() != null && !s.getRows().isEmpty()) {
                b.append("<table role=\"presentation\" style=\"border-collapse:collapse;width:100%;font-size:13px;\">");
                b.append("<tr>");
                for (String c : s.getColumns()) {
                    b.append("<th align=\"left\" style=\"padding:6px 8px;border-bottom:1px solid ").append(RULE)
                            .append(";font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:")
                            .append(MUTED).append(";font-weight:500;\">").append(esc(c)).append("</th>");
                }
                b.append("</tr>");
                for (SectionFacts.Row r : s.getRows()) {
                    b.append("<tr>");
                    for (String v : r.getValues()) {
                        b.append("<td style=\"padding:6px 8px;border-bottom:1px solid ").append(RULE)
                                .append(";\">").append(esc(v)).append("</td>");
                    }
                    b.append("</tr>");
                }
                b.append("</table>");
            }
            b.append("</div>");
        }

        b.append("<p style=\"margin-top:30px;font-size:11px;color:").append(MUTED).append(";\">")
                .append("Sent by Vacademy because scheduled reports are switched on for this institute. ")
                .append("Figures are computed directly from your data.</p>");
        b.append("</div>");
        return b.toString();
    }

    /** Learner names and free text land in HTML — escape rather than trust. */
    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
