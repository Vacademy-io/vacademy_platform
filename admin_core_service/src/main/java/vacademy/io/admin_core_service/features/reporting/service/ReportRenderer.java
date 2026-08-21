package vacademy.io.admin_core_service.features.reporting.service;

import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.reporting.spi.SectionFacts;

import java.util.List;
import java.util.Locale;

/**
 * Renders computed facts to an email body.
 *
 * Table layout with inline styles, because that is what survives Gmail, Outlook
 * and the average Indian mail client. No external CSS, no web fonts, no flexbox,
 * no grid — Outlook's Word rendering engine ignores all of them.
 *
 * Everything rendered here came out of SQL. When the AI layer lands in Phase 2 it
 * adds prose ABOVE the numbers; it never replaces them, and it never gets to
 * recompute one.
 *
 * <h3>Why the header states the cadence and the dates</h3>
 * The heading is the schedule's own name, which an admin types once and rarely
 * revisits — a schedule created as "Weekly digest" and later switched to daily
 * keeps the old name and the document contradicts itself. So the cadence and the
 * exact covered dates are rendered from the RUN, not the name, and they are what
 * a reader should trust.
 *
 * <h3>Logos are decoration, never the message</h3>
 * Most mail clients block remote images until the reader opts in, so the logo is
 * rendered beside the institute's name in text rather than instead of it, and the
 * whole header still reads correctly with every image suppressed.
 */
@Service
public class ReportRenderer {

    // Dark chrome, light body: the header is the only heavy block, so the report
    // still prints and still reads in a cramped mobile client.
    private static final String SHELL = "#0b1120";
    private static final String SHELL_TEXT = "#e6edf7";
    private static final String SHELL_MUTED = "#8797ae";
    private static final String INK = "#14181f";
    private static final String MUTED = "#5e6b7a";
    private static final String RULE = "#dfe3e9";
    private static final String PANEL = "#f6f8fb";
    private static final String FALLBACK_ACCENT = "#2f6df6";

    private static final String SANS =
            "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
    /** Numbers are the point of this document, so they get a real mono stack. */
    private static final String MONO =
            "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

    /** Who the report is for, and what it should look like. */
    public record Branding(String instituteName, String logoUrl, String themeCode) {}

    /**
     * What the report covers. {@code cadence} is "Daily"/"Weekly"/"Monthly" and
     * {@code range} the literal dates — both derived from the run, never the name.
     */
    public record Period(String cadence, String range) {}

    public String render(Branding branding, String heading, Period period,
                         List<SectionFacts> sections) {
        String accent = accentFor(branding == null ? null : branding.themeCode());
        String institute = branding == null || branding.instituteName() == null
                ? "Vacademy" : branding.instituteName();
        String logoUrl = branding == null ? null : branding.logoUrl();

        StringBuilder b = new StringBuilder(8192);

        b.append("<div style=\"margin:0;padding:0;background:").append(PANEL)
                .append(";font-family:").append(SANS).append(";\">");
        b.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" ")
                .append("style=\"border-collapse:collapse;background:").append(PANEL).append(";\"><tr><td align=\"center\">");
        b.append("<table role=\"presentation\" width=\"640\" cellpadding=\"0\" cellspacing=\"0\" ")
                .append("style=\"border-collapse:collapse;width:100%;max-width:640px;background:#ffffff;\">");

        renderHeader(b, institute, logoUrl, heading, period, accent);

