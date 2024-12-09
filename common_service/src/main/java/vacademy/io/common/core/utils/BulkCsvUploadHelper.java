package vacademy.io.common.core.utils;

import vacademy.io.common.core.dto.bulk_csv_upload.CsvSubmitApi;
import vacademy.io.common.core.dto.bulk_csv_upload.Header;

import java.util.List;
import java.util.Map;


public class BulkCsvUploadHelper {

    public static CsvSubmitApi createSubmitApi(String route, String status_col, String error_response, Map<String, String> request_params) {
        return new CsvSubmitApi(route, status_col, error_response, request_params);
    }

    public static Header createEnumHeader(String type, boolean optional, String column_name, List<String> options, Integer order, List<String> sampleValues) {
        Header header = new Header();
        header.setType(type);
        header.setOrder(order);
        header.setOptional(optional);
        header.setColumn_name(column_name);
        header.setOptions(options);
        header.setSample_values(sampleValues);
        return header;
    }

    public static Header createEnumHeaderWithIdResponse(String type, boolean optional, String column_name, Map<String, String> options, Integer order) {
        Header header = new Header();
        header.setType(type);
        header.setOrder(order);
        header.setOptional(optional);
        header.setColumn_name(column_name);
        header.setOption_ids(options);
        header.setOptions(options.values().stream().toList());
        header.setSample_values(options.values().stream().limit(3).toList());
        return header;
    }

    public static Header createHeader(String type, boolean optional, String column_name, Integer order, List<String> sampleValues) {
        Header header = new Header();
        header.setType(type);
        header.setOrder(order);
        header.setOptional(optional);
        header.setSample_values(sampleValues);
        header.setColumn_name(column_name);
        return header;
    }

    public static Header createDateHeader(String type, boolean optional, String column_name, String format, Integer order, List<String> sampleValues) {
        Header header = new Header();
        header.setType(type);
        header.setOrder(order);
        header.setOptional(optional);
        header.setColumn_name(column_name);
        header.setSample_values(sampleValues);
        header.setFormat(format);
        return header;
    }


    public static Header createRegexHeader(String type, boolean optional, String column_name, String regex, String regex_error_message, Integer order, List<String> sampleValues) {
        Header header = new Header();
        header.setType(type);
        header.setOrder(order);
        header.setOptional(optional);
        header.setColumn_name(column_name);
        header.setRegex(regex);
        header.setSample_values(sampleValues);
        header.setRegex_error_message(regex_error_message);
        return header;
    }
}
