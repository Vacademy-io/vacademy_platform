package vacademy.io.common.core.standard_classes;

import vacademy.io.common.core.dto.bulk_csv_upload.CsvSubmitApi;
import vacademy.io.common.core.dto.bulk_csv_upload.Header;

import java.util.List;
import java.util.Map;


public class BulkCsvUploadHelper {

    public static CsvSubmitApi createSubmitApi(String route, String status_col, String error_response, Map<String, String> request_params) {
        return new CsvSubmitApi(route, status_col, error_response, request_params);
    }

    public static Header createEnumHeader(String type, boolean optional, String column_name, List<String> options) {
        Header header = new Header();
        header.setType(type);
        header.setOptional(optional);
        header.setColumn_name(column_name);
        header.setOptions(options);
        return header;
    }

    public static Header createHeader(String type, boolean optional, String column_name) {
        Header header = new Header();
        header.setType(type);
        header.setOptional(optional);
        header.setColumn_name(column_name);
        return header;
    }

    public static Header createDateHeader(String type, boolean optional, String column_name, String format) {
        Header header = new Header();
        header.setType(type);
        header.setOptional(optional);
        header.setColumn_name(column_name);
        header.setFormat(format);
        return header;
    }


    public static Header createRegexHeader(String type, boolean optional, String column_name, String regex, String regex_error_message) {
        Header header = new Header();
        header.setType(type);
        header.setOptional(optional);
        header.setColumn_name(column_name);
        header.setRegex(regex);
        header.setRegex_error_message(regex_error_message);
        return header;
    }
}
