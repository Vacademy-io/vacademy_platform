package vacademy.io.common.core.utils;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.lang.reflect.Field;
import java.util.List;

public class DataToCsvConverter {

    public static <T> ResponseEntity<byte[]> convertListToCsv(List<T> dataFromDatabase) {
        if (dataFromDatabase == null || dataFromDatabase.isEmpty()) {
            return ResponseEntity.noContent().build(); // Handle empty list case
        }

        StringBuilder csvBuilder = new StringBuilder();

        // Get the class type of T
        Class<?> clazz = dataFromDatabase.get(0).getClass();

        // Generate CSV header
        Field[] fields = clazz.getDeclaredFields();
        for (Field field : fields) {
            csvBuilder.append(field.getName()).append(","); // Add field names as headers
        }
        csvBuilder.setLength(csvBuilder.length() - 1); // Remove last comma
        csvBuilder.append("\n");

        // Generate CSV data rows
        for (T item : dataFromDatabase) {
            for (Field field : fields) {
                field.setAccessible(true); // Allow access to private fields
                try {
                    Object value = field.get(item);
                    csvBuilder.append(value != null ? value.toString() : "").append(","); // Handle null values
                } catch (IllegalAccessException e) {
                    e.printStackTrace(); // Handle exception as needed
                }
            }
            csvBuilder.setLength(csvBuilder.length() - 1); // Remove last comma
            csvBuilder.append("\n");
        }

        String csvData = csvBuilder.toString();

        // Set response headers for CSV download
        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.attachment().filename("data.csv").build());
        headers.setContentType(MediaType.TEXT_PLAIN);

        // Return the CSV data as a response entity
        return ResponseEntity.ok().headers(headers).body(csvData.getBytes());
    }
}
