package vacademy.io.community_service.feature.pricing.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.community_service.feature.pricing.dto.QuoteResponseDto;
import vacademy.io.community_service.feature.pricing.dto.QuoteResponseDto.LineItemDto;
import vacademy.io.community_service.feature.pricing.entity.PricingQuote;
import vacademy.io.community_service.feature.session.dto.admin.EmailRequestDto;
import vacademy.io.community_service.feature.session.dto.admin.EmailUserDto;
import vacademy.io.community_service.feature.session.manager.NotificationService;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

/**
 * Notifies the team when a prospect saves a plan — a warmer lead than a bare form fill, because
 * it comes with the price they actually configured. Mirrors {@code OnboardingAlertService}:
 * best-effort, and never throws back into the save.
 */
@Service
@Slf4j
public class PricingAlertService {

    private static final String SOURCE = "PRICING_QUOTE";

    @Autowired
    private NotificationService notificationService;

    /** @return true if the email dispatch was attempted (recipients present). */
    public boolean onQuoteSaved(PricingQuote quote, QuoteResponseDto priced, List<String> recipientEmails) {
        try {
            String who = safe(quote.getOrganizationName(), quote.getContactName());
            log.info("New pricing quote {} — {} at {}{}", quote.getId(), who,
                    priced.getCurrencySymbol(), priced.getTotal());

            if (recipientEmails == null || recipientEmails.isEmpty()) {
                log.warn("No active notification recipients — quote {} alert not sent", quote.getId());
                return false;
            }

            String subject = String.format("[Pricing] %s — %s%s first year",
                    who, priced.getCurrencySymbol(), format(priced.getTotal()));

            List<EmailUserDto> users = new ArrayList<>();
            for (String email : recipientEmails) {
                users.add(new EmailUserDto(null, email, new HashMap<>()));
            }

            EmailRequestDto dto = new EmailRequestDto();
            dto.setSubject(subject);
            dto.setBody(buildEmail(quote, priced));
            dto.setNotificationType("EMAIL");
            dto.setSource(SOURCE);
            dto.setSourceId(quote.getId());
            dto.setUsers(users);
            notificationService.sendEmail(dto);
            return true;
        } catch (Exception e) {
            log.error("Failed to dispatch pricing alert for {}: {}", quote.getId(), e.getMessage(), e);
            return false;
        }
    }

    private String buildEmail(PricingQuote q, QuoteResponseDto p) {
        String sym = p.getCurrencySymbol();
        StringBuilder sb = new StringBuilder();
        sb.append("<div style=\"font-family:Arial,sans-serif;font-size:14px;color:#1f2937\">");
        sb.append("<h2 style=\"margin:0 0 4px\">New lead with pricing</h2>");
        sb.append("<p style=\"margin:0 0 16px;color:#6b7280\">")
          .append(escape(sourceLabel(q.getSource())))
          .append("</p>");

        sb.append("<div style=\"padding:14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;margin-bottom:16px\">");
        sb.append("<div style=\"font-size:22px;font-weight:bold;color:#c2410c\">")
          .append(sym).append(format(p.getPerPaymentAmount())).append(" ")
          .append(escape(p.getPerPaymentLabel())).append("</div>");
        sb.append("<div style=\"color:#6b7280;margin-top:4px\">")
          .append(sym).append(format(p.getTotal())).append(" first year, incl. ")
          .append(escape(p.getTaxLabel()));
        if (p.getOneTimeTotalWithTax() != null && p.getOneTimeTotalWithTax().signum() > 0) {
            sb.append(" · plus ").append(sym).append(format(p.getOneTimeTotalWithTax())).append(" one-time");
        }
        sb.append("</div></div>");

        sb.append(row("Organization", q.getOrganizationName()));
        sb.append(row("Contact", q.getContactName()));
        sb.append(row("Email", q.getContactEmail()));
        sb.append(row("Phone", q.getContactPhone()));
        sb.append(row("Billing", cycleLabel(q.getBillingCycle())));
        sb.append(row("Currency", q.getCurrency()));

        sb.append("<h3 style=\"margin:16px 0 8px\">What they picked</h3>");
        sb.append("<div style=\"padding:12px;background:#f3f4f6;border-radius:8px\">");
        appendLines(sb, p.getRecurringLines(), sym, false);
        appendLines(sb, p.getOneTimeLines(), sym, true);
        sb.append("</div>");

        if (StringUtils.hasText(q.getSubmissionId())) {
            sb.append("<p style=\"margin-top:12px;color:#6b7280\">Linked to their onboarding submission — "
                    + "the requirements they ticked are on the Submissions tab.</p>");
        }
        sb.append("<p style=\"margin-top:16px;color:#6b7280\">Open the Quotes tab in the super-admin "
                + "dashboard for the full breakdown.</p>");
        sb.append("</div>");
        return sb.toString();
    }

    private void appendLines(StringBuilder sb, List<LineItemDto> lines, String sym, boolean oneTime) {
        if (lines == null) return;
        for (LineItemDto l : lines) {
            String amount = l.isIncludedFree() ? "Included" : sym + format(l.getAmount());
            sb.append("<div style=\"display:flex;justify-content:space-between;margin:4px 0\">")
              .append("<span>").append(escape(l.getLabel()))
              .append(oneTime ? " <em style=\"color:#6b7280\">(one-time)</em>" : "")
              .append("</span> <strong>").append(escape(amount)).append("</strong></div>");
        }
    }

    private static String sourceLabel(String source) {
        if (source == null) return "";
        return switch (source) {
            case "ONBOARDING" -> "Built straight after the onboarding form";
            case "STANDALONE" -> "Built from the public pricing link";
            case "INTERNAL" -> "Built by the team";
            default -> source;
        };
    }

    private static String cycleLabel(String cycle) {
        if (cycle == null) return "";
        return switch (cycle) {
            case "MONTHLY" -> "Monthly (+20%)";
            case "HALF_YEARLY" -> "Half-yearly";
            default -> "Annual upfront (−15%)";
        };
    }

    private static String format(BigDecimal v) {
        if (v == null) return "0";
        return v.stripTrailingZeros().toPlainString();
    }

    private String row(String label, String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return "<div style=\"margin:4px 0\"><strong>" + escape(label) + ":</strong> " + escape(value) + "</div>";
    }

    private String safe(String primary, String fallback) {
        return StringUtils.hasText(primary) ? primary : (fallback == null ? "" : fallback);
    }

    private String escape(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
