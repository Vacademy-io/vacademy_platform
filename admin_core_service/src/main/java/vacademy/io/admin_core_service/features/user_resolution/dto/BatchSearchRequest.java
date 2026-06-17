package vacademy.io.admin_core_service.features.user_resolution.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/** Search an institute's batches by name; optional id-scope limits to a teacher's mapped batches. */
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class BatchSearchRequest {
    private String instituteId;
    private String nameQuery;
    private List<String> packageSessionIds; // null/empty = all institute batches
    private Integer limit;
}
