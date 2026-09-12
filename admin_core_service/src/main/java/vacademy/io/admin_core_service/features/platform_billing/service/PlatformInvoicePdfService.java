package vacademy.io.admin_core_service.features.platform_billing.service;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformInvoice;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformInvoiceLineItem;
import vacademy.io.admin_core_service.features.platform_billing.repository.PlatformInvoiceLineItemRepository;
import vacademy.io.admin_core_service.features.platform_billing.repository.PlatformInvoiceRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Renders a {@link PlatformInvoice} (Vacademy → institute AI credit pack sale)
 * to a single-page A4 GST tax invoice PDF.
 *
 * Rendered on demand from the persisted invoice header + line items — nothing
 * is uploaded to S3, so invoices for payments that pre-date this renderer are
 * downloadable too. The same bytes are attached to the purchase confirmation
 * email by {@link PlatformRazorpayWebHookService}.
 *
 * Uses the same openhtmltopdf-pdfbox + bundled DejaVuSans font approach as the
 * student fee invoice pipeline (see InvoiceService) so "₹" renders.
 */
@Slf4j
@Service
public class PlatformInvoicePdfService {

    private static final String FONT_RESOURCE = "/fonts/DejaVuSans.ttf";
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy");

    private final PlatformInvoiceRepository invoiceRepository;
    private final PlatformInvoiceLineItemRepository lineItemRepository;

    public PlatformInvoicePdfService(
            PlatformInvoiceRepository invoiceRepository,
            PlatformInvoiceLineItemRepository lineItemRepository) {
        this.invoiceRepository = invoiceRepository;
        this.lineItemRepository = lineItemRepository;
    }

