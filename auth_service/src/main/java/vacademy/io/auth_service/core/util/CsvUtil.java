package vacademy.io.auth_service.core.util;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import vacademy.io.common.auth.dto.UserDTO;

import java.lang.reflect.Field;
import java.text.SimpleDateFormat;
import java.util.List;

public class CsvUtil {

    private CsvUtil() {
    }

    public static <T> ResponseEntity<byte[]> convertListToCsv(List<T> dataFromDatabase, String filename) {
        if (dataFromDatabase == null || dataFromDatabase.isEmpty()) {
            return ResponseEntity.noContent().build();
        }

        StringBuilder csvBuilder = new StringBuilder();
        Class<?> clazz = dataFromDatabase.get(0).getClass();

        Field[] fields = clazz.getDeclaredFields();
        for (Field field : fields) {
            csvBuilder.append(field.getName()).append(",");
        }
        csvBuilder.setLength(csvBuilder.length() - 1);
        csvBuilder.append("\n");

        for (T item : dataFromDatabase) {
            for (Field field : fields) {
                field.setAccessible(true);
                try {
                    Object value = field.get(item);
                    String valueStr = value != null ? value.toString().replace(",", ";") : "";
                    csvBuilder.append(valueStr).append(",");
                } catch (IllegalAccessException e) {
                    csvBuilder.append("").append(",");
                }
            }
            csvBuilder.setLength(csvBuilder.length() - 1);
            csvBuilder.append("\n");
        }

        String csvData = csvBuilder.toString();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        headers.setContentType(MediaType.TEXT_PLAIN);

        return ResponseEntity.ok().headers(headers).body(csvData.getBytes());
    }

    public static <T> ResponseEntity<byte[]> convertListToCsv(List<T> dataFromDatabase) {
        return convertListToCsv(dataFromDatabase, "data.csv");
    }

    public static ResponseEntity<byte[]> convertUserListToCsv(List<UserDTO> users, String filename) {
        if (users == null || users.isEmpty()) {
            return ResponseEntity.noContent().build();
        }

        StringBuilder csvBuilder = new StringBuilder();
        SimpleDateFormat dateFormat = new SimpleDateFormat("dd-MM-yyyy HH:mm:ss");

        csvBuilder.append("Username,Full Name,Email,Contact Number,Last Login Time\n");

        for (UserDTO user : users) {
            String username = user.getUsername() != null ? user.getUsername() : "";
            String fullName = user.getFullName() != null ? user.getFullName() : "";
            String email = user.getEmail() != null ? user.getEmail() : "";
            String contactNumber = user.getMobileNumber() != null ? user.getMobileNumber() : "";
            String lastLoginTime = "";

            if (user.getLastLoginTime() != null) {
                lastLoginTime = dateFormat.format(user.getLastLoginTime());
            }

            csvBuilder.append(escapeCsvValue(username)).append(",");
            csvBuilder.append(escapeCsvValue(fullName)).append(",");
            csvBuilder.append(escapeCsvValue(email)).append(",");
            csvBuilder.append(escapeCsvValue(contactNumber)).append(",");
            csvBuilder.append(escapeCsvValue(lastLoginTime)).append("\n");
        }

        String csvData = csvBuilder.toString();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        headers.setContentType(MediaType.TEXT_PLAIN);

        return ResponseEntity.ok().headers(headers).body(csvData.getBytes());
    }

    private static String escapeCsvValue(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
