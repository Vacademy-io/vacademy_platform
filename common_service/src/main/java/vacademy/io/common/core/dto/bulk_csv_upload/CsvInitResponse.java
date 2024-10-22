package vacademy.io.common.core.dto.bulk_csv_upload;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CsvInitResponse {
    private String page_title;
    private List<String> instructions;
    private CsvSubmitApi submit_api;
    private List<Header> headers;
}