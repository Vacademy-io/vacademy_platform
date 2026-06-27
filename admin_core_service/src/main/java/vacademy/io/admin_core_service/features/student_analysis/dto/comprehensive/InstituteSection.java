package vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteSection {

    /** Internal — kept for aggregator use but not serialized. */
    @JsonIgnore
    private String id;

    private String name;

    /** Public CDN URL for the institute logo. Null when not configured. */
    private String logoUrl;

    /** Brand theme hex color, e.g. "#2563eb". Null when not configured. */
    private String themeColor;
}