    public byte[] renderPdf(String invoiceId) {
        PlatformInvoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new VacademyException("Invoice not found: " + invoiceId));
        return renderPdf(invoice);
    }

    public byte[] renderPdf(PlatformInvoice invoice) {
        List<PlatformInvoiceLineItem> lines = lineItemRepository.findByPlatformInvoiceId(invoice.getId());
        String xhtml = buildHtml(invoice, lines);
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            for (String family : new String[] { "DejaVu Sans", "sans-serif", "Arial", "Helvetica" }) {
                builder.useFont(() -> fontStream(), family);
            }
            builder.withHtmlContent(xhtml, "file:///");
            builder.useDefaultPageSize(210f, 297f, PdfRendererBuilder.PageSizeUnits.MM);
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Failed to render platform invoice PDF {}: {}", invoice.getInvoiceNumber(), e.getMessage(), e);
            throw new VacademyException("Failed to render invoice PDF: " + e.getMessage());
        }
    }

    public String fileName(PlatformInvoice invoice) {
        return invoice.getInvoiceNumber() + ".pdf";
    }

    private static InputStream fontStream() {
        return PlatformInvoicePdfService.class.getResourceAsStream(FONT_RESOURCE);
    }

    // ─────────────────────────────────────────────────────────────────
    // HTML (hand-built XHTML — every dynamic value passes through esc())
    // ─────────────────────────────────────────────────────────────────

    String buildHtml(PlatformInvoice inv, List<PlatformInvoiceLineItem> lines) {
        boolean export = Boolean.TRUE.equals(inv.getIsExport());
        boolean intra = (inv.getCgstAmountMinor() != null && inv.getCgstAmountMinor() > 0)
                || (inv.getSgstAmountMinor() != null && inv.getSgstAmountMinor() > 0);
        String cur = inv.getCurrency() == null ? "INR" : inv.getCurrency();
        boolean b2b = notBlank(inv.getBuyerGstin());

        StringBuilder sb = new StringBuilder(8_000);
        sb.append("<!DOCTYPE html><html xmlns=\"http://www.w3.org/1999/xhtml\"><head><meta charset=\"UTF-8\"/>")
          .append("<title>").append(esc(inv.getInvoiceNumber())).append("</title>")
          .append("<style>")
          .append("@page{size:A4;margin:18mm 16mm;}")
          .append("body{font-family:'DejaVu Sans',sans-serif;font-size:10.5px;color:#111827;margin:0;}")
          .append("h1{font-size:20px;margin:0;letter-spacing:.5px;}")
          .append(".muted{color:#6b7280;}")
          .append(".row{width:100%;border-collapse:collapse;}")
          .append(".row td{vertical-align:top;padding:0;}")
          .append(".box{border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px;}")
          .append(".label{font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:#6b7280;margin-bottom:4px;}")
          .append(".kv td{padding:2px 0;}")
          .append(".kv td.k{color:#6b7280;padding-right:14px;white-space:nowrap;}")
          .append("table.items{width:100%;border-collapse:collapse;margin-top:16px;}")
          .append("table.items th{background:#f3f4f6;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#374151;padding:7px 8px;border:1px solid #e5e7eb;text-align:left;}")
          .append("table.items td{padding:8px;border:1px solid #e5e7eb;}")
          .append(".r{text-align:right;} .c{text-align:center;}")
          .append("table.totals{border-collapse:collapse;margin-top:12px;width:62mm;margin-left:auto;}")
          .append("table.totals td{padding:4px 6px;}")
          .append("table.totals tr.grand td{border-top:2px solid #111827;font-weight:bold;font-size:12px;padding-top:7px;}")
          .append(".badge{display:inline-block;border:1px solid #7c3aed;color:#7c3aed;border-radius:4px;padding:2px 7px;font-size:9px;font-weight:bold;letter-spacing:.5px;}")
          .append(".foot{margin-top:26px;border-top:1px solid #e5e7eb;padding-top:10px;font-size:9px;color:#6b7280;}")
          .append("</style></head><body>");

        // Header
        sb.append("<table class=\"row\"><tr><td>")
          .append("<h1>TAX INVOICE</h1>")
          .append("<div class=\"muted\" style=\"margin-top:4px;\">")
          .append(export ? "Export of services — zero-rated under GST"
                         : (b2b ? "B2B supply — GST registered recipient" : "B2C supply"))
          .append("</div></td><td class=\"r\">")
          .append("<span class=\"badge\">PAID</span>")
          .append("<table class=\"kv\" style=\"margin-left:auto;margin-top:8px;\">")
          .append(kv("Invoice No.", inv.getInvoiceNumber()))
          .append(kv("Invoice Date", inv.getIssuedAt() == null ? "" : inv.getIssuedAt().format(DATE_FMT)))
          .append(kv("Place of Supply", placeOfSupplyLabel(inv.getPlaceOfSupply(), export)))
          .append(kv("Payment Ref.", inv.getPlatformPaymentId()))
          .append("</table></td></tr></table>");

        // Parties
        sb.append("<table class=\"row\" style=\"margin-top:18px;\"><tr>")
          .append("<td style=\"width:50%;padding-right:6px;\"><div class=\"box\">")
          .append("<div class=\"label\">Supplier</div>")
          .append("<div style=\"font-weight:bold;font-size:12px;\">").append(esc(inv.getSupplierLegalName())).append("</div>")
          .append("<div class=\"muted\" style=\"margin-top:3px;white-space:pre-line;\">").append(esc(inv.getSupplierAddress())).append("</div>")
          .append("<div style=\"margin-top:6px;\"><span class=\"muted\">GSTIN:</span> <b>").append(esc(nz(inv.getSupplierGstin(), "—"))).append("</b></div>")
          .append("<div><span class=\"muted\">State code:</span> ").append(esc(nz(inv.getSupplierStateCode(), "—"))).append("</div>")
          .append("</div></td>")
          .append("<td style=\"width:50%;padding-left:6px;\"><div class=\"box\">")
          .append("<div class=\"label\">Bill To</div>")
          .append("<div style=\"font-weight:bold;font-size:12px;\">").append(esc(inv.getBuyerLegalName())).append("</div>")
          .append("<div class=\"muted\" style=\"margin-top:3px;\">").append(esc(nz(inv.getBuyerAddress(), ""))).append("</div>")
          .append("<div style=\"margin-top:6px;\"><span class=\"muted\">GSTIN:</span> <b>")
          .append(b2b ? esc(inv.getBuyerGstin()) : "Unregistered").append("</b></div>")
          .append("<div><span class=\"muted\">State code:</span> ").append(esc(nz(inv.getBuyerStateCode(), "—"))).append("</div>")
          .append("</div></td></tr></table>");

        // Line items
        sb.append("<table class=\"items\"><thead><tr>")
          .append("<th style=\"width:4%\">#</th><th>Description</th><th class=\"c\" style=\"width:9%\">HSN/SAC</th>")
          .append("<th class=\"c\" style=\"width:6%\">Qty</th><th class=\"r\" style=\"width:14%\">Taxable Value</th>");
        if (export) {
            sb.append("<th class=\"c\" style=\"width:9%\">GST</th>");
        } else if (intra) {
            sb.append("<th class=\"r\" style=\"width:12%\">CGST</th><th class=\"r\" style=\"width:12%\">SGST</th>");
        } else {
            sb.append("<th class=\"r\" style=\"width:14%\">IGST</th>");
        }
        sb.append("<th class=\"r\" style=\"width:14%\">Total</th></tr></thead><tbody>");

        int i = 1;
        for (PlatformInvoiceLineItem l : lines) {
            sb.append("<tr><td class=\"c\">").append(i++).append("</td>")
              .append("<td>").append(esc(l.getDescription())).append("</td>")
              .append("<td class=\"c\">").append(esc(nz(l.getHsnSacCode(), ""))).append("</td>")
              .append("<td class=\"c\">").append(qty(l.getQuantity())).append("</td>")
              .append("<td class=\"r\">").append(money(l.getBaseAmountMinor(), cur)).append("</td>");
            if (export) {
                sb.append("<td class=\"c\">0%</td>");
            } else if (intra) {
                sb.append("<td class=\"r\">").append(money(l.getCgstAmountMinor(), cur))
                  .append("<div class=\"muted\">@ ").append(pct(l.getCgstRateBps())).append("</div></td>")
                  .append("<td class=\"r\">").append(money(l.getSgstAmountMinor(), cur))
                  .append("<div class=\"muted\">@ ").append(pct(l.getSgstRateBps())).append("</div></td>");
            } else {
                sb.append("<td class=\"r\">").append(money(l.getIgstAmountMinor(), cur))
                  .append("<div class=\"muted\">@ ").append(pct(l.getIgstRateBps())).append("</div></td>");
            }
            sb.append("<td class=\"r\"><b>").append(money(l.getTotalAmountMinor(), cur)).append("</b></td></tr>");
        }
        sb.append("</tbody></table>");

        // Totals
        sb.append("<table class=\"totals\">")
          .append(tot("Taxable value", money(inv.getBaseAmountMinor(), cur), false));
        if (export) {
            sb.append(tot("GST (export, 0%)", money(0L, cur), false));
        } else if (intra) {
            sb.append(tot("CGST", money(inv.getCgstAmountMinor(), cur), false))
              .append(tot("SGST", money(inv.getSgstAmountMinor(), cur), false));
        } else {
            sb.append(tot("IGST", money(inv.getIgstAmountMinor(), cur), false));
        }
        sb.append(tot("Total", money(inv.getTotalAmountMinor(), cur), true))
          .append("</table>");

        sb.append("<div class=\"muted\" style=\"margin-top:10px;\">Amount in words: <b>")
          .append(esc(amountInWords(inv.getTotalAmountMinor(), cur))).append("</b></div>");

        // Footer
        sb.append("<div class=\"foot\">")
          .append("<div>Supply of AI credits for use on the Vacademy platform. Credits are non-transferable and non-refundable once consumed.</div>")
          .append("<div style=\"margin-top:4px;\">")
          .append(export ? "Zero-rated export of services under Section 16 of the IGST Act, 2017. "
                         : (intra ? "Intra-state supply — CGST + SGST charged. " : "Inter-state supply — IGST charged. "))
          .append("Tax is payable on reverse charge basis: No.</div>")
          .append("<div style=\"margin-top:4px;\">This is a computer-generated invoice and does not require a physical signature.</div>")
          .append("</div>");

        sb.append("</body></html>");
        return sb.toString();
    }

    // ─────────────────────────────────────────────────────────────────
    // Formatting helpers
    // ─────────────────────────────────────────────────────────────────

    private static String kv(String k, String v) {
        return "<tr><td class=\"k\">" + esc(k) + "</td><td class=\"r\"><b>" + esc(nz(v, "")) + "</b></td></tr>";
    }

    private static String tot(String k, String v, boolean grand) {
        return "<tr" + (grand ? " class=\"grand\"" : "") + "><td class=\"muted\">" + esc(k)
                + "</td><td class=\"r\">" + v + "</td></tr>";
    }

    static String money(Long minor, String cur) {
        long m = minor == null ? 0L : minor;
        BigDecimal major = BigDecimal.valueOf(m).movePointLeft(2).setScale(2, RoundingMode.HALF_UP);
        String num = "INR".equalsIgnoreCase(cur) ? indianGroup(major) : String.format(Locale.US, "%,.2f", major);
        String sym = "INR".equalsIgnoreCase(cur) ? "₹" : "USD".equalsIgnoreCase(cur) ? "$" : (cur + " ");
        return esc(sym + num);
    }

    /** 1234567.89 → 12,34,567.89 (Indian lakh/crore grouping). */
    static String indianGroup(BigDecimal v) {
        String plain = v.toPlainString();
        String intPart = plain.contains(".") ? plain.substring(0, plain.indexOf('.')) : plain;
        String frac = plain.contains(".") ? plain.substring(plain.indexOf('.')) : ".00";
        boolean neg = intPart.startsWith("-");
        if (neg) intPart = intPart.substring(1);
        if (intPart.length() <= 3) return (neg ? "-" : "") + intPart + frac;
        String last3 = intPart.substring(intPart.length() - 3);
        String rest = intPart.substring(0, intPart.length() - 3);
        StringBuilder sb = new StringBuilder();
        while (rest.length() > 2) {
            sb.insert(0, "," + rest.substring(rest.length() - 2));
            rest = rest.substring(0, rest.length() - 2);
        }
        sb.insert(0, rest);
        return (neg ? "-" : "") + sb + "," + last3 + frac;
    }

    private static String pct(Integer bps) {
        if (bps == null) return "0%";
        BigDecimal p = BigDecimal.valueOf(bps).movePointLeft(2).stripTrailingZeros();
        return p.toPlainString() + "%";
    }

    private static String qty(BigDecimal q) {
        return q == null ? "1" : q.stripTrailingZeros().toPlainString();
    }

    private static String placeOfSupplyLabel(String code, boolean export) {
        if (export || "96".equals(code)) return "Outside India (96)";
        if (code == null) return "—";
        String name = IndianStates.nameFor(code);
        return name == null ? code : name + " (" + code + ")";
    }

    private static String amountInWords(Long minor, String cur) {
        long m = minor == null ? 0L : minor;
        long whole = m / 100;
        long frac = m % 100;
        boolean inr = "INR".equalsIgnoreCase(cur);
        String unit = inr ? "Rupees" : "Dollars";
        String sub = inr ? "Paise" : "Cents";
        StringBuilder sb = new StringBuilder();
        sb.append(unit).append(' ').append(whole == 0 ? "Zero" : (inr ? indianWords(whole) : westernWords(whole)));
        if (frac > 0) sb.append(" and ").append(westernWords(frac)).append(' ').append(sub);
        sb.append(" Only");
        return sb.toString();
    }

    private static final String[] ONES = { "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen" };
    private static final String[] TENS = { "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety" };

    private static String upToThousand(long n) {
        StringBuilder sb = new StringBuilder();
        if (n >= 100) { sb.append(ONES[(int) (n / 100)]).append(" Hundred"); n %= 100; if (n > 0) sb.append(' '); }
        if (n >= 20) { sb.append(TENS[(int) (n / 10)]); n %= 10; if (n > 0) sb.append(' ').append(ONES[(int) n]); }
        else if (n > 0) sb.append(ONES[(int) n]);
        return sb.toString();
    }

    private static String indianWords(long n) {
        StringBuilder sb = new StringBuilder();
        long crore = n / 10_000_000; n %= 10_000_000;
        long lakh = n / 100_000; n %= 100_000;
        long thousand = n / 1000; n %= 1000;
        if (crore > 0) sb.append(indianWords(crore)).append(" Crore ");
        if (lakh > 0) sb.append(upToThousand(lakh)).append(" Lakh ");
        if (thousand > 0) sb.append(upToThousand(thousand)).append(" Thousand ");
        if (n > 0) sb.append(upToThousand(n));
        return sb.toString().trim();
    }

    private static String westernWords(long n) {
        StringBuilder sb = new StringBuilder();
        long million = n / 1_000_000; n %= 1_000_000;
        long thousand = n / 1000; n %= 1000;
        if (million > 0) sb.append(upToThousand(million)).append(" Million ");
        if (thousand > 0) sb.append(upToThousand(thousand)).append(" Thousand ");
        if (n > 0) sb.append(upToThousand(n));
        return sb.toString().trim();
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }
    private static String nz(String s, String d) { return notBlank(s) ? s : d; }

    static String esc(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder(s.length() + 16);
        for (char c : s.toCharArray()) {
            switch (c) {
                case '&' -> sb.append("&amp;");
                case '<' -> sb.append("&lt;");
                case '>' -> sb.append("&gt;");
                case '"' -> sb.append("&quot;");
                default -> sb.append(c);
            }
        }
        return sb.toString();
    }
}
