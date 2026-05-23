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
}
