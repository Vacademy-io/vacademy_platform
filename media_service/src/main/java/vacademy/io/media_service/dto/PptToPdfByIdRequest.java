package vacademy.io.media_service.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request for converting an already-uploaded presentation (referenced by its
 * media-service fileId) to PDF. The file is uploaded directly to S3 via a
 * pre-signed URL, so the bytes never pass through nginx/Spring — this avoids the
 * request-body size limit that the multipart {@code /convert/ppt-to-pdf} endpoint hits.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PptToPdfByIdRequest {
    /** media-service file id returned by {@code /get-signed-url}. */
    private String fileId;
    /** Original file name (used to detect the input format, e.g. .ppt/.pptx/.odp). */
    private String fileName;
}
