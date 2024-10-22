package vacademy.io.common.core.dto.bulk_csv_upload;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;


@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Header {
    private String type;
    private boolean optional;
    private String column_name;
    private List<String> options;
    private String format;
    private String regex;
    private String regex_error_message;
}