package vacademy.io.admin_core_service.features.doubts.dtos;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;
import java.util.Map;


@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class DoubtsRequestFilter {
    private String name;
    private Date startDate;
    private Date endDate;
    private List<String> userIds;
    private List<String> contentPositions;
    private List<String> contentTypes;
    private List<String> sources;
    private List<String> sourceIds;
    private List<String> status;
    private List<String> batchIds;
    /** Filter by configurable query type key(s) (DOUBT, TECHNICAL, PAYMENT, ...). */
    private List<String> types;
    /**
     * Scopes the admin inbox to one institute. Admin (unscoped) callers must pass this so the
     * inbox no longer requires at least one batch — GENERAL queries have no batch.
     */
    private String instituteId;
    Map<String, String> sortColumns;
}
