package vacademy.io.admin_core_service.features.course.dto.bulk;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Result DTO for a single course in the bulk creation response.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkCourseResultDTO {

    /**
     * Index of this course in the original request (0-based).
     */
    private int index;

    /**
     * Course name from the request.
     */
    private String courseName;

    /**
     * Status: SUCCESS or FAILED.
     */
    private String status;

    /**
     * Created course/package ID. Null if failed.
     */
    private String courseId;

    /**
     * List of created PackageSession IDs. Empty if failed.
     */
    private List<String> packageSessionIds;

    /**
     * List of created EnrollInvite IDs. Empty if failed.
     */
    private List<String> enrollInviteIds;

    /**
     * Created PaymentOption ID (if a new one was created).
     */
    private String paymentOptionId;

    /**
     * Error message if failed. Null if successful.
     */
    private String errorMessage;

    // ======== Factory Methods ========

    public static BulkCourseResultDTO success(int index, String courseName, String courseId,
            List<String> packageSessionIds,
            List<String> enrollInviteIds,
            String paymentOptionId) {
        return BulkCourseResultDTO.builder()
                .index(index)
                .courseName(courseName)
                .status("SUCCESS")
                .courseId(courseId)
                .packageSessionIds(packageSessionIds)
                .enrollInviteIds(enrollInviteIds)
                .paymentOptionId(paymentOptionId)
                .errorMessage(null)
                .build();
    }

    public static BulkCourseResultDTO failure(int index, String courseName, String errorMessage) {
        return BulkCourseResultDTO.builder()
                .index(index)
                .courseName(courseName)
                .status("FAILED")
                .courseId(null)
                .packageSessionIds(List.of())
                .enrollInviteIds(List.of())
                .paymentOptionId(null)
                .errorMessage(errorMessage)
                .build();
    }
}
