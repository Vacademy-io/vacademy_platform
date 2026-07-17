package vacademy.io.admin_core_service.features.engagement.spi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FetchContext {
    private String instituteId;
    private String engineId;
    /** Window for "recent" rollups, days. */
    private int recentWindowDays;
}