        b.append("<tr><td style=\"padding:8px 28px 28px;\">");
        for (int i = 0; i < sections.size(); i++) {
            renderSection(b, sections.get(i), i + 1, accent);
        }
        renderFooter(b);
        b.append("</td></tr></table></td></tr></table></div>");
        return b.toString();
    }

    private void renderHeader(StringBuilder b, String institute, String logoUrl,
                              String heading, Period period, String accent) {
        b.append("<tr><td style=\"background:").append(SHELL).append(";padding:22px 28px 20px;\">");

        // Identity line: logo and name together, so a blocked image costs nothing.
        b.append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:collapse;\"><tr>");
        if (logoUrl != null && !logoUrl.isBlank()) {
            b.append("<td style=\"padding-right:10px;vertical-align:middle;\">")
                    .append("<img src=\"").append(esc(logoUrl)).append("\" alt=\"\" height=\"26\" ")
                    .append("style=\"display:block;max-height:26px;border:0;outline:none;\"></td>");
        }
        b.append("<td style=\"vertical-align:middle;font-family:").append(MONO)
                .append(";font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:")
                .append(SHELL_TEXT).append(";\">").append(esc(institute)).append("</td>");
        b.append("</tr></table>");

        b.append("<div style=\"font-size:24px;line-height:1.25;font-weight:700;color:#ffffff;margin:14px 0 0;\">")
                .append(esc(heading)).append("</div>");

        // Cadence + exact dates. This is the authoritative statement of what the
        // document covers — see the class note on stale schedule names.
        if (period != null) {
            b.append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" ")
                    .append("style=\"border-collapse:collapse;margin-top:12px;\"><tr>");
            if (period.cadence() != null && !period.cadence().isBlank()) {
                b.append("<td style=\"padding-right:10px;\">")
                        .append("<span style=\"display:inline-block;font-family:").append(MONO)
                        .append(";font-size:10px;letter-spacing:.16em;text-transform:uppercase;")
                        .append("color:").append(SHELL).append(";background:").append(accent)
                        .append(";padding:4px 9px;border-radius:3px;font-weight:700;\">")
                        .append(esc(period.cadence())).append("</span></td>");
            }
            if (period.range() != null && !period.range().isBlank()) {
                b.append("<td style=\"font-family:").append(MONO)
                        .append(";font-size:12px;color:").append(SHELL_MUTED).append(";\">")
                        .append(esc(period.range())).append("</td>");
            }
            b.append("</tr></table>");
        }
        b.append("</td></tr>");
    }

    private void renderSection(StringBuilder b, SectionFacts s, int index, String accent) {
        b.append("<div style=\"margin-top:30px;\">");

        // Numbered rail: an index is honest here because sections ARE an ordered
        // list, and it gives the eye something to scan on a dense page.
        b.append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" ")
                .append("style=\"border-collapse:collapse;width:100%;border-bottom:2px solid ")
                .append(INK).append(";padding-bottom:8px;\"><tr>");
        b.append("<td style=\"font-family:").append(MONO)
                .append(";font-size:11px;font-weight:700;color:").append(accent)
                .append(";padding-right:10px;vertical-align:baseline;width:26px;\">")
                .append(String.format("%02d", index)).append("</td>");
        b.append("<td style=\"font-size:15px;font-weight:700;letter-spacing:.02em;color:")
                .append(INK).append(";vertical-align:baseline;\">")
                .append(esc(s.getTitle())).append("</td>");
        b.append("</tr></table>");

        if (s.isEmpty()) {
            // Say so explicitly. Rendering an empty section as nothing at all
            // reads as "we didn't check", which is worse than "nothing to report".
            b.append("<p style=\"font-size:14px;color:").append(MUTED)
                    .append(";margin:14px 0 0;\">Nothing to report for this period.</p></div>");
            return;
        }

        if (s.getHeadlines() != null && !s.getHeadlines().isEmpty()) {
            b.append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" ")
                    .append("style=\"border-collapse:collapse;width:100%;margin-top:16px;background:")
                    .append(PANEL).append(";border:1px solid ").append(RULE)
                    .append(";border-radius:4px;\"><tr>");
            for (var e : s.getHeadlines().entrySet()) {
                b.append("<td style=\"padding:12px 14px;vertical-align:top;\">")
                        .append("<div style=\"font-family:").append(MONO)
                        .append(";font-size:21px;font-weight:700;color:").append(accent)
                        .append(";line-height:1.15;font-variant-numeric:tabular-nums;\">")
                        .append(esc(e.getValue())).append("</div>")
                        .append("<div style=\"font-family:").append(MONO)
                        .append(";font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:")
                        .append(MUTED).append(";margin-top:5px;\">")
                        .append(esc(e.getKey())).append("</div></td>");
            }
            b.append("</tr></table>");
        }

        if (s.getRows() != null && !s.getRows().isEmpty()) {
            b.append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" ")
                    .append("style=\"border-collapse:collapse;width:100%;font-size:13px;margin-top:14px;")
                    .append("font-variant-numeric:tabular-nums;\">");
            b.append("<tr>");
            for (String c : s.getColumns()) {
                b.append("<th align=\"left\" style=\"padding:0 8px 7px;border-bottom:1px solid ")
                        .append(RULE).append(";font-family:").append(MONO)
                        .append(";font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:")
                        .append(MUTED).append(";font-weight:600;\">").append(esc(c)).append("</th>");
            }
            b.append("</tr>");
            boolean stripe = false;
            for (SectionFacts.Row r : s.getRows()) {
                b.append("<tr style=\"background:").append(stripe ? PANEL : "#ffffff").append(";\">");
                stripe = !stripe;
                for (String v : r.getValues()) {
                    b.append("<td style=\"padding:8px;border-bottom:1px solid ").append(RULE)
                            .append(";color:").append(INK).append(";vertical-align:top;\">")
                            .append(esc(v)).append("</td>");
                }
                b.append("</tr>");
            }
            b.append("</table>");
        }
        b.append("</div>");
    }

    private void renderFooter(StringBuilder b) {
        b.append("<div style=\"margin-top:34px;padding-top:14px;border-top:1px solid ").append(RULE)
                .append(";font-family:").append(MONO).append(";font-size:10px;line-height:1.6;color:")
                .append(MUTED).append(";\">")
                .append("Sent by Vacademy because scheduled reports are switched on for this institute.<br>")
                .append("Every figure is computed directly from your data.")
                .append("</div>");
    }

    /**
     * Theme codes in prod are mostly CSS keywords ("blue", "green", "purple"), and
     * the raw keywords are far too saturated to sit behind white text — pure
     * {@code blue} is #0000FF. Known codes map to tuned equivalents; a hex value is
     * respected as given, with or without the leading hash.
     */
    private String accentFor(String themeCode) {
        if (themeCode == null || themeCode.isBlank()) return FALLBACK_ACCENT;
        String t = themeCode.trim();
        if (t.matches("^#?[0-9A-Fa-f]{6}$")) return t.startsWith("#") ? t : "#" + t;
        return switch (t.toLowerCase(Locale.ROOT)) {
            case "blue" -> "#2f6df6";
            case "green" -> "#12996b";
            case "red" -> "#e0483c";
            case "purple" -> "#7c4ddb";
            case "pink" -> "#d6417f";
            case "orange" -> "#e07b28";
            case "yellow", "amber" -> "#c98a06";
            case "teal", "cyan" -> "#0f8f9e";
            case "primary" -> FALLBACK_ACCENT;
            default -> FALLBACK_ACCENT;
        };
    }

    /** Learner names and free text land in HTML — escape rather than trust. */
    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
