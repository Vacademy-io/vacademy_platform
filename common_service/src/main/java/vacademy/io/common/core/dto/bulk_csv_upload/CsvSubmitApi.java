package vacademy.io.common.core.dto.bulk_csv_upload;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class CsvSubmitApi {
    private String route;
    private String status_col;
    private String error_response_col;
    private Map<String, String> request_params;
}