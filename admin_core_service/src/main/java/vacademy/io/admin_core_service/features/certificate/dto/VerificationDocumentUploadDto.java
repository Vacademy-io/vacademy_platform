package vacademy.io.admin_core_service.features.certificate.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * What the editor needs after an admin uploads a verification PDF: a canvas to
 * draw, and the page it came from.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerificationDocumentUploadDto {

    /** Media id of the rasterised first page, used as the canvas background. */
    private String backgroundFileId;

    /** Resolved URL for the same image, so the editor can show it immediately. */
    private String backgroundUrl;

    /**
     * Canvas size in pixels. Field coordinates are stored against these, so the
     * editor must lay out at exactly this size or every dragged field lands in
     * the wrong place when rendered.
     */
    private Integer widthPx;
    private Integer heightPx;

    /**
     * The source page size. Carried so the rendered document can declare an
     * {@code @page} of the same dimensions — otherwise a document designed on an
     * A4 upload prints on the platform default and the artwork is cropped.
     */
    private Integer pageWidthMm;
    private Integer pageHeightMm;

    /**
     * Pages in the upload. Only the first becomes the canvas; the editor shows a
     * note when this is greater than one rather than letting the admin wonder
     * where the rest went.
     */
    private Integer pageCount;
}
