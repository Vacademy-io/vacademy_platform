package vacademy.io.admin_core_service.features.institute.dto.settings.certificate;


import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Setter
@Getter
public class CertificateSettingDto {
    private String key;
    private Boolean isDefaultCertificateSettingOn;
    private String defaultHtmlCertificateTemplate;
    private String currentHtmlCertificateTemplate;
    private List<String> customHtmlCertificateTemplate;
    private Map<String, String> placeHoldersMapping;

    // Auto-issue threshold (%): certificates are issued only when the learner's
    // course completion percentage is >= this value. Stored per-institute in the
    // settings JSON. Null is treated as the default (20) by the eligibility check
    // so existing institutes that haven't saved this field continue to work.
    private Integer autoIssuePercentage;

    // Page sizing for the rendered PDF. One of: A4_LANDSCAPE, A4_PORTRAIT,
    // A3_LANDSCAPE, A3_PORTRAIT, CUSTOM. Null falls back to A4_LANDSCAPE
    // (the historical default in PdfRendererBuilder.useDefaultPageSize).
    private String aspectRatio;

    // Used only when aspectRatio = CUSTOM.
    private Integer customWidthMm;
    private Integer customHeightMm;

    // Round-trip serialization of the visual editor state (image data URL +
    // field mappings) so admins can re-open the editor without re-uploading
    // the image. Backend stores it verbatim and never inspects it; the
    // backend renders from currentHtmlCertificateTemplate (which the frontend
    // produces by serializing this same state to HTML on save).
    private String imageTemplateJson;

    // The admin's hand-authored HTML kept independent of currentHtmlCertificateTemplate.
    // currentHtmlCertificateTemplate is whatever the active editor renders (visual-mode
    // serialized HTML when the active editor is Visual; the user's HTML when the
    // active editor is HTML). This field stores ONLY the user-authored HTML, so a
    // Visual-mode save doesn't clobber it and the admin can flip back to HTML mode
    // and see their work intact.
    private String htmlEditorTemplate;

    // Which editor the admin last saved in: "visual" or "html". The backend
    // doesn't act on this — it always renders currentHtmlCertificateTemplate —
    // but the frontend uses it to open the page in the right editor.
    private String preferredEditorMode;

    // Certificate numbering format for this institute. Null keeps the historical
    // shape ({PREFIX}-{SEQ:4}-{YYYY}), but sequence-backed rather than random.
    // See CertificateNumberService for the supported tokens.
    private CertificateNumberingDto certificateNumbering;

    // Overrides what the {{CERTIFICATE_QR}} token encodes. Null/blank uses the
    // platform verification page on the institute's own learner portal, which
    // needs no login. Set a URL containing {{CERTIFICATE_ID}} — for example
    // https://myschool.com/verify?c={{CERTIFICATE_ID}} — to send scans to your
    // own page instead. Note that doing so bypasses platform verification: the
    // QR then carries only the number, which is not a credential.
    private String qrVerificationUrlTemplate;

    // Which machine-readable code is stamped alongside the certificate number
    // on every issued certificate: "QR" or "BARCODE". Null/unrecognised means
    // QR — it carries more data, survives partial damage, and any phone camera
    // reads it without a dedicated scanner.
    private String badgeCodeType;

    // What the {{CERTIFICATE_BARCODE}} token encodes:
    //   NUMBER            - the bare certificate number (the historical
    //                       behaviour, and what null means). Scans to a string;
    //                       verifies nothing, because the number alone is
    //                       deliberately not a credential.
    //   VERIFICATION_CODE - "<number>*<shortCode>", which the public verify page
    //                       resolves. Needs a wider barcode to stay scannable
    //                       (~21 characters rather than ~11), so the editor
    //                       widens the default box when this is selected.
    private String barcodeContent;

    // Whether the platform may stamp the code and the number bottom-right on a
    // certificate whose design does not place them itself.
    //
    // Both default to TRUE when null, which is what every certificate issued
    // before these existed did — the stamp was unconditional, and an admin who
    // deleted the QR or the certificate-number field from their design watched
    // it reappear on the issued PDF with no way to stop it. That is what these
    // switch off.
    //
    // Two flags rather than one because they are two decisions: an institute
    // that wants its number printed but no machine-readable code (or the
    // reverse) is a normal request, and the renderer already decides them
    // independently.
    //
    // Turning off the code means nothing on the certificate can be scanned, so
    // it can no longer be verified by scanning — the admin is told this in the
    // settings UI before they do it.
    private Boolean autoStampCode;
    private Boolean autoStampNumber;

    // A line of the institute's own on the public verification page — a
    // registrar's contact, a note about what the certificate attests to.
    // Shown to whoever scans a certificate, so it is public by definition.
    // Null/blank prints nothing rather than an empty panel.
    private String verificationNote;

    // Admin-defined fields, so an institute can put values on its certificates
    // that the platform has no built-in token for — a grade, a director's name,
    // an accreditation line. Each entry becomes a draggable chip in the visual
    // editor and a {{CF_<KEY>}} token the renderer substitutes.
    private List<CertificateCustomFieldDto> customFields;
}
