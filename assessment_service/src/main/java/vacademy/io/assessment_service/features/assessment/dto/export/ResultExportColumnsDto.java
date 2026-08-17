package vacademy.io.assessment_service.features.assessment.dto.export;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Columns the result CSV export can produce for an assessment: the fixed result
 * columns plus one per registration-form custom field (what external
 * participants were asked at registration on a public assessment).
 * <p>
 * The admin dashboard renders this as the tick-list in the Export CSV dialog, so
 * {@code columnLabel} is the exact CSV header the field will produce — the
 * dialog and the file can't drift apart.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ResultExportColumnsDto {

    private List<String> baseColumns;
    private List<CustomFieldColumn> customFields;

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class CustomFieldColumn {
        private String id;
        private String fieldName;
        private String fieldKey;
        private String fieldType;
        private Integer fieldOrder;
        private Boolean isMandatory;
        private String columnLabel;
    }
}
