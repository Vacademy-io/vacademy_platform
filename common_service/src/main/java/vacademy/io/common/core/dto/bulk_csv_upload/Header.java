package vacademy.io.common.core.dto.bulk_csv_upload;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;


@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Header {
    private String type;
    private boolean optional;
    private String column_name;
    private List<String> options;
    private Boolean send_option_id;
    private Map<String, String> option_ids;
    private String format;
    private String regex;
    private String regex_error_message;
    private Integer order;
    private List<String> sample_values;
}