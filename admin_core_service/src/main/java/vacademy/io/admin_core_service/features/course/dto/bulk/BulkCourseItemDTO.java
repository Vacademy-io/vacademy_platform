package vacademy.io.admin_core_service.features.course.dto.bulk;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO representing a single course item in a bulk course creation request.
 * All fields except courseName are optional and will fall back to global
 * defaults
 * or system defaults.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkCourseItemDTO {

    // ==================== REQUIRED FIELDS ====================

    /**
     * Course name. REQUIRED.
     */
    private String courseName;

    // ==================== COURSE METADATA (Optional) ====================

    /**
     * Course type: COURSE, MEMBERSHIP, PRODUCT, SERVICE.
     * Defaults to global default or "COURSE".
     */
    private String courseType;

    /**
     * Course depth (hierarchy depth).
     * Defaults to global default or 5.
     */
    private Integer courseDepth;

    /**
     * Tags for categorization.
     * Merged with global tags if both present.
     */
    private List<String> tags;

    /**
     * Thumbnail/cover image file ID.
     */
    private String thumbnailFileId;

    /**
     * Course preview image media ID.
     */
    private String coursePreviewImageMediaId;

    /**
     * Course banner media ID.
     */
    private String courseBannerMediaId;

    /**
     * Course video/media ID.
     */
    private String courseMediaId;

    /**
     * HTML description: Why learn this course?
     */
    private String whyLearnHtml;

    /**
     * HTML description: Who should learn this course?
     */
    private String whoShouldLearnHtml;

    /**
     * HTML description: About the course.
     */
    private String aboutTheCourseHtml;

    /**
     * HTML description of the course.
     */
    private String courseHtmlDescription;

    /**
     * Whether to publish to catalogue.
     */
    private Boolean publishToCatalogue;

    // ==================== BATCH CONFIGURATION (Optional) ====================

    /**
     * Batches (level-session pairs) to create for this course.
     * If null, uses global batches or creates DEFAULT.
     */
    private List<BulkCourseBatchDTO> batches;

    // ==================== PAYMENT CONFIGURATION (Optional) ====================

    /**
     * Payment configuration for this course.
     * If null, uses global payment config or institute default.
     */
    private BulkCoursePaymentConfigDTO paymentConfig;

    // ==================== INVENTORY CONFIGURATION (Optional) ====================

    /**
     * Inventory configuration for all batches of this course.
     * Can be overridden per-batch in the batches list.
     */
    private BulkCourseInventoryConfigDTO inventoryConfig;

    // ==================== FACULTY (Optional) ====================

    /**
     * Faculty user IDs to assign to this course.
     */
    private List<String> facultyUserIds;
}
